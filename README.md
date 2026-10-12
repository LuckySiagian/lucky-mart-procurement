# Lucky Mart Procurement Portal

An internal portal for restocking my family's grocery store. Staff create purchase orders to
suppliers, the owner approves them, and when the goods arrive the stock is added to
[Lucky Mart](https://github.com/LuckySiagian/lucky-mart), the store's ordering platform.

> **Status: work in progress.** The backend and the React frontend work end to end; CI and
> AWS CDK infrastructure are being built next.

## How it works

```
Lucky Mart (Go)                     Procurement Portal (Django)
─────────────────                   ───────────────────────────
GET /inventory/low-stock  ───────▶  suggest what to reorder
                                    Staff: create purchase order (DRAFT)
                                    Staff: submit           (SUBMITTED)
                                    Owner: approve / reject (APPROVED / REJECTED)
                                    Staff: receive goods    (RECEIVED)
POST /inventory/adjust    ◀───────  add received stock (STOCK_IN)
```

- **Roles:** staff prepare and receive orders; only the owner approves, and never their own order.
- **Audit trail:** every status change records who did it and when.
- **Safe stock sync:** a receipt is saved even if Lucky Mart is down. Failed lines can be retried,
  and lines already synced are never sent twice.

## Tech stack

| Part | Technology |
| --- | --- |
| Backend | Python 3.12, Django 5, Django REST Framework, Simple JWT |
| Database | PostgreSQL 16 |
| Monitoring | `/api/health/`, Prometheus metrics at `/metrics` |
| Tests | pytest, pytest-django, responses · Vitest, Testing Library |
| Frontend | React 19 + TypeScript + Vite, TanStack Query, React Router, Tailwind CSS |
| Infrastructure | Docker Compose; AWS CDK *(planned, code only)* |

## Run locally

Requirements: Docker Desktop.

```bash
cp .env.example .env          # then set DEMO_PASSWORD
docker compose up -d
docker compose exec backend python manage.py seed_demo
```

Then start the frontend (Node.js 22+):

```bash
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173 (users `owner` and `staff`, password from `DEMO_PASSWORD`)
- API health: http://localhost:8000/api/health/
- Django admin: http://localhost:8000/admin (user `owner`)

To connect to Lucky Mart, run it on port 8080 and set `LUCKY_MART_PHONE_NUMBER` and
`LUCKY_MART_PASSWORD` in `.env` to a Lucky Mart user with a warehouse role.

## Tests

```bash
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .

cd frontend
npm run typecheck && npm run lint && npm test
```

## API overview

| Method | Endpoint | Who |
| --- | --- | --- |
| POST | `/api/auth/login/` | everyone |
| GET | `/api/auth/me/` | signed in |
| GET/POST | `/api/suppliers/` | signed in |
| GET/POST | `/api/purchase-orders/` | signed in |
| POST | `/api/purchase-orders/{id}/submit/` | creator |
| POST | `/api/purchase-orders/{id}/approve/` · `reject/` | owner |
| POST | `/api/purchase-orders/{id}/receive/` · `sync-stock/` | signed in |
| GET | `/api/lucky-mart/low-stock/` | signed in |
| GET | `/api/dashboard/` | signed in |
