const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, param } = require('express-validator');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { saveIdPhoto, upload } = require('../utils/uploadHandler');

const SALT_ROUNDS = 12;
const JWT_EXPIRY = '8h';
const INVITE_EXPIRY_DAYS = 7;

const ROLE_MAP = { admin: 'manager', manager: 'agent', agent: 'subagent', subagent: 'subagent', direct_agent: 'subagent' };
const CAPACITY_LIMITS = { admin: 10, manager: 5, agent: 10, subagent: 10, direct_agent: 10 };

function generateToken(user) {
  return jwt.sign(
    { user_id: user.id, role: user.role, parent_id: user.parent_id || null },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function formatUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email || undefined,
    phone_number: u.phone_number || undefined,
    dob: u.date_of_birth ? new Date(u.date_of_birth).toISOString().split('T')[0] : undefined,
    role: u.role,
    status: u.verification_status,
    parentId: u.parent_id || undefined,
    parentName: u.parent_name || undefined,
    childrenCount: parseInt(u.children_count || 0, 10),
    joinedAt: u.created_at ? new Date(u.created_at).toISOString() : null,
    idPhoto: u.id_photo_url || undefined,
    promo_screenshot_url: u.promo_screenshot_url || undefined,
    rejectReason: u.reject_reason || undefined,
  };
}

function validatePhone(phone) {
  if (!phone || !phone.trim()) return false;
  if (!/^[+\d\s\-]+$/.test(phone.trim())) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isAtLeast18(dobString) {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 18;
}

async function validateInviteToken(token) {
  const result = await db.query(
    `SELECT il.*, u.full_name AS creator_name, u.role AS creator_role
     FROM invite_links il
     JOIN users u ON u.id = il.created_by
     WHERE il.token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'Invalid invite link.' };
  }

  const link = result.rows[0];

  if (link.is_used) {
    return { valid: false, reason: 'This invite link has already been used.' };
  }
  if (!link.is_active) {
    return { valid: false, reason: 'This invite link has been deactivated.' };
  }
  if (new Date(link.expires_at) < new Date()) {
    return { valid: false, reason: 'This invite link has expired. Ask your manager to generate a new one.' };
  }

  return { valid: true, link };
}

// POST /auth/signup — Admin registration
router.post(
  '/signup',
  [
    body('fullName').notEmpty().withMessage('Full name is required.').trim(),
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('dob').notEmpty().withMessage('Date of birth is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fullName, email, dob, password, phoneNumber } = req.body;

      if (!isAtLeast18(dob)) {
        return res.status(400).json({ success: false, code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old.' });
      }

      if (!validatePhone(phoneNumber)) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Please enter a valid phone number.' });
      }

      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const result = await db.query(
        `INSERT INTO users (full_name, email, phone_number, date_of_birth, password_hash, role, verification_status)
         VALUES ($1, $2, $3, $4, $5, 'admin', 'approved')
         RETURNING id, full_name, role, parent_id`,
        [fullName, email, phoneNumber.trim(), dob, passwordHash]
      );

      const user = result.rows[0];
      const token = generateToken(user);

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'admin_signup', $1, $2)`,
        [user.id, JSON.stringify({ email })]
      );

      return res.status(201).json({
        success: true,
        data: { token, user_id: user.id, role: user.role, full_name: user.full_name },
      });
    } catch (err) {
      console.error('Signup error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Registration failed. Please try again.' });
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Identifier is required.').trim(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { identifier, password } = req.body;

      const result = await db.query(
        `SELECT id, full_name, email, password_hash, role, parent_id, verification_status, reject_reason, is_deleted
         FROM users WHERE (full_name = $1 OR id::text = $1) AND is_deleted = false`,
        [identifier]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
      }

      const user = result.rows[0];

      if (user.verification_status === 'pending') {
        return res.status(403).json({ success: false, code: 'ACCOUNT_PENDING', message: 'Your account is pending verification.' });
      }

      if (user.verification_status === 'rejected') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_REJECTED',
          message: 'Your account has been rejected.',
          data: { rejectReason: user.reject_reason },
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
      }

      const token = generateToken(user);

      return res.json({
        success: true,
        data: { token, user_id: user.id, role: user.role, full_name: user.full_name, parent_id: user.parent_id },
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Login failed.' });
    }
  }
);

