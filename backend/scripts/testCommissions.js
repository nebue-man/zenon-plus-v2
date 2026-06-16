require('dotenv').config();
const db = require('../database');
const { calculate } = require('../utils/commissionEngine');

const ADMIN_ID    = '72404669-55ed-4b2b-98d3-49cd12e2c52a'; // Flow Test Admin 8229
const MANAGER_ID  = '7b57308d-1ea7-476c-9397-f6d18e9515e6'; // Test Manager 8229
const AGENT_ID    = 'e39b8e7c-9a87-40aa-a24d-4ac664a71a8c'; // Test Agent 8229
const SUBAGENT_ID = '5373bf46-3a8c-47e3-99bc-d701eb3b380e'; // Test Subagent 8229

function lkr(n) { return `LKR ${Number(n).toLocaleString('en', { minimumFractionDigits: 2 })}` }

async function deposit(userId, amount, label) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const txRes = await client.query(
      `INSERT INTO transactions (user_id, type, amount, recorded_by, transaction_date)
       VALUES ($1, 'deposit', $2, $3, NOW()) RETURNING id`,
      [userId, amount, ADMIN_ID]
    );
    const txId = txRes.rows[0].id;
    const comms = await calculate(txId, client);
    await client.query('COMMIT');

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📥 DEPOSIT  ${lkr(amount)}  →  ${label}`);
    console.log(`   Transaction: ${txId}`);
    if (comms.length === 0) {
      console.log('   ⚠️  No commissions generated.');
    } else {
      for (const c of comms) {
        const who = await db.query('SELECT full_name, role FROM users WHERE id = $1', [c.beneficiary_id]);
        const u = who.rows[0];
        console.log(`   💰 ${u.full_name} (${u.role}) — ${c.commission_type}  @ ${(c.percentage * 100).toFixed(2)}%  =  ${lkr(c.amount)}`);
      }
    }
    return txId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function printSummary() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 COMMISSION TOTALS BY BENEFICIARY');
  console.log(`${'═'.repeat(60)}`);
  const res = await db.query(`
    SELECT u.full_name, u.role, c.commission_type,
           COUNT(*) AS count,
           SUM(c.amount) AS total
    FROM commissions c
    JOIN users u ON u.id = c.beneficiary_id
    WHERE c.beneficiary_id IN ($1, $2, $3)
    GROUP BY u.full_name, u.role, c.commission_type
    ORDER BY u.role, c.commission_type
  `, [MANAGER_ID, AGENT_ID, SUBAGENT_ID]);

  const byUser = {};
  for (const row of res.rows) {
    const key = `${row.full_name} (${row.role})`;
    if (!byUser[key]) byUser[key] = { total: 0, lines: [] };
    byUser[key].total += parseFloat(row.total);
    byUser[key].lines.push(`     ${row.commission_type.padEnd(35)} ${lkr(row.total)}`);
  }

  for (const [user, data] of Object.entries(byUser)) {
    console.log(`\n  ${user}`);
    for (const l of data.lines) console.log(l);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  TOTAL: ${lkr(data.total)}`);
  }

  // Check agent unlock status
  const unlock = await db.query(
    'SELECT total_own_deposits, is_unlocked FROM monthly_agent_unlock WHERE agent_id = $1',
    [AGENT_ID]
  );
  if (unlock.rows.length > 0) {
    const u = unlock.rows[0];
    console.log(`\n🔓 Agent unlock: own deposits = ${lkr(u.total_own_deposits)}  |  unlocked = ${u.is_unlocked}`);
  }
}

async function run() {
  try {
    console.log('🧪 COMMISSION ENGINE TEST');
    console.log('Hierarchy: Admin → Manager → Agent → Subagent\n');

    // Step 0: Unlock agent with 10,000 own deposit (required before subagent commissions flow to agent)
    console.log('⚡ Step 0: Unlock agent with LKR 10,000 own deposit (threshold = LKR 10,000)');
    await deposit(AGENT_ID, 10000, 'Test Agent 8229 [unlock deposit]');

    // Step 1: 20,000 to subagent
    await deposit(SUBAGENT_ID, 20000, 'Test Subagent 8229');

    // Step 2: 20,000 to agent
    await deposit(AGENT_ID, 20000, 'Test Agent 8229');

    // Step 3: 20,000 to manager
    await deposit(MANAGER_ID, 20000, 'Test Manager 8229');

    await printSummary();
    console.log('\n✅ Test complete.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
