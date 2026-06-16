require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');

const SECRET = process.env.JWT_SECRET;
const BASE   = 'http://localhost:3001/api/v1';

const USERS = [
  { id: '7b57308d-1ea7-476c-9397-f6d18e9515e6', name: 'Test Manager 8229', role: 'manager' },
  { id: 'e39b8e7c-9a87-40aa-a24d-4ac664a71a8c', name: 'Test Agent 8229',   role: 'agent'   },
  { id: '5373bf46-3a8c-47e3-99bc-d701eb3b380e', name: 'Test Subagent 8229', role: 'subagent' },
];

function makeToken(user) {
  return jwt.sign({ user_id: user.id, role: user.role }, SECRET, { expiresIn: '1h' });
}

function lkr(n) { return `LKR ${Number(n).toLocaleString('en', { minimumFractionDigits: 2 })}` }

async function checkUser(user) {
  const token = makeToken(user);
  const headers = { Authorization: `Bearer ${token}` };

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`👤 ${user.name.toUpperCase()} (${user.role})`);
  console.log(`${'═'.repeat(60)}`);

  try {
    // 1. Commissions list
    const commRes = await axios.get(`${BASE}/commissions`, { headers });
    const commData = commRes.data.data || {};
    const comms = Array.isArray(commData) ? commData : (commData.commissions || []);
    const total = comms.reduce((s, c) => s + parseFloat(c.amount || 0), 0);
    console.log(`\n💰 Commissions tab  (${comms.length} records, total = ${lkr(total)})`);
    for (const c of comms.slice(0, 8)) {
      console.log(`   ${c.type || c.commissionType || c.commission_type}`.padEnd(40) +
        `${lkr(c.amount)}`.padStart(14));
    }

    // 2. Dashboard summary
    const dashRes = await axios.get(`${BASE}/dashboard/summary`, { headers });
    const d = dashRes.data.data || {};
    console.log(`\n📊 Dashboard summary`);
    if (d.allTimeEarnings   !== undefined) console.log(`   All-time earnings:        ${lkr(d.allTimeEarnings)}`);
    if (d.earningsFromOwn   !== undefined) console.log(`   Earnings from own:         ${lkr(d.earningsFromOwn)}`);
    if (d.earningsFromDirect !== undefined) console.log(`   Earnings from direct:      ${lkr(d.earningsFromDirect)}`);
    if (d.earningsFromDeep   !== undefined) console.log(`   Earnings from deep:        ${lkr(d.earningsFromDeep)}`);

    // 3. Transactions
    const txRes = await axios.get(`${BASE}/transactions`, { headers });
    const txs = txRes.data.data || [];
    console.log(`\n📋 Transactions (${txs.length} records)`);
    for (const t of txs.slice(0, 5)) {
      console.log(`   ${t.type} ${lkr(t.amount)} — user: ${t.userName || t.user_id}`);
    }

  } catch (err) {
    console.error(`   ❌ Error: ${err.response?.data?.message || err.message}`);
  }
}

async function run() {
  console.log('🔍 CHECKING COMMISSION DISPLAY IN EACH ROLE\'S DASHBOARD\n');
  for (const user of USERS) {
    await checkUser(user);
  }
  console.log('\n✅ Done.\n');
  process.exit(0);
}

run();
