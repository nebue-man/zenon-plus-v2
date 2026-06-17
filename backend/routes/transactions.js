const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { buildTransactionFilters } = require('../utils/transactionUtils');
const { calculate } = require('../utils/commissionEngine');
const { saveIdPhoto } = require('../utils/uploadHandler');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /transactions
router.get(
  '/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).withMessage(`limit must be 1-${MAX_LIMIT}.`),
    query('type').optional().isIn(['deposit', 'withdrawal']).withMessage('type must be deposit or withdrawal.'),
    query('date_from').optional().isISO8601().withMessage('date_from must be ISO 8601.'),
    query('date_to').optional().isISO8601().withMessage('date_to must be ISO 8601.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id: userId, role } = req.user;
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || DEFAULT_LIMIT, 10), MAX_LIMIT);
      const offset = (page - 1) * limit;

      let baseWhere;
      const params = [];

      if (role === 'admin') {
        baseWhere = 'WHERE 1=1';
      } else if (role === 'manager' || role === 'agent') {
        baseWhere = `WITH RECURSIVE downline AS (
          SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
          UNION ALL
          SELECT u.id FROM users u INNER JOIN downline d ON u.parent_id = d.id WHERE u.is_deleted = false
        )`;
        params.push(userId);
      } else {
        baseWhere = 'WHERE t.user_id = $1';
        params.push(userId);
      }

      let countQuery, dataQuery;
      const { whereClause, params: filteredParams } = buildTransactionFilters(req.query, role !== 'subagent' ? '' : '', params);

      if (role === 'admin') {
        const { whereClause: wc, params: fp } = buildTransactionFilters(req.query, 'WHERE 1=1', []);
        const countResult = await db.query(
          `SELECT COUNT(*) FROM transactions t JOIN users u ON t.user_id = u.id ${wc}`,
          fp
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const dataResult = await db.query(
          `SELECT t.id, t.user_id AS "userId", u.full_name AS "userName", u.role AS "userRole",
                  t.type, t.amount, t.transaction_date AS date, t.recorded_by AS "recordedBy",
                  cb.full_name AS "recordedByName", t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url"
           FROM transactions t
           JOIN users u ON t.user_id = u.id
           LEFT JOIN users cb ON cb.id = t.recorded_by
           ${wc}
           ORDER BY t.transaction_date DESC
           LIMIT $${fp.length + 1} OFFSET $${fp.length + 2}`,
          [...fp, limit, offset]
        );

        return res.json({
          success: true,
          data: {
            transactions: dataResult.rows.map((t) => formatTransaction(t, role)),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
          },
        });
      }

      if (role === 'manager' || role === 'agent') {
        const { whereClause: wc, params: fp } = buildTransactionFilters(req.query, 'WHERE t.user_id IN (SELECT id FROM downline) OR t.user_id = $1', [userId]);
        const countResult = await db.query(
          `WITH RECURSIVE downline AS (
             SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
             UNION ALL
             SELECT u.id FROM users u INNER JOIN downline d ON u.parent_id = d.id WHERE u.is_deleted = false
           )
           SELECT COUNT(*) FROM transactions t JOIN users u ON t.user_id = u.id ${wc}`,
          fp
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const dataResult = await db.query(
          `WITH RECURSIVE downline AS (
             SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
             UNION ALL
             SELECT u.id FROM users u INNER JOIN downline d ON u.parent_id = d.id WHERE u.is_deleted = false
           )
           SELECT t.id, t.user_id AS "userId", u.full_name AS "userName", u.role AS "userRole",
                  t.type, t.amount, t.transaction_date AS date, t.recorded_by AS "recordedBy",
                  cb.full_name AS "recordedByName", t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url"
           FROM transactions t
           JOIN users u ON t.user_id = u.id
           LEFT JOIN users cb ON cb.id = t.recorded_by
           ${wc}
           ORDER BY t.transaction_date DESC
           LIMIT $${fp.length + 1} OFFSET $${fp.length + 2}`,
          [...fp, limit, offset]
        );

        return res.json({
          success: true,
          data: {
            transactions: dataResult.rows.map((t) => formatTransaction(t, role)),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
          },
        });
      }

      // Subagent — own transactions only
      const { whereClause: wc, params: fp } = buildTransactionFilters(req.query, 'WHERE t.user_id = $1', [userId]);
      const countResult = await db.query(
        `SELECT COUNT(*) FROM transactions t JOIN users u ON t.user_id = u.id ${wc}`,
        fp
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `SELECT t.id, t.user_id AS "userId", u.full_name AS "userName", u.role AS "userRole",
                t.type, t.amount, t.transaction_date AS date, t.player_id AS "player_id"
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         ${wc}
         ORDER BY t.transaction_date DESC
         LIMIT $${fp.length + 1} OFFSET $${fp.length + 2}`,
        [...fp, limit, offset]
      );

      return res.json({
        success: true,
        data: {
          transactions: dataResult.rows.map((t) => formatTransaction(t, role)),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
      });
    } catch (err) {
      console.error('List transactions error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch transactions.' });
    }
  }
);

