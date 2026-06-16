# Zimplexline

Multi-level affiliate commission management platform. Tracks users, transactions, commissions, and ID verifications across a 4-role hierarchy (Admin → Manager → Agent → Sub-agent).

## Stack

- **Frontend** — React 19, Vite 6, TypeScript, Tailwind CSS v4
- **Backend** — Node.js, Express, PostgreSQL
- **Auth** — JWT with role-based access control

## Run Locally

**Prerequisites:** Node.js 20+, PostgreSQL 15+

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET
node app.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`, API at `http://localhost:3001`.

## Role Hierarchy

| Role | Can recruit | Earns commission from |
|---|---|---|
| Admin | Managers | — |
| Manager | Agents | Own deposits (3%), direct agents (1%), deep team (0.3%) |
| Agent | Sub-agents | Direct sub-agents (2.5–3%), deep team (0.3%) |
| Sub-agent | — | — |
