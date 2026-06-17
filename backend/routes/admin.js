const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { buildTransactionFilters } = require('../utils/transactionUtils');
const { calculate } = require('../utils/commissionEngine');
const { getSystemStats } = require('../utils/dashboardQueries');

const adminOnly = [authenticateToken, authorizeRoles('admin')];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// GET /admin/users
router.get(
  '/users',
  ...adminOnly,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
    query('role').optional().isIn(['manager', 'agent', 'subagent']),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('search').optional().isString().trim(),
    query('include_deleted').optional().isIn(['true', 'false']),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || DEFAULT_LIMIT, 10), MAX_LIMIT);
      const offset = (page - 1) * limit;
      const includeDeleted = req.query.include_deleted === 'true';
      const adminId = req.user.id;

      const cte = `WITH RECURSIVE my_hierarchy AS (
        SELECT id FROM users WHERE parent_id = $1
        UNION ALL
        SELECT u.id FROM users u INNER JOIN my_hierarchy h ON u.parent_id = h.id
      )`;
      const params = [adminId];
      let whereClause = includeDeleted
        ? 'WHERE u.id IN (SELECT id FROM my_hierarchy)'
        : 'WHERE u.is_deleted = false AND u.id IN (SELECT id FROM my_hierarchy)';
      let paramIndex = 2;

      if (req.query.role) {
        whereClause += ` AND u.role = $${paramIndex++}`;
        params.push(req.query.role);
      }
      if (req.query.status) {
        whereClause += ` AND u.verification_status = $${paramIndex++}`;
        params.push(req.query.status);
      }
      if (req.query.search) {
        whereClause += ` AND (u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.id::text ILIKE $${paramIndex})`;
        params.push(`%${req.query.search}%`);
        paramIndex++;
      }

      const countResult = await db.query(
        `${cte} SELECT COUNT(*) FROM users u ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `${cte}
         SELECT u.id, u.full_name AS "fullName", u.email, u.role, u.verification_status AS status,
                u.parent_id AS "parentId",
                CASE WHEN u.role = 'manager' THEN NULL ELSE p.full_name END AS "parentName",
                u.created_at AS "joinedAt", u.is_deleted AS "isDeleted", u.reject_reason AS "rejectReason",
                (SELECT COUNT(*) FROM users c WHERE c.parent_id = u.id AND c.is_deleted = false) AS "childrenCount"
         FROM users u
         LEFT JOIN users p ON p.id = u.parent_id
         ${whereClause}
         ORDER BY u.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const users = dataResult.rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email || undefined,
        role: u.role,
        status: u.status,
        parentId: u.parentId || undefined,
        parentName: u.parentName || undefined,
        joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : null,
        isDeleted: u.isDeleted,
        rejectReason: u.rejectReason || undefined,
        childrenCount: parseInt(u.childrenCount || 0, 10),
      }));

      return res.json({
        success: true,
        data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      });
    } catch (err) {
      console.error('Admin list users error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch users.' });
    }
  }
);

const hierarchyCTE = `WITH RECURSIVE my_hierarchy AS (
  SELECT id FROM users WHERE parent_id = $1
  UNION ALL
  SELECT u.id FROM users u INNER JOIN my_hierarchy h ON u.parent_id = h.id
)`;

async function inHierarchy(adminId, targetId) {
  const r = await db.query(
    `${hierarchyCTE} SELECT 1 FROM my_hierarchy WHERE id = $2`,
    [adminId, targetId]
  );
  return r.rows.length > 0;
}

