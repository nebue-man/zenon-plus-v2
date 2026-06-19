const db = require('../database');
const { getAncestors } = require('./hierarchyUtils');

async function getRates(client) {
  const result = await client.query('SELECT rate_key, rate_value FROM commission_rates');
  const rates = {};
  for (const row of result.rows) {
    rates[row.rate_key] = parseFloat(row.rate_value);
  }
  return rates;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function calculate(transactionId, dbClient) {
  const client = dbClient || db;
  const commissions = [];

  const txResult = await client.query(
    'SELECT t.*, u.role, u.parent_id FROM transactions t JOIN users u ON t.user_id = u.id WHERE t.id = $1',
    [transactionId]
  );
  if (txResult.rows.length === 0) return commissions;

  const tx = txResult.rows[0];
  const actor = { id: tx.user_id, role: tx.role, parent_id: tx.parent_id };
  const amount = parseFloat(tx.amount);
  const txDate = tx.transaction_date ? new Date(tx.transaction_date) : new Date();
  const year = txDate.getFullYear();
  const month = txDate.getMonth() + 1;
  const isDeposit = tx.type === 'deposit';

  const rates = await getRates(client);
  const ancestors = await getAncestors(actor.id, client);
  const ancestorChain = ancestors.slice(1);

  const insertCommission = async (beneficiaryId, percentage, commAmount, commType) => {
    if (commAmount === 0 && commType !== 'agent_locked') return;
    const rounded = round2(commAmount);
    const result = await client.query(
      `INSERT INTO commissions (transaction_id, beneficiary_id, source_user_id, percentage, amount, commission_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [transactionId, beneficiaryId, actor.id, percentage, rounded, commType]
    );
    commissions.push(result.rows[0]);
  };

  // Actor always earns own commission: 3% on deposit, 1% on withdrawal
  const actorRate = isDeposit ? rates['actor_own_commission_deposit'] : rates['actor_own_commission_withdrawal'];
  await insertCommission(actor.id, actorRate, round2(amount * actorRate), isDeposit ? 'actor_deposit' : 'actor_withdrawal');

  const adminAncestor = ancestorChain.find((a) => a.role === 'admin');

  if (actor.role === 'manager') {
    // Rule Set 1: Manager actor — admin earns 2%/1%
    if (adminAncestor) {
      const adminRate = isDeposit ? rates['admin_deposit_from_manager'] : rates['admin_withdrawal_from_manager'];
      await insertCommission(adminAncestor.id, adminRate, round2(amount * adminRate), isDeposit ? 'admin_deposit' : 'admin_withdrawal');
    }
    return commissions;
  }

  if (actor.role === 'agent') {
    // Rule Set 2: Agent actor — manager earns 1%/0.4%, admin earns 1%/0.6%
    const managerAncestor = ancestorChain.find((a) => a.role === 'manager');
    if (managerAncestor) {
      const managerRate = isDeposit ? rates['manager_from_agent_deposit'] : rates['manager_from_agent_withdrawal'];
      await insertCommission(managerAncestor.id, managerRate, round2(amount * managerRate), isDeposit ? 'manager_deposit' : 'manager_withdrawal');
    }
    if (adminAncestor) {
      const adminRate = isDeposit ? rates['admin_deposit_from_agent'] : rates['admin_withdrawal_from_agent'];
      await insertCommission(adminAncestor.id, adminRate, round2(amount * adminRate), isDeposit ? 'admin_deposit' : 'admin_withdrawal');
    }

    // Track agent's own monthly deposits for the 10k unlock threshold
    if (isDeposit) {
      const unlockRecord = await client.query(
        'SELECT * FROM monthly_agent_unlock WHERE agent_id = $1 AND year = $2 AND month = $3',
        [actor.id, year, month]
      );
      const currentTotal = unlockRecord.rows.length > 0 ? parseFloat(unlockRecord.rows[0].total_own_deposits) : 0;
      const newTotal = currentTotal + amount;
      const threshold = rates['agent_unlock_threshold'];
      const wasUnlocked = unlockRecord.rows.length > 0 && unlockRecord.rows[0].is_unlocked;
      const nowUnlocked = newTotal >= threshold;
      await client.query(
        `INSERT INTO monthly_agent_unlock (agent_id, year, month, total_own_deposits, is_unlocked, unlocked_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (agent_id, year, month) DO UPDATE
         SET total_own_deposits = $4,
             is_unlocked = $5,
             unlocked_at = CASE WHEN monthly_agent_unlock.is_unlocked = false AND $5 = true THEN NOW()
                                ELSE monthly_agent_unlock.unlocked_at END`,
        [actor.id, year, month, newTotal, nowUnlocked, nowUnlocked && !wasUnlocked ? new Date() : null]
      );
    }
    return commissions;
  }

  // Actor is subagent — check direct parent role to apply correct rule set
  const directParentResult = await client.query(
    'SELECT id, role FROM users WHERE id = $1 AND is_deleted = false',
    [actor.parent_id]
  );

  if (directParentResult.rows.length > 0) {
    const directParent = directParentResult.rows[0];

    if (directParent.role === 'agent') {
      // Rule Set 3: Subagent direct child of Agent
      const agentId = directParent.id;
      const unlockResult = await client.query(
        'SELECT is_unlocked FROM monthly_agent_unlock WHERE agent_id = $1 AND year = $2 AND month = $3',
        [agentId, year, month]
      );
      const isAgentUnlocked = unlockResult.rows.length > 0 && unlockResult.rows[0].is_unlocked;

      if (!isAgentUnlocked) {
        await client.query(
          `INSERT INTO commissions (transaction_id, beneficiary_id, source_user_id, percentage, amount, commission_type)
           VALUES ($1, $2, $3, 0, 0, 'agent_locked')`,
          [transactionId, agentId, actor.id]
        );
      } else {
        const parentRate = isDeposit ? rates['direct_parent_deposit'] : rates['direct_parent_withdrawal'];
        await insertCommission(agentId, parentRate, round2(amount * parentRate), isDeposit ? 'direct_parent_deposit' : 'direct_parent_withdrawal');
      }
    } else if (directParent.role === 'subagent') {
      // Rule Set 4: Subagent child of Sub-agent — direct parent earns 1%/0.4%, agent earns nothing
      const parentRate = isDeposit ? rates['direct_parent_deposit'] : rates['direct_parent_withdrawal'];
      await insertCommission(directParent.id, parentRate, round2(amount * parentRate), isDeposit ? 'direct_parent_deposit' : 'direct_parent_withdrawal');
    }
  }

  // Manager ancestor always earns 0.3%/0.1% from any subagent transaction
  const managerAncestor = ancestorChain.find((a) => a.role === 'manager');
  if (managerAncestor) {
    const managerRate = isDeposit ? rates['manager_deep_team_deposit'] : rates['manager_deep_team_withdrawal'];
    await insertCommission(managerAncestor.id, managerRate, round2(amount * managerRate), isDeposit ? 'manager_deposit' : 'manager_withdrawal');
  }

  // Admin earns 0.7%/0.5% from any subagent transaction
  if (adminAncestor) {
    const adminRate = isDeposit ? rates['admin_deposit_from_subagent'] : rates['admin_withdrawal_from_subagent'];
    await insertCommission(adminAncestor.id, adminRate, round2(amount * adminRate), isDeposit ? 'admin_deposit' : 'admin_withdrawal');
  }

  return commissions;
}

module.exports = { calculate };