// POST /auth/register — Token-based invite registration
router.post(
  '/register',
  [
    body('fullName').notEmpty().withMessage('Full name is required.').trim(),
    body('dob').notEmpty().withMessage('Date of birth is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) throw new Error('Passwords do not match.');
      return true;
    }),
    body('token').notEmpty().withMessage('Invite token is required.'),
    body('promoScreenshot').notEmpty().withMessage('Promo code screenshot is required.'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fullName, dob, password, token, promoScreenshot, phoneNumber } = req.body;

      if (!isAtLeast18(dob)) {
        return res.status(400).json({ success: false, code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old.' });
      }

      if (!validatePhone(phoneNumber)) {
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Please enter a valid phone number.' });
      }

      const { valid, reason, link } = await validateInviteToken(token);
      if (!valid) {
        return res.status(400).json({ success: false, code: 'INVITE_INVALID', message: reason });
      }

      const parentId = link.created_by;
      const childRole = link.intended_role;

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const screenshotUrl = await saveIdPhoto(promoScreenshot);

      const result = await db.query(
        `INSERT INTO users (full_name, phone_number, date_of_birth, password_hash, role, parent_id, verification_status, promo_screenshot_url)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING id, full_name, role`,
        [fullName, phoneNumber.trim(), dob, passwordHash, childRole, parentId, screenshotUrl]
      );

      const newUser = result.rows[0];

      // Mark invite as used
      await db.query(
        `UPDATE invite_links SET is_used = true, used_by = $1, used_at = NOW() WHERE token = $2`,
        [newUser.id, token]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'INVITE_USED', $2, $3)`,
        [newUser.id, newUser.id, JSON.stringify({ token, parent_id: parentId, role: childRole })]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'user_registered', $2, $3)`,
        [parentId, newUser.id, JSON.stringify({ childRole, parentName: link.creator_name })]
      );

      return res.status(201).json({
        success: true,
        data: {
          user_id: newUser.id,
          message: `Registration submitted. ${link.creator_name} will review your details.`,
          parent_name: link.creator_name,
        },
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Registration failed.' });
    }
  }
);

// GET /auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone_number, u.date_of_birth, u.role, u.verification_status,
              u.parent_id, u.id_photo_url, u.promo_screenshot_url, u.reject_reason, u.created_at,
              p.full_name AS parent_name,
              (SELECT COUNT(*) FROM users c WHERE c.parent_id = u.id AND c.is_deleted = false) AS children_count
       FROM users u
       LEFT JOIN users p ON p.id = u.parent_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
    }

    return res.json({ success: true, data: formatUser(result.rows[0]) });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch profile.' });
  }
});

// GET /auth/parent-info/:parentId — Public (kept for backwards compatibility)
router.get(
  '/parent-info/:parentId',
  [param('parentId').isUUID().withMessage('Invalid parent ID.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, full_name, role FROM users WHERE id = $1 AND is_deleted = false AND verification_status = $2',
        [req.params.parentId, 'approved']
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Inviter not found or not active.' });
      }

      const u = result.rows[0];
      return res.json({ success: true, data: { id: u.id, fullName: u.full_name, role: u.role } });
    } catch (err) {
      console.error('Parent info error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch parent info.' });
    }
  }
);