// GET /admin/users/:userId
router.get(
  '/users/:userId',
  ...adminOnly,
  [param('userId').isUUID().withMessage('Invalid user ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!(await inHierarchy(req.user.id, req.params.userId))) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const result = await db.query(
        `SELECT u.id, u.full_name AS "fullName", u.email, u.date_of_birth AS dob,
                u.role, u.verification_status AS status, u.parent_id AS "parentId",
                CASE WHEN u.role = 'manager' THEN NULL ELSE p.full_name END AS "parentName",
                u.id_photo_url AS "idPhoto",
                u.promo_screenshot_url AS "promo_screenshot_url",
                u.reject_reason AS "rejectReason", u.created_at AS "joinedAt", u.is_deleted AS "isDeleted",
                (SELECT COUNT(*) FROM users c WHERE c.parent_id = u.id AND c.is_deleted = false) AS "childrenCount"
         FROM users u
         LEFT JOIN users p ON p.id = u.parent_id
         WHERE u.id = $1`,
        [req.params.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const u = result.rows[0];
      return res.json({
        success: true,
        data: {
          id: u.id,
          fullName: u.fullName,
          email: u.email || undefined,
          dob: u.dob ? new Date(u.dob).toISOString().split('T')[0] : undefined,
          role: u.role,
          status: u.status,
          parentId: u.parentId || undefined,
          parentName: u.parentName || undefined,
          idPhoto: u.idPhoto || undefined,
          promo_screenshot_url: u.promo_screenshot_url || undefined,
          rejectReason: u.rejectReason || undefined,
          joinedAt: u.joinedAt ? new Date(u.joinedAt).toISOString() : null,
          isDeleted: u.isDeleted,
          childrenCount: parseInt(u.childrenCount || 0, 10),
        },
      });
    } catch (err) {
      console.error('Admin get user error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch user.' });
    }
  }
);

// PATCH /admin/users/:userId
router.patch(
  '/users/:userId',
  ...adminOnly,
  [
    param('userId').isUUID().withMessage('Invalid user ID.'),
    body('status').optional().isIn(['approved', 'rejected', 'pending']),
    body('reason').optional().isString().trim(),
    body('role').optional().isIn(['admin', 'manager', 'agent', 'subagent']),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, reason, role } = req.body;

      if (!(await inHierarchy(req.user.id, userId))) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (status !== undefined) {
        updates.push(`verification_status = $${paramIndex++}`);
        params.push(status);
        if (status === 'approved' || status === 'rejected') {
          updates.push(`verified_by = $${paramIndex++}`);
          params.push(req.user.id);
        }
        if (status === 'rejected' && reason) {
          updates.push(`reject_reason = $${paramIndex++}`);
          params.push(reason);
        } else if (status === 'approved') {
          updates.push(`reject_reason = NULL`);
        }
      }

      if (role !== undefined) {
        updates.push(`role = $${paramIndex++}`);
        params.push(role);
      }

      if (updates.length === 0) {
        return res.status(400).json({ success: false, code: 'NO_CHANGES', message: 'No fields to update.' });
      }

      updates.push(`updated_at = NOW()`);
      params.push(userId);

      await db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        params
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'admin_user_update', $2, $3)`,
        [req.user.id, userId, JSON.stringify({ status, role, reason })]
      );

      return res.json({ success: true, data: { userId, message: 'User updated.' } });
    } catch (err) {
      console.error('Admin update user error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to update user.' });
    }
  }
);

// DELETE /admin/users/:userId (soft delete)
router.delete(
  '/users/:userId',
  ...adminOnly,
  [param('userId').isUUID().withMessage('Invalid user ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (userId === req.user.id) {
        return res.status(400).json({ success: false, code: 'SELF_DELETE', message: 'You cannot delete your own account.' });
      }

      if (!(await inHierarchy(req.user.id, userId))) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const targetResult = await db.query(
        'SELECT id, is_deleted FROM users WHERE id = $1',
        [userId]
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }
      if (targetResult.rows[0].is_deleted) {
        return res.status(400).json({ success: false, code: 'ALREADY_DELETED', message: 'User is already deleted.' });
      }

      await db.query(
        'UPDATE users SET is_deleted = true, updated_at = NOW() WHERE id = $1',
        [userId]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id) VALUES ($1, 'admin_user_delete', $2)`,
        [req.user.id, userId]
      );

      return res.json({ success: true, data: { userId, message: 'User has been soft-deleted.' } });
    } catch (err) {
      console.error('Admin delete user error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to delete user.' });
    }
  }
);

