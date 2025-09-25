const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, run, get, pool } = require('../database/connection');
const { authenticateToken, requireAdmin, requireAdminOrManager } = require('../middleware/auth');

// Helper function to check if items actually changed
function checkItemsChanged(originalItems, newItems) {
  // If lengths are different, items changed
  if (originalItems.length !== newItems.length) {
    return true;
  }

  // Create maps for comparison - now including warranty
  const originalMap = new Map();
  const newMap = new Map();

  // Build maps with productId as key and object with quantity and warranty as value
  originalItems.forEach(item => {
    const key = item.productId || item.product_id;
    originalMap.set(key, {
      quantity: item.quantity,
      warranty: item.warranty || 0
    });
  });

  newItems.forEach(item => {
    newMap.set(item.productId, {
      quantity: item.quantity,
      warranty: item.warranty || 0
    });
  });

  // Check if all items in original exist in new with same quantities AND warranty
  for (const [productId, originalData] of originalMap) {
    const newData = newMap.get(productId);
    if (newData === undefined || 
        newData.quantity !== originalData.quantity || 
        newData.warranty !== originalData.warranty) {
      return true; // Item was removed, added, quantity changed, or warranty changed
    }
  }

  // Check if all items in new exist in original
  for (const [productId, newData] of newMap) {
    const originalData = originalMap.get(productId);
    if (originalData === undefined) {
      return true; // New item was added
    }
  }

  return false; // No changes detected
}

const PDFDocument = require('pdfkit');

const router = express.Router();

// Get orders (admin: all orders, client: own orders)
router.get('/', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', search = '', date = '', sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (page - 1) * limit;
    

    let queryText = `
      SELECT o.id, o.status, o.total_amount, o.created_at,
             o.guest_name, o.guest_note, o.guest_phone, o.guest_embg, o.guest_id_card,
             sm.name as shop_manager_name,
             COALESCE(order_totals.total_amount, 0) as original_total,
             CASE 
               WHEN COALESCE(order_totals.total_amount, 0) > o.total_amount 
               THEN COALESCE(order_totals.total_amount, 0) - o.total_amount
               ELSE 0 
             END as discount_amount
      FROM orders o
      JOIN shop_managers sm ON o.shop_manager_id = sm.id
      LEFT JOIN (
        SELECT oi.order_id, 
               SUM(oi.quantity * oi.price) as total_amount
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        GROUP BY oi.order_id
      ) order_totals ON o.id = order_totals.order_id
    `;
    let countQuery = `
      SELECT COUNT(*) 
      FROM orders o
      JOIN shop_managers sm ON o.shop_manager_id = sm.id
    `;
    let queryParams = [];
    let paramCount = 1;
    let whereConditions = [];

    // Status filter
    if (status && ['pending', 'completed'].includes(status)) {
      whereConditions.push(`o.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Search filter
    if (search && search.trim()) {
      whereConditions.push(`(o.id::text ILIKE $${paramCount} OR sm.name ILIKE $${paramCount} OR o.guest_name ILIKE $${paramCount})`);
      queryParams.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Date filter
    if (date && date.trim()) {
      whereConditions.push(`DATE(o.created_at) = $${paramCount}`);
      queryParams.push(date.trim());
      paramCount++;
    }

    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      const whereClause = whereConditions.join(' AND ');
      queryText += ` WHERE ${whereClause}`;
      countQuery += ` WHERE ${whereClause}`;
    }

    // Validate sort parameters
    const validSortFields = ['created_at', 'total_amount', 'status'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy)) sortBy = 'created_at';
    if (!validSortOrders.includes(sortOrder)) sortOrder = 'desc';

    queryText += ` ORDER BY o.${sortBy} ${sortOrder.toUpperCase()} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const [ordersResult, countResult] = await Promise.all([
      query(queryText, queryParams),
      query(countQuery, whereConditions.length > 0 ? queryParams.slice(0, -2) : [])
    ]);

    const totalOrders = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      orders: ordersResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
});

// Get total revenue from all completed orders (MKD only) - excludes discounts
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COALESCE(SUM(o.total_amount), 0) as total_revenue
      FROM orders o
      WHERE o.status = 'completed'
    `);
    
    res.json({
      totalRevenue: parseFloat(result.rows[0].total_revenue)
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({ message: 'Failed to get revenue' });
  }
});

// Get single order with items
router.get('/:id', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    

    // Get order details
    let orderQuery = `
      SELECT o.id, o.status, o.total_amount, o.created_at,
             o.discount_amount, o.discount_currency, o.original_total,
             o.guest_name, o.guest_note, o.guest_phone, o.guest_embg, o.guest_id_card,
             sm.name as shop_manager_name
      FROM orders o
      JOIN shop_managers sm ON o.shop_manager_id = sm.id
      WHERE o.id = $1
    `;
    let orderParams = [orderId];

    const orderResult = await query(orderQuery, orderParams);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get order items
    const itemsResult = await query(`
      SELECT oi.quantity, oi.price, oi.warranty,
             p.id as product_id, p.name as product_name, p.description, p.category,
             p.imei, p.barcode, p.battery
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [orderId]);

    const order = orderResult.rows[0];
    order.items = itemsResult.rows;

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to get order' });
  }
});

