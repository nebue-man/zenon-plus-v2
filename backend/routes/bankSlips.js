const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { saveIdPhoto } = require('../utils/uploadHandler');
const { calculate } = require('../utils/commissionEngine');

// POST /bank-slips — submit a deposit slip (manager, agent, subagent only)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('manager', 'agent', 'subagent'),
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number.'),
    body('bankName').optional().isString().trim(),
    body('slipImage').notEmpty().withMessage('Bank slip image is required.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { amount, bankName, slipImage } = req.body;
      const submittedBy = req.user.id;

      const slipUrl = await saveIdPhoto(slipImage);

      const result = await db.query(
        `INSERT INTO bank_slip_requests (submitted_by, amount, bank_name, bank_slip_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, submitted_at`,
        [submittedBy, parseFloat(amount), bankName || null, slipUrl]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
         VALUES ($1, 'SLIP_SUBMITTED', $1, $2)`,
        [submittedBy, JSON.stringify({ amount, bankName })]
      );

      return res.status(201).json({
        success: true,
        data: {
          id: result.rows[0].id,
          submittedAt: result.rows[0].submitted_at,
          message: 'Bank slip submitted. Your parent will review it shortly.',
        },
      });
    } catch (err) {
      console.error('Submit bank slip error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to submit bank slip.' });
    }
  }
);

// GET /bank-slips/my — own submission history
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT bsr.id, bsr.amount, bsr.bank_name AS "bankName", bsr.bank_slip_url AS "slipUrl",
              bsr.status, bsr.reject_reason AS "rejectReason", bsr.submitted_at AS "submittedAt",
              bsr.reviewed_at AS "reviewedAt", r.full_name AS "reviewedByName",
              bsr.transaction_id AS "transactionId"
       FROM bank_slip_requests bsr
       LEFT JOIN users r ON r.id = bsr.reviewed_by
       WHERE bsr.submitted_by = $1
       ORDER BY bsr.submitted_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      data: result.rows.map(formatSlip),
    });
  } catch (err) {
    console.error('My slips error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch submissions.' });
  }
});

// GET /bank-slips/review-queue — pending slips from direct children
router.get('/review-queue', authenticateToken, async (req, res) => {
  try {
    const { id: reviewerId, role } = req.user;

    if (role === 'subagent') {
      return res.json({ success: true, data: [] });
    }

    const result = await db.query(
      `SELECT bsr.id, bsr.submitted_by AS "submittedById",
              u.full_name AS "submittedByName", u.role AS "submittedByRole",
              bsr.amount, bsr.bank_name AS "bankName", bsr.bank_slip_url AS "slipUrl",
              bsr.status, bsr.reject_reason AS "rejectReason",
              bsr.submitted_at AS "submittedAt", bsr.transaction_id AS "transactionId"
       FROM bank_slip_requests bsr
       JOIN users u ON u.id = bsr.submitted_by
       WHERE u.parent_id = $1 AND bsr.status = 'pending'
       ORDER BY bsr.submitted_at ASC`,
      [reviewerId]
    );

    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        submittedById: r.submittedById,
        submittedByName: r.submittedByName,
        submittedByRole: r.submittedByRole,
        amount: parseFloat(r.amount),
        bankName: r.bankName || undefined,
        slipUrl: r.slipUrl,
        status: r.status,
        rejectReason: r.rejectReason || undefined,
        submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
        transactionId: r.transactionId || undefined,
      })),
    });
  } catch (err) {
    console.error('Review queue error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch review queue.' });
  }
});

// PATCH /bank-slips/:id/review — approve or reject
router.patch(
  '/:id/review',
  authenticateToken,
  [
    param('id').isUUID().withMessage('Invalid slip ID.'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject.'),
    body('reason').custom((value, { req }) => {
      if (req.body.action === 'reject' && (!value || !value.trim())) {
        throw new Error('A reason is required when rejecting.');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { id: slipId } = req.params;
      const { action, reason } = req.body;
      const reviewerId = req.user.id;

      const slipResult = await client.query(
        `SELECT bsr.*, u.parent_id AS "submitterParentId"
         FROM bank_slip_requests bsr
         JOIN users u ON u.id = bsr.submitted_by
         WHERE bsr.id = $1`,
        [slipId]
      );

      if (slipResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Slip not found.' });
      }

      const slip = slipResult.rows[0];

      if (slip.submitterParentId !== reviewerId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You can only review slips from your direct recruits.' });
      }

      if (slip.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, code: 'ALREADY_REVIEWED', message: `This slip has already been ${slip.status}.` });
      }

      let transactionId = null;

      if (action === 'approve') {
        const txResult = await client.query(
          `INSERT INTO transactions (user_id, type, amount, recorded_by, transaction_date)
           VALUES ($1, 'deposit', $2, $3, NOW())
           RETURNING id`,
          [slip.submitted_by, parseFloat(slip.amount), reviewerId]
        );
        transactionId = txResult.rows[0].id;

        await calculate(transactionId, client);

        await client.query(
          `UPDATE bank_slip_requests
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), transaction_id = $2
           WHERE id = $3`,
          [reviewerId, transactionId, slipId]
        );

        await client.query(
          `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
           VALUES ($1, 'SLIP_APPROVED', $2, $3)`,
          [reviewerId, slip.submitted_by, JSON.stringify({ slipId, transactionId, amount: slip.amount })]
        );
      } else {
        await client.query(
          `UPDATE bank_slip_requests
           SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), reject_reason = $2
           WHERE id = $3`,
          [reviewerId, reason.trim(), slipId]
        );

        await client.query(
          `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
           VALUES ($1, 'SLIP_REJECTED', $2, $3)`,
          [reviewerId, slip.submitted_by, JSON.stringify({ slipId, reason: reason.trim() })]
        );
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        data: {
          slipId,
          action,
          transactionId: transactionId || undefined,
          message: action === 'approve'
            ? 'Slip approved. Transaction and commissions recorded.'
            : 'Slip rejected.',
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Review slip error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to review slip.' });
    } finally {
      client.release();
    }
  }
);

function formatSlip(r) {
  return {
    id: r.id,
    amount: parseFloat(r.amount),
    bankName: r.bankName || undefined,
    slipUrl: r.slipUrl,
    status: r.status,
    rejectReason: r.rejectReason || undefined,
    submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    reviewedByName: r.reviewedByName || undefined,
    transactionId: r.transactionId || undefined,
  };
}

module.exports = router;
