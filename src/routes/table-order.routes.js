import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { db, findUserById } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/table-orders
 * List all table orders for authenticated merchant
 */
router.get('/', authenticate, (req, res) => {
  try {
    const merchantId = req.user.id;
    const orders = (db.table_orders || []).filter(o => o.merchant_id === merchantId);

    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Get table orders error:', error);
    res.status(500).json({ error: 'Failed to fetch table orders' });
  }
});

/**
 * POST /api/table-orders
 * Create new table order
 */
router.post('/', (req, res) => {
  try {
    const { merchant_id, table_number, items, customer_name, order_type } = req.body;

    if (!merchant_id || !table_number || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'merchant_id, table_number, and items array required' });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'Order must have at least one item' });
    }

    // Extra finding: items were never validated, so a missing/negative price or
    // quantity produced a NaN or negative order total.
    const itemsValid = items.every(item =>
      item && typeof item === 'object' &&
      Number.isFinite(item.price) && item.price >= 0 &&
      Number.isInteger(item.quantity) && item.quantity > 0
    );
    if (!itemsValid) {
      return res.status(400).json({
        error: 'Each item needs a non-negative numeric price and a positive integer quantity'
      });
    }

    // Orders for unknown merchants must not be accepted (POST is public by design
    // for diner/QR ordering, so the merchant id from the body is validated here).
    if (!findUserById(String(merchant_id))) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // BUG F FIX: a table may only have one pending order at a time.
    // String() so table 5 and "5" are treated as the same table.
    // (Handler is synchronous, so the check + insert below is atomic in Node.)
    const existingOrder = (db.table_orders || []).find(
      o => o.merchant_id === merchant_id &&
           String(o.table_number) === String(table_number) &&
           o.status === 'pending'
    );
    if (existingOrder) {
      return res.status(409).json({ error: 'Table already has a pending order' });
    }

    // Calculate total (rounded to cents to avoid 0.1 + 0.2 float artefacts)
    const total = Math.round(
      items.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 100
    ) / 100;

    const newOrder = {
      id: uuidv4(),
      merchant_id,
      table_number,
      items,
      customer_name: customer_name || 'Guest',
      order_type: order_type || 'dine_in',
      status: 'pending',
      total,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (!db.table_orders) db.table_orders = [];
    db.table_orders.push(newOrder);

    // Extra finding: this emit was commented out, so real-time clients never
    // received new orders even though the README documents the event.
    const io = req.app.get('io');
    if (io) {
      io.to(`merchant_${merchant_id}`).emit('new_order', newOrder);
    }

    res.status(201).json({
      success: true,
      message: 'Table order created',
      data: newOrder
    });
  } catch (error) {
    console.error('Create table order error:', error);
    res.status(500).json({ error: 'Failed to create table order' });
  }
});

/**
 * PATCH /api/table-orders/:id/status
 * Update order status (triggers socket.io event)
 */
router.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Valid status required', 
        valid_statuses: validStatuses 
      });
    }

    const order = (db.table_orders || []).find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify ownership
    if (order.merchant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    order.status = status;
    order.updated_at = new Date();

    // Emit socket event for real-time update (was commented out)
    const io = req.app.get('io');
    if (io) {
      io.to(`table_${order.table_number}`)
        .to(`merchant_${order.merchant_id}`)
        .emit('order_status_changed', {
          order_id: order.id,
          status: status,
          table_number: order.table_number
        });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