// POST /transactions
router.post(
  '/',
  authenticateToken,
  [
    body('type').isIn(['deposit', 'withdrawal']).withMessage('type must be deposit or withdrawal.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a positive number.'),
    body('date').optional().isISO8601().withMessage('date must be a valid ISO 8601 date.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { type, amount, date, withdrawal_details, player_id, bank_slip } = req.body;
      const userId = req.user.id;

      let bankSlipUrl = null;
      if (type === 'deposit' && bank_slip) {
        bankSlipUrl = await saveIdPhoto(bank_slip);
      }

      const txResult = await client.query(
        `INSERT INTO transactions (user_id, type, amount, recorded_by, transaction_date, withdrawal_details, player_id, bank_slip_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [userId, type, parseFloat(amount), userId, date ? new Date(date) : new Date(), withdrawal_details ? JSON.stringify(withdrawal_details) : null, player_id || null, bankSlipUrl]
      );

      const transactionId = txResult.rows[0].id;
      await calculate(transactionId, client);

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        data: { transactionId, message: 'Transaction recorded successfully.' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create transaction error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to create transaction.' });
    } finally {
      client.release();
    }
  }
);

// GET /transactions/:id
router.get(
  '/:id',
  authenticateToken,
  [param('id').isUUID().withMessage('Invalid transaction ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { id: userId, role } = req.user;
      const { id: txId } = req.params;

      const result = await db.query(
        `SELECT t.id, t.user_id AS "userId", u.full_name AS "userName", u.role AS "userRole",
                t.type, t.amount, t.transaction_date AS date, t.recorded_by AS "recordedBy",
                cb.full_name AS "recordedByName", t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url"
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users cb ON cb.id = t.recorded_by
         WHERE t.id = $1`,
        [txId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Transaction not found.' });
      }

      const tx = result.rows[0];

      // Access control: admin sees all; others must own or have in downline
      if (role !== 'admin') {
        if (tx.userId !== userId) {
          const inDownlineResult = await db.query(
            `WITH RECURSIVE downline AS (
               SELECT id FROM users WHERE parent_id = $1 AND is_deleted = false
               UNION ALL
               SELECT u.id FROM users u INNER JOIN downline d ON u.parent_id = d.id WHERE u.is_deleted = false
             )
             SELECT 1 FROM downline WHERE id = $2`,
            [userId, tx.userId]
          );
          if (inDownlineResult.rows.length === 0) {
            return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Access denied.' });
          }
        }
      }

      // Fetch associated commissions
      const commResult = await db.query(
        `SELECT c.id, c.beneficiary_id AS "beneficiaryId", u.full_name AS "beneficiaryName",
                c.commission_type AS type, c.percentage, c.amount
         FROM commissions c
         JOIN users u ON u.id = c.beneficiary_id
         WHERE c.transaction_id = $1 AND c.commission_type != 'agent_locked'`,
        [txId]
      );

      return res.json({
        success: true,
        data: {
          ...formatTransaction(tx, role),
          commissions: commResult.rows.map((c) => ({
            id: c.id,
            beneficiaryId: c.beneficiaryId,
            beneficiaryName: c.beneficiaryName,
            type: c.type,
            percentage: parseFloat(c.percentage),
            amount: parseFloat(c.amount),
          })),
        },
      });
    } catch (err) {
      console.error('Get transaction error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch transaction.' });
    }
  }
);

function formatTransaction(t, role) {
  const result = {
    id: t.id,
    userId: t.userId,
    userName: t.userName,
    userRole: t.userRole,
    type: t.type,
    amount: parseFloat(t.amount),
    date: t.date ? new Date(t.date).toISOString() : null,
    recordedBy: t.recordedBy || undefined,
    recordedByName: t.recordedByName || undefined,
    player_id: t.player_id || undefined,
  };
  if (role === 'admin') {
    result.bank_slip_url = t.bank_slip_url || undefined;
  }
  return result;
}

module.exports = router;