// PATCH /auth/verify/:userId
router.patch(
  '/verify/:userId',
  authenticateToken,
  [
    param('userId').isUUID().withMessage('Invalid user ID.'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject.'),
    body('reason').custom((value, { req }) => {
      if (req.body.action === 'reject' && (!value || !value.trim())) {
        throw new Error('Rejection reason is required.');
      }
      return true;
    }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { action, reason } = req.body;
      const requesterId = req.user.id;
      const requesterRole = req.user.role;

      const targetResult = await db.query(
        'SELECT id, full_name, parent_id, role, verification_status FROM users WHERE id = $1 AND is_deleted = false',
        [userId]
      );
      if (targetResult.rows.length === 0) {
        return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });
      }

      const target = targetResult.rows[0];

      if (requesterRole !== 'admin' && target.parent_id !== requesterId) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You can only verify your own direct recruits.' });
      }

      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await db.query(
        `UPDATE users SET verification_status = $1, verified_by = $2, reject_reason = $3, updated_at = NOW()
         WHERE id = $4`,
        [newStatus, requesterId, action === 'reject' ? reason.trim() : null, userId]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, $2, $3, $4)`,
        [requesterId, `verification_${newStatus}`, userId, JSON.stringify({ reason: reason || null })]
      );

      return res.json({
        success: true,
        data: { userId, status: newStatus, message: `User has been ${newStatus}.` },
      });
    } catch (err) {
      console.error('Verify error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Verification failed.' });
    }
  }
);

// PATCH /auth/resubmit-id
router.patch(
  '/resubmit-id',
  authenticateToken,
  [body('idPhoto').notEmpty().withMessage('ID photo is required.')],
  handleValidationErrors,
  async (req, res) => {
    try {
      if (req.user.verification_status !== 'rejected') {
        return res.status(400).json({ success: false, code: 'INVALID_STATUS', message: 'You can only resubmit when your status is rejected.' });
      }

      const photoUrl = await saveIdPhoto(req.body.idPhoto);

      await db.query(
        `UPDATE users SET id_photo_url = $1, verification_status = 'pending', reject_reason = NULL, updated_at = NOW()
         WHERE id = $2`,
        [photoUrl, req.user.id]
      );

      await db.query(
        `INSERT INTO audit_logs (actor_id, action, target_id) VALUES ($1, 'id_resubmitted', $1)`,
        [req.user.id]
      );

      return res.json({ success: true, data: { message: 'ID photo resubmitted for review.' } });
    } catch (err) {
      console.error('Resubmit ID error:', err);
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Resubmission failed.' });
    }
  }
);

// ─────────────────────────────────────────────
// INVITE LINK ENDPOINTS
// ─────────────────────────────────────────────

// POST /auth/invite/generate — Generate a new invite link
router.post('/invite/generate', authenticateToken, async (req, res) => {
  try {
    const creator = req.user;

    if (creator.verification_status !== 'approved') {
      return res.status(403).json({ success: false, code: 'NOT_APPROVED', message: 'Your account must be approved to generate invite links.' });
    }

    const intendedRole = ROLE_MAP[creator.role];
    const max = CAPACITY_LIMITS[creator.role];

    // Count current direct children
    const countResult = await db.query(
      'SELECT COUNT(*) FROM users WHERE parent_id = $1 AND is_deleted = false',
      [creator.id]
    );
    const current = parseInt(countResult.rows[0].count, 10);

    if (current >= max) {
      return res.status(400).json({
        success: false,
        code: 'CAPACITY_REACHED',
        message: `You have reached the maximum number of ${intendedRole}s. Current: ${current} / Max: ${max}`,
        data: { current, max },
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const inviteUrl = `${process.env.FRONTEND_URL}/register?token=${token}`;

    await db.query(
      `INSERT INTO invite_links (token, created_by, intended_role, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, creator.id, intendedRole, expiresAt]
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'INVITE_GENERATED', $1, $2)`,
      [creator.id, JSON.stringify({ intended_role: intendedRole, expires_at: expiresAt })]
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        invite_url: inviteUrl,
        intended_role: intendedRole,
        expires_at: expiresAt.toISOString(),
        capacity: { current, max },
      },
    });
  } catch (err) {
    console.error('Generate invite error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to generate invite link.' });
  }
});

// GET /auth/invite/validate/:token — Public token validation
router.get('/invite/validate/:token', async (req, res) => {
  try {
    const { valid, reason, link } = await validateInviteToken(req.params.token);

    if (!valid) {
      return res.status(400).json({ success: false, code: 'INVITE_INVALID', message: reason });
    }

    return res.json({
      success: true,
      data: {
        token: link.token,
        intended_role: link.intended_role,
        creator: { full_name: link.creator_name, role: link.creator_role },
        expires_at: link.expires_at,
        is_valid: true,
      },
    });
  } catch (err) {
    console.error('Validate invite error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to validate invite link.' });
  }
});

// GET /auth/invite/info/:token — Public, returns pre-fill info for Register page
router.get('/invite/info/:token', async (req, res) => {
  try {
    const { valid, reason, link } = await validateInviteToken(req.params.token);

    if (!valid) {
      return res.json({
        success: true,
        data: { is_valid: false, reason },
      });
    }

    return res.json({
      success: true,
      data: {
        token: link.token,
        intended_role: link.intended_role,
        parent_name: link.creator_name,
        parent_role: link.creator_role,
        expires_at: link.expires_at,
        is_valid: true,
      },
    });
  } catch (err) {
    console.error('Invite info error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch invite info.' });
  }
});

// GET /auth/invite/my-invites — Protected, returns current user's invite links
router.get('/invite/my-invites', authenticateToken, async (req, res) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL;

    const result = await db.query(
      `SELECT il.id, il.token, il.intended_role, il.is_used, il.is_active,
              il.expires_at, il.created_at, il.used_at,
              ub.full_name AS used_by_name
       FROM invite_links il
       LEFT JOIN users ub ON ub.id = il.used_by
       WHERE il.created_by = $1
       ORDER BY il.created_at DESC`,
      [req.user.id]
    );

    const now = new Date();
    const invites = result.rows.map((row) => {
      let status;
      if (row.is_used) status = 'used';
      else if (new Date(row.expires_at) < now) status = 'expired';
      else if (!row.is_active) status = 'inactive';
      else status = 'active';

      return {
        id: row.id,
        token: row.token,
        invite_url: `${frontendUrl}/register?token=${row.token}`,
        intended_role: row.intended_role,
        is_used: row.is_used,
        is_active: row.is_active,
        expires_at: row.expires_at,
        created_at: row.created_at,
        used_by_name: row.used_by_name || null,
        used_at: row.used_at || null,
        status,
      };
    });

    return res.json({ success: true, data: { invites } });
  } catch (err) {
    console.error('My invites error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to fetch invite links.' });
  }
});

// PATCH /auth/invite/deactivate/:token — Protected, creator or admin only
router.patch('/invite/deactivate/:token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      'SELECT id, created_by, is_active FROM invite_links WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Invite link not found.' });
    }

    const link = result.rows[0];

    if (req.user.role !== 'admin' && link.created_by !== req.user.id) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You can only deactivate your own invite links.' });
    }

    await db.query(
      'UPDATE invite_links SET is_active = false WHERE token = $1',
      [token]
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'INVITE_DEACTIVATED', $1, $2)`,
      [req.user.id, JSON.stringify({ token })]
    );

    return res.json({ success: true, data: { token, is_active: false } });
  } catch (err) {
    console.error('Deactivate invite error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to deactivate invite link.' });
  }
});

