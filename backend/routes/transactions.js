const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { buildTransactionFilters } = require('../utils/transactionUtils');
const { calculate } = require('../utils/commissionEngine');

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
                  cb.full_name AS "recordedByName", t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url",
                  t.transaction_status AS "transaction_status"
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
                  cb.full_name AS "recordedByName", t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url",
                  t.transaction_status AS "transaction_status"
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
                t.type, t.amount, t.transaction_date AS date, t.player_id AS "player_id",
                t.transaction_status AS "transaction_status"
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

      const { type, amount, date, withdrawal_details, player_id } = req.body;
      const userId = req.user.id;

      const txResult = await client.query(
        `INSERT INTO transactions (user_id, type, amount, recorded_by, transaction_date, withdrawal_details, player_id, transaction_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING id, transaction_date`,
        [userId, type, parseFloat(amount), userId, date ? new Date(date) : new Date(), withdrawal_details ? JSON.stringify(withdrawal_details) : null, player_id || null]
      );

      const transactionId = txResult.rows[0].id;
      await calculate(transactionId, client);

      // Mark all commissions for this transaction as pending
      const commResult = await client.query(
        `UPDATE commissions SET commission_status = 'pending' WHERE transaction_id = $1 RETURNING id`,
        [transactionId]
      );
      const commissionsTriggered = commResult.rowCount;

      // Get user info for notification message
      const userInfoResult = await client.query(
        'SELECT full_name, role FROM users WHERE id = $1',
        [userId]
      );
      const userFullName = userInfoResult.rows[0]?.full_name || 'Unknown';
      const userRole = userInfoResult.rows[0]?.role || 'unknown';

      // Find admin in hierarchy
      const adminResult = await client.query(
        `WITH RECURSIVE chain AS (
           SELECT id, parent_id, role FROM users WHERE id = $1
           UNION ALL
           SELECT u.id, u.parent_id, u.role FROM users u JOIN chain c ON u.id = c.parent_id WHERE c.parent_id IS NOT NULL
         )
         SELECT id FROM chain WHERE role = 'admin' LIMIT 1`,
        [userId]
      );
      const adminId = adminResult.rows[0]?.id;

      // Build notification message and insert
      let notificationSent = false;
      if (adminId) {
        const txDateStr = new Date(txResult.rows[0].transaction_date).toLocaleDateString('en-LK');
        let notifType, notifTitle, notifMessage;
        if (type === 'deposit') {
          notifType = 'deposit_pending';
          notifTitle = 'New Deposit — Pending Approval';
          notifMessage = `User: ${userFullName} (${userRole})\nAmount: LKR ${parseFloat(amount).toFixed(2)}\nPlayer ID: ${player_id || 'Not provided'}\nDate: ${txDateStr}`;
        } else {
          const wd = withdrawal_details || {};
          notifType = 'withdrawal_pending';
          notifTitle = 'New Withdrawal — Pending Approval';
          notifMessage = `User: ${userFullName} (${userRole})\nAmount: LKR ${parseFloat(amount).toFixed(2)}\nWithdrawal Code: ${wd.withdrawal_code || 'N/A'}\nBank: ${wd.bank || 'N/A'}\nBranch: ${wd.branch || 'N/A'}\nAccount: ${wd.account_number || 'N/A'}\nDate: ${txDateStr}`;
        }
        await client.query(
          `INSERT INTO notifications (recipient_id, sender_id, transaction_id, type, title, message)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [adminId, userId, transactionId, notifType, notifTitle, notifMessage]
        );
        notificationSent = true;
      }

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        data: {
          transactionId,
          transaction_status: 'pending',
          commissions_triggered: commissionsTriggered,
          notification_sent: notificationSent,
          message: 'Transaction submitted and pending admin approval',
        },
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
                cb.full_name AS "recordedByName", t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url",
                t.transaction_status AS "transaction_status"
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
    transaction_status: t.transaction_status || 'pending',
  };
  if (role === 'admin') {
    result.bank_slip_url = t.bank_slip_url || undefined;
  }
  return result;
}

module.exports = router;
