# Finance Dashboard

A production-ready personal finance dashboard with Plaid bank integration.

**Stack:** FastAPI · SQLAlchemy 2 · PostgreSQL 15 · Next.js 14 · TypeScript · Tailwind CSS

---

## Getting Started in 5 Commands

```bash
# 1. Start PostgreSQL + Redis
docker-compose up -d

# 2. Install and migrate the backend
cd backend && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # Then fill in FERNET_KEY, JWT_SECRET_KEY, PLAID_* values
alembic upgrade head
python main.py              # API running on http://localhost:8000

# 3. Install and run the frontend (new terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                 # App running on http://localhost:3000

# 4. (One-time) Generate required secret keys
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # → FERNET_KEY
python -c "import secrets; print(secrets.token_hex(32))"                                    # → JWT_SECRET_KEY

# 5. Get Plaid sandbox credentials
# Go to https://dashboard.plaid.com/developers/keys
# Copy Client ID + Sandbox Secret → paste into backend/.env
```

---

## Folder Structure

```
finance-dashboard/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # auth.py, plaid.py, sync.py, dashboard.py
│   │   ├── core/            # config.py, database.py, deps.py, logging.py
│   │   │                    # middleware.py, security.py
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── services/        # plaid_client.py, sync.py, scheduler.py
│   ├── alembic/             # Database migrations
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   ├── components/
│   │   ├── dashboard/       # Feature components
│   │   └── ui/              # shadcn/ui primitives
│   ├── lib/                 # API client, auth helpers
│   └── types/               # Shared TypeScript types
└── docker-compose.yml
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Async SQLAlchemy URL (`postgresql+asyncpg://...`) |
| `SYNC_DATABASE_URL` | Sync URL for Alembic (`postgresql://...`) |
| `FERNET_KEY` | Fernet key for encrypting Plaid access tokens |
| `JWT_SECRET_KEY` | Secret for signing JWTs |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime (default `60`) |
| `PLAID_CLIENT_ID` | From Plaid Dashboard |
| `PLAID_SECRET` | Sandbox/dev/prod secret from Plaid Dashboard |
| `PLAID_ENV` | `sandbox` \| `development` \| `production` |
| `PLAID_PRODUCTS` | Comma-sep: `transactions` |
| `PLAID_COUNTRY_CODES` | Comma-sep: `US,CA` |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `FRONTEND_URL` | CORS origin, e.g. `http://localhost:3000` |
| `ENVIRONMENT` | `development` \| `production` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI base URL, e.g. `http://localhost:8000` |
| `NEXT_PUBLIC_PLAID_ENV` | `sandbox` \| `production` |

---

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Get JWT |
| POST | `/api/plaid/create-link-token` | JWT | Start Plaid Link |
| POST | `/api/plaid/exchange-token` | JWT | Complete Plaid Link |
| POST | `/api/sync/run` | JWT | Manual data sync |
| GET | `/api/accounts` | JWT | All accounts + balances |
| GET | `/api/transactions` | JWT | Paginated transactions |
| GET | `/api/net-worth` | JWT | Current net worth |
| GET | `/api/net-worth/history` | JWT | 90-day history |
| GET | `/health` | — | Health check |

---

## Deployment

### Pre-flight checklist

- [ ] Generate `FERNET_KEY` and `JWT_SECRET_KEY` (commands in Getting Started)
- [ ] Set `ENVIRONMENT=production` in backend env vars
- [ ] Set `FRONTEND_URL` to your exact frontend origin (no trailing slash) — CORS rejects all other origins
- [ ] Set `PLAID_ENV=production` and swap in production Plaid credentials
- [ ] Provision managed PostgreSQL; update `DATABASE_URL` and `SYNC_DATABASE_URL`
- [ ] Provision managed Redis; update `REDIS_URL`
- [ ] Run `alembic upgrade head` as a one-off migration job before first deploy
- [ ] Confirm `/health` returns `{"status": "ok"}` after deploy
- [ ] Rotate all secrets if they were ever committed to source control

### Backend → Railway or Render

1. Set all env vars in the platform dashboard (see Environment Variables table)
2. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Provision a managed PostgreSQL database (update `DATABASE_URL` + `SYNC_DATABASE_URL`)
4. Provision a managed Redis instance (update `REDIS_URL`)
5. Run `alembic upgrade head` as a one-off job before first deploy

### Frontend → Vercel

1. Import the `frontend/` directory as a Vercel project
2. Set `NEXT_PUBLIC_API_URL` to your Railway/Render backend URL
3. Set `NEXT_PUBLIC_PLAID_ENV=production`
4. Deploy

### Production behaviour

| Feature | Development | Production |
|---|---|---|
| CORS | `http://localhost:3000` only | `FRONTEND_URL` only |
| API docs (`/docs`, `/redoc`) | Enabled | Disabled |
| SQL query logging | Enabled | Disabled |
| Log level | DEBUG | INFO |
| Log format | JSON (stdout) | JSON (stdout) |
| Rate limit — register | 5 req/min/IP | 5 req/min/IP |
| Rate limit — login | 10 req/min/IP | 10 req/min/IP |
| Background sync | Every 6 h | Every 6 h |
| Balance snapshot | Midnight UTC | Midnight UTC |

---

## Plaid Sandbox Testing

Use these test credentials when the Plaid Link modal opens:

- **Username:** `user_good`
- **Password:** `pass_good`
- **Institution:** Chase, Wells Fargo, or any listed sandbox bank