// GET /admin/transactions
router.get(
  '/transactions',
  ...adminOnly,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
    query('type').optional().isIn(['deposit', 'withdrawal']),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
    query('search').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || DEFAULT_LIMIT, 10), MAX_LIMIT);
      const offset = (page - 1) * limit;

      const adminId = req.user.id;
      const cte = `WITH RECURSIVE my_hierarchy AS (
        SELECT id FROM users WHERE parent_id = $1
        UNION ALL
        SELECT u.id FROM users u INNER JOIN my_hierarchy h ON u.parent_id = h.id
      )`;
      const { whereClause, params } = buildTransactionFilters(
        req.query,
        'WHERE u.id IN (SELECT id FROM my_hierarchy)',
        [adminId]
      );

      const countResult = await db.query(
        `${cte} SELECT COUNT(*) FROM transactions t JOIN users u ON t.user_id = u.id ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `${cte}
         SELECT t.id, t.user_id AS "userId", u.full_name AS "userName", u.role AS "userRole",
                t.type, t.amount, t.transaction_date AS date,
                t.recorded_by AS "createdBy", cb.full_name AS "createdByName",
                t.player_id AS "player_id", t.bank_slip_url AS "bank_slip_url"
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users cb ON cb.id = t.recorded_by
         ${whereClause}
         ORDER BY t.transaction_date DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return res.json({
        success: true,
        data: {
          transactions: dataResult.rows.map((t) => ({
            id: t.id,
            userId: t.userId,
            userName: t.userName,
            userRole: t.userRole,
            type: t.type,
            amount: parseFloat(t.amount),
            date: t.date ? new Date(t.date).toISOString() : null,
            createdBy: t.createdBy || undefined,
            createdByName: t.createdByName || undefined,
            player_id: t.player_id || undefined,
            bank_slip_url: t.bank_slip_url || undefined,
          })),
          pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        },
      });
    } catch (err) {
      console.error('Admin list transactions error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch transactions.' });
    }
  }
);

// POST /admin/transactions/manual
router.post(
  '/transactions/manual',
  ...adminOnly,
  [
    body('userId').notEmpty().isUUID().withMessage('Valid userId is required.'),
    body('type').isIn(['deposit', 'withdrawal']).withMessage('type must be deposit or withdrawal.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('amount must be a positive number.'),
    body('date').optional().isISO8601().withMessage('date must be a valid ISO 8601 date.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const { userId: targetUserId, type, amount, date, withdrawal_details } = req.body;

      const targetResult = await client.query(
        'SELECT id, verification_status FROM users WHERE id = $1 AND is_deleted = false',
        [targetUserId]
      );
      if (targetResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'Target user not found.' });
      }

      const hierarchyCheck = await client.query(
        `${hierarchyCTE} SELECT 1 FROM my_hierarchy WHERE id = $2`,
        [req.user.id, targetUserId]
      );
      if (hierarchyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Target user is not in your hierarchy.' });
      }

      const txResult = await client.query(
        `INSERT INTO transactions (user_id, type, amount, recorded_by, transaction_date, withdrawal_details)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [targetUserId, type, parseFloat(amount), req.user.id, date ? new Date(date) : new Date(), withdrawal_details ? JSON.stringify(withdrawal_details) : null]
      );

      const transactionId = txResult.rows[0].id;
      await calculate(transactionId, client);

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'manual_transaction', $2, $3)`,
        [req.user.id, transactionId, JSON.stringify({ type, amount, userId: targetUserId })]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        success: true,
        data: { transactionId, message: 'Manual transaction recorded.' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Admin manual transaction error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to record manual transaction.' });
    } finally {
      client.release();
    }
  }
);

// GET /admin/commissions
router.get(
  '/commissions',
  ...adminOnly,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
    query('type').optional().isString(),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
    query('beneficiary_id').optional().isUUID(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || DEFAULT_LIMIT, 10), MAX_LIMIT);
      const offset = (page - 1) * limit;

      const adminId = req.user.id;
      const cte = `WITH RECURSIVE my_hierarchy AS (
        SELECT id FROM users WHERE parent_id = $1
        UNION ALL
        SELECT u.id FROM users u INNER JOIN my_hierarchy h ON u.parent_id = h.id
      )`;
      const params = [adminId, 'agent_locked'];
      let whereClause = 'WHERE c.commission_type != $2 AND b.id IN (SELECT id FROM my_hierarchy)';
      let paramIndex = 3;

      if (req.query.type) {
        whereClause += ` AND c.commission_type = $${paramIndex++}`;
        params.push(req.query.type);
      }
      if (req.query.beneficiary_id) {
        whereClause += ` AND c.beneficiary_id = $${paramIndex++}`;
        params.push(req.query.beneficiary_id);
      }
      if (req.query.date_from) {
        whereClause += ` AND c.created_at >= $${paramIndex++}`;
        params.push(req.query.date_from);
      }
      if (req.query.date_to) {
        whereClause += ` AND c.created_at <= $${paramIndex++}`;
        params.push(req.query.date_to + 'T23:59:59.999Z');
      }

      const countResult = await db.query(
        `${cte} SELECT COUNT(*) FROM commissions c JOIN users b ON b.id = c.beneficiary_id ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `${cte}
         SELECT c.id, c.transaction_id AS "transactionId", c.beneficiary_id AS "beneficiaryId",
                b.full_name AS "beneficiaryName", b.role AS "beneficiaryRole",
                c.source_user_id AS "sourceUserId", s.full_name AS "sourceName",
                c.commission_type AS type, c.percentage, c.amount, c.created_at AS date
         FROM commissions c
         JOIN users b ON b.id = c.beneficiary_id
         JOIN users s ON s.id = c.source_user_id
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const commissions = dataResult.rows.map((c) => ({
        id: c.id,
        transactionId: c.transactionId,
        beneficiaryId: c.beneficiaryId,
        beneficiaryName: c.beneficiaryName,
        beneficiaryRole: c.beneficiaryRole,
        sourceUserId: c.sourceUserId,
        sourceName: c.sourceName,
        type: c.type,
        percentage: parseFloat(c.percentage),
        amount: parseFloat(c.amount),
        date: c.date ? new Date(c.date).toISOString() : null,
      }));

      return res.json({
        success: true,
        data: { commissions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      });
    } catch (err) {
      console.error('Admin list commissions error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch commissions.' });
    }
  }
);