// Create order (client or admin for guest)
router.post('/', [
  authenticateToken,
  requireAdminOrManager,
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.warranty').optional().isInt({ min: 0, max: 60 }),
  body('guestName').isString().trim().isLength({ min: 1 }),
  body('guestNote').optional({ nullable: true }).isString().trim().optional(),
  body('guestPhone').isString().trim().isLength({ min: 1 }),
  body('guestEmbg').optional({ nullable: true }).isString().trim().optional(),
  body('guestIdCard').optional({ nullable: true }).isString().trim().optional(),
  body('shopManagerId').isInt({ min: 1 }),
  body('status').optional().isIn(['pending', 'completed']).withMessage('Status must be pending or completed')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { items, guestName, guestNote, guestPhone, guestEmbg, guestIdCard, shopManagerId, status = 'pending', discount = 0, discountCurrency = 'MKD', totalMkd = 0, originalMkd = 0 } = req.body;

    // Validate products and calculate totals
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const productResult = await query(
        'SELECT id, name, price, stock_status, stock_quantity, category FROM products WHERE id = $1',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        return res.status(400).json({ message: `Product ${item.productId} not found` });
      }

      const product = productResult.rows[0];

      if (product.stock_status === 'disabled') {
        return res.status(400).json({ message: `Product ${product.name} is not available` });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      const lineTotal = product.price * item.quantity;
      totalAmount += lineTotal;

      validatedItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price,
        name: product.name,
        category: product.category,
        warranty: item.warranty || 0
      });
    }

    // Use discounted total if provided, otherwise use calculated total
    const finalTotalAmount = (totalMkd > 0 ? totalMkd : totalAmount);
    
    // Create order
    const orderResult = await query(
      'INSERT INTO orders (guest_name, guest_note, guest_phone, guest_embg, guest_id_card, shop_manager_id, total_amount, discount_amount, discount_currency, original_total, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
      [guestName, guestNote || null, guestPhone, guestEmbg || null, guestIdCard || null, shopManagerId, finalTotalAmount, discount, discountCurrency, totalAmount, status]
    );
    


    const orderId = orderResult.rows[0].id;

    // Create order items and update stock
    for (const item of validatedItems) {
      await query(
        'INSERT INTO order_items (order_id, product_id, quantity, price, warranty) VALUES ($1, $2, $3, $4, $5)',
        [orderId, item.productId, item.quantity, item.price, item.warranty]
      );

      // Update stock quantity
      await query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }


    res.status(201).json({
      message: 'Order created successfully',
      orderId,
      totalAmount: finalTotalAmount,
      originalTotal: totalAmount,
      discount: discount > 0 ? discount : 0,
      mkdTotal: finalTotalAmount
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

// Update order status (admin and manager)
router.put('/:id/status', [
  authenticateToken,
  requireAdminOrManager,
  body('status').isIn(['pending', 'completed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      message: 'Order status updated successfully',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Generate PDF invoice
router.get('/:id/invoice', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    

    // Get order details
    let orderQuery = `
      SELECT o.id, o.status, o.total_amount, o.created_at,
             o.discount_amount, o.discount_currency, o.original_total,
             o.guest_name, o.guest_note, o.guest_phone, o.guest_embg, o.guest_id_card,
             sm.name as shop_manager_name
      FROM orders o
      JOIN shop_managers sm ON o.shop_manager_id = sm.id
      WHERE o.id = $1
    `;
    let orderParams = [orderId];

    const orderResult = await query(orderQuery, orderParams);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];
    
    // Ensure required fields have default values to prevent PDF generation errors
    order.discount_amount = order.discount_amount || 0;
    order.original_total = order.original_total || 0;
    order.total_amount = order.total_amount || 0;

    // Get order items
    const itemsResult = await query(`
      SELECT oi.quantity, oi.price, oi.warranty,
             p.name as product_name, p.description, p.category, p.subcategory, p.model, p.storage_gb, p.color, p.imei
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [orderId]);
    
    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ message: 'Order has no items' });
    }
    

    // Get company settings
    const settingsResult = await query('SELECT * FROM settings ORDER BY id LIMIT 1');
    const settings = settingsResult.rows[0] || {
      company_name: 'POS CRM System',
      company_address: '123 Business Street',
      company_city_state: 'City, State 12345',
      company_phone: '(555) 123-4567',
      company_email: 'info@poscrm.com'
    };

    // Generate PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

    // Handle PDF generation errors
    doc.on('error', (err) => {
      console.error('PDF generation error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'PDF generation failed', error: err.message });
      }
    });

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to draw a line
    const drawLine = (y) => {
      doc.moveTo(50, y).lineTo(550, y).stroke();
    };

    // Helper function to draw a box
    const drawBox = (x, y, width, height) => {
      doc.rect(x, y, width, height).stroke();
    };

    // Set black color for all text
    const black = '#000000';

    // Header Section
    doc.fontSize(28).font('Helvetica-Bold').fillColor(black).text('INVOICE', { align: 'center' });
    
    // Bill To Section (moved up under title)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(black).text('BILL TO:', 50, 100);
    doc.fontSize(10).font('Helvetica').fillColor(black);
    
    doc.text(order.guest_name, 50, 120);
    if (order.guest_note) doc.text(order.guest_note, 50, 135);
    if (order.guest_phone) doc.text(order.guest_phone, 50, 150);

    // Invoice Details (Right side)
    const invoiceDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor(black).text('INVOICE DETAILS', 400, 100);
    doc.fontSize(10).font('Helvetica').fillColor(black).text(`Invoice #: ${orderId}`, 400, 120);
    doc.text(`Date: ${invoiceDate}`, 400, 135);
    doc.text(`Status: ${order.status.toUpperCase()}`, 400, 150);
    
    // Draw line after header
    drawLine(170);
    doc.moveDown(1);

    // Items Table Header
    const tableY = 190;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(black);
    
    // Draw table header box
    drawBox(50, tableY - 10, 500, 25);
    
    // Table headers
    doc.text('Product', 55, tableY);
    doc.text('Details', 150, tableY);
    doc.text('IMEI', 240, tableY);
    doc.text('Qty', 320, tableY);
    doc.text('Price', 370, tableY);
    doc.text('Total', 450, tableY);
    
    // Draw line under header
    drawLine(tableY + 15);

    // Items - All products use MKD currency
    let currentY = tableY + 25;
    doc.fontSize(9).font('Helvetica').fillColor(black);
    
    // Display all items in a single section
    itemsResult.rows.forEach((item, index) => {
      const price = parseFloat(item.price);
      const itemTotal = item.quantity * price;
      
      // Alternate row colors (light gray for even rows)
      if (index % 2 === 1) {
        doc.rect(50, currentY - 5, 500, 20).fill('#f9fafb');
      }
      
      // Explicitly set text color to black for each row
      doc.fillColor(black);
      
      // Set font size to 9 for product details
      doc.fontSize(9).font('Helvetica');
      
      // For smartphones, show subcategory • model, otherwise just product name
      const displayName = item.subcategory && item.model 
        ? `${item.subcategory} • ${item.model}`
        : item.product_name;
      doc.text(displayName, 55, currentY);
      
      // Details column - show storage and color if available
      const details = [];
      if (item.storage_gb) details.push(item.storage_gb);
      if (item.color) details.push(item.color);
      const detailsText = details.length > 0 ? details.join(' • ') : '-';
      doc.text(detailsText, 150, currentY);
      
      // IMEI column
      const imeiText = item.imei || '-';
      doc.text(imeiText, 240, currentY);
      
      doc.text(item.quantity.toString(), 320, currentY);
      doc.text(`${price.toFixed(0)} MKD`, 370, currentY);
      doc.text(`${itemTotal.toFixed(0)} MKD`, 450, currentY);
      
      currentY += 20;
    });

    // Draw line after items
    drawLine(currentY + 5);

    // Calculate totals (all items use MKD currency)
    const totalAmount = itemsResult.rows.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    
    // Calculate discount if not already set
    let actualDiscount = parseFloat(order.discount_amount || 0);
    if (actualDiscount === 0) {
      const finalTotal = parseFloat(order.total_amount || 0);
      if (totalAmount > finalTotal) {
        actualDiscount = totalAmount - finalTotal;
      }
    }
    
    // Total Section - Single MKD total
    const totalY = currentY + 20;
    const totalBoxX = 350; // Moved to right side of page
    const totalBoxWidth = 180;
    
    let totalSectionY = totalY;
    
    // Discount Section (if applicable) - Display BEFORE totals
    if (actualDiscount > 0) {
      // Draw box around discount
      drawBox(totalBoxX, totalSectionY - 10, totalBoxWidth, 25);
      
      // Label on the left
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#dc2626') // Red color for discount
        .text('Discount:', totalBoxX + 10, totalSectionY);
      
      // Amount right-aligned within the box
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#dc2626')
        .text(`-${actualDiscount.toFixed(0)} MKD`, totalBoxX + 10, totalSectionY, { width: totalBoxWidth - 20, align: 'right' });
      
      totalSectionY += 35; // Space for next total
    }
    
    // MKD Total
    // Draw box around MKD total
    drawBox(totalBoxX, totalSectionY - 10, totalBoxWidth, 25);
    
    // Label on the left
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(black) // Black color for MKD total
      .text('Total MKD:', totalBoxX + 10, totalSectionY);

    // Amount right-aligned within the box - show discounted amount if discount exists
    const displayTotal = actualDiscount > 0 ? totalAmount - actualDiscount : totalAmount;
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(black)
      .text(`${displayTotal.toFixed(0)} MKD`, totalBoxX + 10, totalSectionY, { width: totalBoxWidth - 20, align: 'right' });


    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Generate invoice error:', error);
    console.error('Error details:', {
      orderId,
      order: orderResult?.rows?.[0],
      items: itemsResult?.rows,
      errorMessage: error.message,
      errorStack: error.stack
    });
    
    // If response headers were already sent, we can't send JSON
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate invoice', error: error.message });
    } else {
      // If headers were sent, try to end the response
      res.end();
    }
  }
});

// Update order (admin only) - can update status and items
router.put('/:id', authenticateToken, requireAdminOrManager, [
  body('status').optional().isIn(['pending', 'completed']).withMessage('Status must be pending or completed'),
  body('items').optional().isArray({ min: 1 }).withMessage('Items must be an array with at least one item'),
  body('items.*.productId').isInt({ min: 1 }).withMessage('Product ID must be a positive integer'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('items.*.warranty').optional().isInt({ min: 0, max: 60 }).withMessage('Warranty must be between 0 and 60 months'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be a positive number'),
  body('guestName').optional().isString().trim().isLength({ min: 1 }).withMessage('Guest name must be a non-empty string'),
  body('guestPhone').optional().isString().trim().isLength({ min: 1 }).withMessage('Guest phone must be a non-empty string'),
  body('guestNote').optional().isString().trim().optional(),
  body('guestEmbg').optional().isString().trim().optional(),
  body('guestIdCard').optional().isString().trim().optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    const orderId = parseInt(req.params.id);
    const { status, items, originalItems, preserveDiscount, originalDiscount, discount, guestName, guestPhone, guestNote, guestEmbg, guestIdCard } = req.body;

    // Check if order exists
    const orderResult = await query('SELECT id FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update order status if provided
      if (status) {
        await client.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
      }

      // Update guest information if provided
      if (guestName || guestPhone || guestNote !== undefined || guestEmbg !== undefined || guestIdCard !== undefined) {
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (guestName) {
          updateFields.push(`guest_name = $${paramCount}`);
          updateValues.push(guestName);
          paramCount++;
        }
        if (guestPhone) {
          updateFields.push(`guest_phone = $${paramCount}`);
          updateValues.push(guestPhone);
          paramCount++;
        }
        if (guestNote !== undefined) {
          updateFields.push(`guest_note = $${paramCount}`);
          updateValues.push(guestNote.trim() || null);
          paramCount++;
        }
        if (guestEmbg !== undefined) {
          updateFields.push(`guest_embg = $${paramCount}`);
          updateValues.push(guestEmbg.trim() || null);
          paramCount++;
        }
        if (guestIdCard !== undefined) {
          updateFields.push(`guest_id_card = $${paramCount}`);
          updateValues.push(guestIdCard.trim() || null);
          paramCount++;
        }

        if (updateFields.length > 0) {
          updateValues.push(orderId);
          const updateQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;
          await client.query(updateQuery, updateValues);
        }
      }

      // Update discount if provided
      if (discount !== undefined) {
        await client.query('UPDATE orders SET discount_amount = $1 WHERE id = $2', [discount, orderId]);
        
        // Recalculate total with new discount even if items didn't change
        const totalsResult = await client.query(`
          SELECT SUM(oi.quantity * oi.price) as total_amount
          FROM order_items oi
          WHERE oi.order_id = $1
        `, [orderId]);

        const totals = totalsResult.rows[0];
        let finalTotal = totals.total_amount || 0;
        
        if (discount > 0) {
          finalTotal = Math.max(0, finalTotal - discount);
        }
        
        await client.query(
          'UPDATE orders SET total_amount = $1 WHERE id = $2',
          [finalTotal, orderId]
        );
      }

      // Update order items if provided
      if (items && Array.isArray(items)) {
        // Fetch current order items from database for comparison
        const currentItemsResult = await client.query(`
          SELECT oi.product_id, oi.quantity, oi.price, p.category
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = $1
        `, [orderId]);
        const currentItems = currentItemsResult.rows;

        // Check if items actually changed by comparing with current database items
        const itemsChanged = checkItemsChanged(currentItems, items);

        if (!itemsChanged) {
          // If only status changed, still update it
          if (status) {
            await client.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
          }
          await client.query('COMMIT');
          return res.json({
            message: 'Order updated successfully',
            orderId,
            status: status || 'unchanged',
            itemsUpdated: false
          });
        }
        
        // Use the already fetched current items for stock restoration
        
        // Restore stock for all current items
        for (const item of currentItems) {
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
        
        
        // Delete existing order items
        await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

        // Insert new order items and reduce stock
        for (const item of items) {
          // Check if we have enough stock
          const stockCheckResult = await client.query(
            'SELECT stock_quantity FROM products WHERE id = $1',
            [item.productId]
          );
          
          if (stockCheckResult.rows.length === 0) {
            throw new Error(`Product ${item.productId} not found`);
          }
          
          const currentStock = stockCheckResult.rows[0].stock_quantity;
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for product ${item.productId}. Available: ${currentStock}, Requested: ${item.quantity}`);
          }
          
          // Reduce stock for the new item
          await client.query(
            'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
            [item.quantity, item.productId]
          );
          
          const insertResult = await client.query(
            'INSERT INTO order_items (order_id, product_id, quantity, price, warranty) VALUES ($1, $2, $3, $4, $5)',
            [orderId, item.productId, item.quantity, item.price, item.warranty || 0]
          );
        }
        

        // Recalculate order total
        const totalsResult = await client.query(`
          SELECT SUM(oi.quantity * oi.price) as total_amount
          FROM order_items oi
          WHERE oi.order_id = $1
        `, [orderId]);

        const totals = totalsResult.rows[0];
        
        // Apply discount if provided, otherwise preserve existing discount
        let finalTotal = totals.total_amount || 0;
        if (discount !== undefined && discount > 0) {
          finalTotal = Math.max(0, finalTotal - discount);
        } else if (preserveDiscount && originalDiscount > 0) {
          finalTotal = Math.max(0, finalTotal - originalDiscount);
        }
        
        await client.query(
          'UPDATE orders SET total_amount = $1 WHERE id = $2',
          [finalTotal, orderId]
        );
      }

      await client.query('COMMIT');

    res.json({ 
        message: 'Order updated successfully',
      orderId,
        status: status || 'unchanged',
        itemsUpdated: items ? true : false
    });
  } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

// Delete order (admin only)
router.delete('/:id', authenticateToken, requireAdminOrManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderId = parseInt(req.params.id);

    // Check if order exists
    const orderResult = await client.query('SELECT id, status FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderStatus = orderResult.rows[0].status;

    // Get all order items before deleting them
    const orderItemsResult = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
      [orderId]
    );

    // Restore stock quantities for each product
    for (const item of orderItemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }


    // Delete order items first (due to foreign key constraint)
    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

    // Delete the order
    await client.query('DELETE FROM orders WHERE id = $1', [orderId]);

    // Log the restoration action

    await client.query('COMMIT');

    res.json({
      message: `Order deleted successfully and ${orderItemsResult.rows.length} items restored to inventory`,
      orderId,
      itemsRestored: orderItemsResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Failed to delete order' });
  } finally {
    client.release();
  }
});

// Update order status only (admin only) - for backward compatibility
router.put('/:id/status', authenticateToken, requireAdminOrManager, [
  body('status').isIn(['pending', 'completed']).withMessage('Status must be pending or completed')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: errors.array() 
      });
    }

    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    // Check if order exists
    const orderResult = await query('SELECT id FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update order status
    await query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);

    res.json({ 
      message: 'Order status updated successfully',
      orderId,
      status 
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

module.exports = router; 