// POST /auth/register/direct-agent — Public, no invite token required
router.post('/register/direct-agent', upload.single('promo_screenshot'), async (req, res) => {
  try {
    const { full_name, date_of_birth, password, confirm_password, phone_number } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Full name is required.' });
    }
    if (!date_of_birth) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Date of birth is required.' });
    }
    if (!isAtLeast18(date_of_birth)) {
      return res.status(400).json({ success: false, code: 'AGE_RESTRICTION', message: 'You must be at least 18 years old.' });
    }
    if (!validatePhone(phone_number)) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Please enter a valid phone number.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Passwords do not match.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Promo code screenshot is required.' });
    }

    const adminResult = await db.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_deleted = false LIMIT 1"
    );
    if (adminResult.rows.length === 0) {
      return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'No admin found. Please contact support.' });
    }
    const adminId = adminResult.rows[0].id;

    let screenshotUrl;
    if (req.file.path && req.file.path.startsWith('http')) {
      screenshotUrl = req.file.path;
    } else if (req.file.secure_url) {
      screenshotUrl = req.file.secure_url;
    } else if (req.file.filename) {
      screenshotUrl = `/uploads/${req.file.filename}`;
    } else {
      screenshotUrl = req.file.path;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await db.query(
      `INSERT INTO users (full_name, phone_number, date_of_birth, password_hash, role, parent_id, verification_status, promo_screenshot_url)
       VALUES ($1, $2, $3, $4, 'direct_agent', $5, 'pending', $6)
       RETURNING id, full_name, role`,
      [full_name.trim(), phone_number.trim(), date_of_birth, passwordHash, adminId, screenshotUrl]
    );

    const newUser = result.rows[0];

    await db.query(
      `INSERT INTO notifications (recipient_id, sender_id, type, title, message, transaction_id)
       SELECT id, $1, 'direct_agent_pending', 'New Direct Agent Registration',
              $2, NULL
       FROM users WHERE role = 'admin' AND is_deleted = false`,
      [newUser.id, `A new Direct Agent ${full_name.trim()} has registered and is awaiting your approval. Please review their promo code screenshot.`]
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_id, metadata) VALUES ($1, 'DIRECT_AGENT_REGISTERED', $1, $2)`,
      [newUser.id, JSON.stringify({ full_name: full_name.trim(), admin_id: adminId })]
    );

    return res.status(201).json({
      success: true,
      data: {
        user_id: newUser.id,
        message: 'Registration submitted. Your account is pending Admin approval. You will be notified once approved.',
      },
    });
  } catch (err) {
    console.error('Direct agent register error:', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Registration failed. Please try again.' });
  }
});

module.exports = router;
