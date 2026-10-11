import express from 'express';
import { getPaymentById, db } from '../db/database.js';
import { requireWebhookSignature } from '../utils/webhook-signature.js';

const router = express.Router();

// Statuses a payment provider is allowed to set (rejects garbage / XSS payloads)
const VALID_PAYMENT_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded'
];

/**
 * POST /api/webhooks/payment-status
 *
 * Simulates external payment provider webhooks (like Powens)
 * Tests webhook signature verification and idempotency
 *
 * Processing order matters:
 *   1. verify signature      (BUG D fix - before touching anything)
 *   2. validate payload
 *   3. idempotency check     (BUG E fix)
 *   4. business logic
 *   5. mark event processed  (only after success, so a webhook that arrived
 *                             before its payment existed can be retried)
 */
router.post('/payment-status', requireWebhookSignature, (req, res) => {
  try {
    const { payment_id, status, event_id } = req.body;

    if (payment_id === undefined || payment_id === null || payment_id === '' || !status) {
      return res.status(400).json({ error: 'payment_id and status required' });
    }

    // event_id is the idempotency key - without it we cannot dedupe retries
    if (typeof event_id !== 'string' || event_id.trim() === '' || event_id.length > 128) {
      return res.status(400).json({ error: 'event_id required' });
    }

    if (typeof status !== 'string' || !VALID_PAYMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        valid_statuses: VALID_PAYMENT_STATUSES
      });
    }

    // BUG E FIX: webhooks are delivered "at least once" - same event_id must be a no-op
    if (db.processed_webhooks.includes(event_id)) {
      return res.status(200).json({ message: 'Already processed' });
    }

    const payment = getPaymentById(String(payment_id));
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment status
    payment.status = status;
    payment.webhook_received_at = new Date();

    // Mark webhook as processed (idempotency)
    db.processed_webhooks.push(event_id);

    // Notify the merchant dashboard in real time (additive event)
    const io = req.app.get('io');
    if (io) {
      io.to(`merchant_${payment.merchant_id}`).emit('payment_status_changed', {
        payment_id: payment.id,
        status: payment.status
      });
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed',
      payment_id: payment.id,
      new_status: status
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/webhooks/e-invoice
 *
 * Simulates e-invoice submission webhook from tax authority
 * Extra hardening: it mutates invoices and was completely unauthenticated, so it
 * now requires the same HMAC signature as the payment webhook.
 */
router.post('/e-invoice', requireWebhookSignature, (req, res) => {
  try {
    const { invoice_id, status, submission_id, tax_authority_id } = req.body;

    if (!invoice_id || !status) {
      return res.status(400).json({ error: 'invoice_id and status required' });
    }

    if (typeof status !== 'string' || !/^[a-z_]{1,32}$/.test(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Find invoice in database
    const invoice = db.invoices?.find(inv => inv.id === invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Update invoice status
    invoice.einvoice_status = status;
    invoice.einvoice_submission_id = submission_id;
    invoice.tax_authority_id = tax_authority_id;
    invoice.submitted_at = new Date();

    res.status(200).json({
      success: true,
      message: 'E-invoice webhook processed',
      invoice_id,
      status
    });
  } catch (error) {
    console.error('E-invoice webhook error:', error);
    res.status(500).json({ error: 'E-invoice webhook failed' });
  }
});

export default router;
