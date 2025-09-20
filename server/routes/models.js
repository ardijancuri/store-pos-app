const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, run } = require('../database/connection');
const { authenticateToken, requireAdmin, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// Get all models (admin and manager)
router.get('/', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const { search = '', subcategory = '', condition = '' } = req.query;
    
    let queryText = 'SELECT * FROM models';
    let queryParams = [];
    let whereConditions = [];
    let paramCount = 1;

    // Search filter
    if (search && search.trim()) {
      whereConditions.push(`name ILIKE $${paramCount}`);
      queryParams.push(`%${search.trim()}%`);
      paramCount++;
    }

    // Subcategory filter
    if (subcategory && subcategory.trim()) {
      whereConditions.push(`subcategory = $${paramCount}`);
      queryParams.push(subcategory.trim());
      paramCount++;
    }

    // Condition filter
    if (condition && condition.trim()) {
      whereConditions.push(`condition = $${paramCount}`);
      queryParams.push(condition.trim());
      paramCount++;
    }

    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      queryText += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY name ASC';

    const result = await query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ message: 'Failed to get models' });
  }
});

// Get single model by ID (admin and manager)
router.get('/:id', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    
    const result = await query('SELECT * FROM models WHERE id = $1', [modelId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Model not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ message: 'Failed to get model' });
  }
});

// Create new model (admin only)
router.post('/', [
  authenticateToken,
  requireAdmin,
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Model name is required and must be less than 255 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('warranty').optional().isInt({ min: 0, max: 60 }).withMessage('Warranty must be between 0 and 60 months'),
  body('storages').optional().isArray().withMessage('Storages must be an array'),
  body('colors').optional().isArray().withMessage('Colors must be an array'),
  body('condition').optional().trim().isLength({ max: 100 }).withMessage('Condition must be less than 100 characters'),
  body('subcategory').optional().trim().isLength({ max: 100 }).withMessage('Subcategory must be less than 100 characters'),
  body('storage_prices').optional().isObject().withMessage('Storage prices must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, price, warranty, storages, colors, condition, subcategory, storage_prices } = req.body;

    // Check if model name already exists (case-insensitive)
    const existingModel = await query('SELECT id FROM models WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (existingModel.rows.length > 0) {
      return res.status(400).json({ message: 'Model name already exists' });
    }

    const result = await query(
      `INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        name.trim(),
        price || null,
        warranty || null,
        JSON.stringify(storages || []),
        JSON.stringify(colors || []),
        condition?.trim() || null,
        subcategory?.trim() || null,
        JSON.stringify(storage_prices || {})
      ]
    );

    res.status(201).json({
      message: 'Model created successfully',
      model: result.rows[0]
    });
  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({ message: 'Failed to create model' });
  }
});

// Update model (admin only)
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Model name must be less than 255 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('warranty').optional().isInt({ min: 0, max: 60 }).withMessage('Warranty must be between 0 and 60 months'),
  body('storages').optional().isArray().withMessage('Storages must be an array'),
  body('colors').optional().isArray().withMessage('Colors must be an array'),
  body('condition').optional().trim().isLength({ max: 100 }).withMessage('Condition must be less than 100 characters'),
  body('subcategory').optional().trim().isLength({ max: 100 }).withMessage('Subcategory must be less than 100 characters'),
  body('storage_prices').optional().isObject().withMessage('Storage prices must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const modelId = parseInt(req.params.id);
    const { name, price, warranty, storages, colors, condition, subcategory, storage_prices } = req.body;

    // Check if model exists
    const existingModel = await query('SELECT id FROM models WHERE id = $1', [modelId]);
    if (existingModel.rows.length === 0) {
      return res.status(404).json({ message: 'Model not found' });
    }

    // Check if new name conflicts with existing models (excluding current one)
    if (name) {
      const duplicateModel = await query('SELECT id FROM models WHERE LOWER(name) = LOWER($1) AND id != $2', [name.trim(), modelId]);
      if (duplicateModel.rows.length > 0) {
        return res.status(400).json({ message: 'Model name already exists' });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name.trim());
      paramCount++;
    }
    if (price !== undefined) {
      updateFields.push(`price = $${paramCount}`);
      updateValues.push(price || null);
      paramCount++;
    }
    if (warranty !== undefined) {
      updateFields.push(`warranty = $${paramCount}`);
      updateValues.push(warranty || null);
      paramCount++;
    }
    if (storages !== undefined) {
      updateFields.push(`storages = $${paramCount}`);
      updateValues.push(JSON.stringify(storages || []));
      paramCount++;
    }
    if (colors !== undefined) {
      updateFields.push(`colors = $${paramCount}`);
      updateValues.push(JSON.stringify(colors || []));
      paramCount++;
    }
    if (condition !== undefined) {
      updateFields.push(`condition = $${paramCount}`);
      updateValues.push(condition?.trim() || null);
      paramCount++;
    }
    if (subcategory !== undefined) {
      updateFields.push(`subcategory = $${paramCount}`);
      updateValues.push(subcategory?.trim() || null);
      paramCount++;
    }
    if (storage_prices !== undefined) {
      updateFields.push(`storage_prices = $${paramCount}`);
      updateValues.push(JSON.stringify(storage_prices || {}));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateValues.push(modelId);
    const updateQuery = `UPDATE models SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await query(updateQuery, updateValues);

    res.json({
      message: 'Model updated successfully',
      model: result.rows[0]
    });
  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({ message: 'Failed to update model' });
  }
});

// Delete model (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);

    // Check if model exists
    const existingModel = await query('SELECT id FROM models WHERE id = $1', [modelId]);
    if (existingModel.rows.length === 0) {
      return res.status(404).json({ message: 'Model not found' });
    }

    // Check if model is being used by any products
    const productsUsingModel = await query(
      'SELECT COUNT(*) as count FROM products WHERE name = (SELECT name FROM models WHERE id = $1)',
      [modelId]
    );
    
    const productCount = parseInt(productsUsingModel.rows[0].count);
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete model. It is being used by ${productCount} product(s) in inventory.` 
      });
    }

    await query('DELETE FROM models WHERE id = $1', [modelId]);

    res.json({
      message: 'Model deleted successfully',
      modelId
    });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ message: 'Failed to delete model' });
  }
});

// Get model statistics (admin and manager)
router.get('/stats/counts', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        m.name,
        COUNT(p.id) as total_count,
        COUNT(CASE WHEN p.stock_quantity > 0 THEN 1 END) as available_count
      FROM models m
      LEFT JOIN products p ON m.name = p.name
      GROUP BY m.name
      ORDER BY m.name
    `);

    const modelCounts = {};
    result.rows.forEach(row => {
      modelCounts[row.name] = {
        total: parseInt(row.total_count),
        available: parseInt(row.available_count)
      };
    });

    res.json({ modelCounts });
  } catch (error) {
    console.error('Get model stats error:', error);
    res.status(500).json({ message: 'Failed to get model statistics' });
  }
});

module.exports = router;