// GET /admin/audit-logs
router.get(
  '/audit-logs',
  ...adminOnly,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }),
    query('actor_id').optional().isUUID(),
    query('action').optional().isString(),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page || 1, 10);
      const limit = Math.min(parseInt(req.query.limit || DEFAULT_LIMIT, 10), MAX_LIMIT);
      const offset = (page - 1) * limit;

      const adminId = req.user.id;
      const cte = `WITH RECURSIVE my_hierarchy AS (
        SELECT id FROM users WHERE parent_id = $1
        UNION ALL
        SELECT u.id FROM users u INNER JOIN my_hierarchy h ON u.parent_id = h.id
      )`;
      const params = [adminId];
      let whereClause = 'WHERE (al.actor_id = $1 OR al.actor_id IN (SELECT id FROM my_hierarchy))';
      let paramIndex = 2;

      if (req.query.actor_id) {
        whereClause += ` AND al.actor_id = $${paramIndex++}`;
        params.push(req.query.actor_id);
      }
      if (req.query.action) {
        whereClause += ` AND al.action ILIKE $${paramIndex++}`;
        params.push(`%${req.query.action}%`);
      }
      if (req.query.date_from) {
        whereClause += ` AND al.created_at >= $${paramIndex++}`;
        params.push(req.query.date_from);
      }
      if (req.query.date_to) {
        whereClause += ` AND al.created_at <= $${paramIndex++}`;
        params.push(req.query.date_to + 'T23:59:59.999Z');
      }

      const countResult = await db.query(
        `${cte} SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const dataResult = await db.query(
        `${cte}
         SELECT al.id, al.actor_id AS "actorId", a.full_name AS "actorName",
                al.action, al.target_id AS "targetId", al.metadata, al.created_at AS date
         FROM audit_logs al
         JOIN users a ON a.id = al.actor_id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const logs = dataResult.rows.map((l) => ({
        id: l.id,
        actorId: l.actorId,
        actorName: l.actorName,
        action: l.action,
        targetId: l.targetId || undefined,
        metadata: l.metadata || undefined,
        date: l.date ? new Date(l.date).toISOString() : null,
      }));

      return res.json({
        success: true,
        data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      });
    } catch (err) {
      console.error('Admin audit logs error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch audit logs.' });
    }
  }
);

// GET /admin/system-stats
router.get('/system-stats', ...adminOnly, async (req, res) => {
  try {
    const data = await getSystemStats(req.user.id);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Admin system stats error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch system stats.' });
  }
});

module.exports = router;
