import express from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { createPayment, getPayments, getPaymentById } from '../db/database.js';
import { MAX_PAYMENT_AMOUNT } from '../config.js';
import { validateEmail, parseAmount } from '../utils/validators.js';

const router = express.Router();

// GET /api/payments - List all payments for authenticated merchant
router.get('/', authenticate, (req, res) => {
  try {
    const merchantId = req.user.id;
    const payments = getPayments(merchantId);

    // BUG A FIX: amount must stay a number (a string breaks frontend math -> NaN)
    const formattedPayments = payments.map(p => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      customer_email: p.customer_email,
      created_at: p.created_at
    }));

    res.json({
      success: true,
      data: formattedPayments,
      count: formattedPayments.length
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/payments/:id - Get single payment
router.get('/:id', authenticate, (req, res) => {
  try {
    const payment = getPaymentById(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify ownership
    if (payment.merchant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      data: {
        id: payment.id,
        amount: Number(payment.amount), // Bug A fix (same as list endpoint)
        currency: payment.currency,
        status: payment.status,
        customer_email: payment.customer_email,
        created_at: payment.created_at
      }
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// POST /api/payments - Create new payment
router.post('/', authenticate, (req, res) => {
  try {
    const { amount, currency, customer_email } = req.body;

    // Validation
    // parseAmount rejects NaN/Infinity/booleans/arrays/empty strings/>2 decimals.
    // (Previously `amount: true` passed validation and was stored as NaN.)
    const parsedAmount = parseAmount(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required (positive, max 2 decimals)' });
    }

    // BUG B FIX: enforce a per-transaction maximum (€50,000)
    if (parsedAmount > MAX_PAYMENT_AMOUNT) {
      return res.status(400).json({
        error: `Amount exceeds the maximum allowed per transaction (${MAX_PAYMENT_AMOUNT})`
      });
    }

    if (!currency || !['EUR', 'USD', 'GBP'].includes(currency)) {
      return res.status(400).json({ error: 'Valid currency is required (EUR, USD, GBP)' });
    }

    if (!validateEmail(customer_email)) {
      return res.status(400).json({ error: 'Valid customer email is required' });
    }

    const payment = createPayment({
      merchant_id: req.user.id,
      amount: parsedAmount,
      currency,
      customer_email,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Payment created',
      data: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        customer_email: payment.customer_email
      }
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

export default router;
