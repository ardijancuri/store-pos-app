const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../database/connection');
const { authenticateToken, requireAdmin, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// List shop managers with order statistics
router.get('/', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        sm.id, 
        sm.name, 
        sm.phone, 
        sm.is_active, 
        sm.created_at,
        COALESCE(order_stats.total_orders, 0) as total_orders,
        COALESCE(order_stats.total_revenue, 0) as total_revenue
      FROM shop_managers sm
      LEFT JOIN (
        SELECT 
          o.shop_manager_id,
          COUNT(*) as total_orders,
          SUM(o.total_amount) as total_revenue
        FROM orders o
        WHERE o.status = 'completed'
        GROUP BY o.shop_manager_id
      ) order_stats ON sm.id = order_stats.shop_manager_id
      ORDER BY sm.name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('List shop managers error:', error);
    res.status(500).json({ message: 'Failed to list shop managers' });
  }
});

// Create shop manager
router.post('/', [
  authenticateToken,
  requireAdmin,
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('phone').optional({ nullable: true }).isLength({ max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    const { name, phone } = req.body;
    const result = await query(
      'INSERT INTO shop_managers (name, phone, is_active) VALUES ($1, $2, $3) RETURNING id, name, phone, is_active, created_at',
      [name, phone || null, true]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create shop manager error:', error);
    res.status(500).json({ message: 'Failed to create shop manager' });
  }
});

// Update shop manager
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('phone').optional({ nullable: true }).isLength({ max: 50 }),
  body('is_active').optional().isBoolean()
], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    const { name, phone, is_active } = req.body;
    const result = await query(
      `UPDATE shop_managers
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING id, name, phone, is_active, created_at`,
      [name || null, phone || null, typeof is_active === 'boolean' ? is_active : null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Shop manager not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update shop manager error:', error);
    res.status(500).json({ message: 'Failed to update shop manager' });
  }
});

// Delete shop manager
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Prevent delete if referenced by orders
    const ref = await query('SELECT 1 FROM orders WHERE shop_manager_id = $1 LIMIT 1', [id]);
    if (ref.rows.length > 0) return res.status(400).json({ message: 'Cannot delete manager with existing orders' });
    const result = await query('DELETE FROM shop_managers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Shop manager not found' });
    res.json({ message: 'Shop manager deleted', id });
  } catch (error) {
    console.error('Delete shop manager error:', error);
    res.status(500).json({ message: 'Failed to delete shop manager' });
  }
});

module.exports = router;


