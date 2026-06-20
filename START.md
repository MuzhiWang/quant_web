# Starting the System End-to-End (Windows & Mac)

This is the cross-platform runbook for bringing up the **dashboard stack**. For deep
backend operations (CLI, NSSM service, deploy, performance recalc) see
`quant/joinquant/strategy/realtime_trading/trading_component/qmt_trading/OPERATIONS.md`.

---

## The 4 components and ports

```
React client (:3001 dev)
      │  HTTP /api/*
      ▼
Express BFF  (:3000)  ──proxies──►  FastAPI API (:8001)  ──►  MySQL (Aliyun RDS)
                                          ▲
Trading engine (main.py, metrics :8001)   │  (writes the data the API reads)
QMT app + xtquant (Windows only) ──────────┘
```

| # | Component | Command (from its dir) | Port | Runs on |
|---|-----------|------------------------|------|---------|
| 1 | Trading engine | `python main.py` (or NSSM service) | metrics :8000 | **Windows only** |
| 2 | FastAPI API | `python server/start_server.py [--service db\|qmt\|all]` | :8001 (db/all), :8002 (qmt) | **Windows only** (see Mac note) |
| 3 | Express BFF | `npm start` | :3000 | Windows + Mac |
| 4 | React client | `cd client && PORT=3001 npm start` | :3001 | Windows + Mac |

**Key design point:** the React client always calls the **local BFF** (`http://localhost:3000/api`).
Only the **BFF's `API_BASE_URL`** decides which FastAPI backend it proxies to. So pointing the Mac
dashboard at a remote backend is a one-line env change — nothing in the client changes.

---

## Why the Python backend is Windows-only

The backend depends on **`xtquant`** (迅投 QMT), a Windows-only proprietary package that **cannot be
installed on macOS/Linux**. Today `server/api.py` imports it eagerly (via `qmt_manager`,
`market_data`, `benchmark_fetcher`), so **even `--service db` fails to import on Mac**, even though
db-mode needs no QMT at runtime.

Consequences:
- The **trading engine** and **FastAPI API** run only on Windows (or the Aliyun Windows ECS).
- A Mac can run the **dashboard (BFF + React)** and point it at a Windows/ECS backend.
- A Mac can **never place real orders** — there is no broker bridge on macOS. Mac = view/develop only.

> A future code change (lazy/guarded `xtquant` imports) would let `--service db` run on Mac directly.
> That is intentionally **not** done here; this doc keeps the code untouched and works around it.

---

## Windows — full stack (one command)

```bat
:: From quant_web\  — starts FastAPI (:8001, db mode) + BFF (:3000) + React (:3001)
start_all.bat
```

Then open **http://localhost:3001**.

`start_all.bat` does not start the trading **engine** (`main.py`) — that is the live trader and is
normally the NSSM service. Start/manage it per `OPERATIONS.md` §6. The dashboard only needs the API (2).

### Manual (3 terminals) if you prefer

```bat
:: Terminal 1 — API
cd ..\quant\joinquant\strategy\realtime_trading\trading_component\qmt_trading
python server\start_server.py --service all

:: Terminal 2 — BFF
cd quant_web
npm start

:: Terminal 3 — React
cd quant_web\client
set PORT=3001 && npm start
```

---

## Mac — dashboard against a remote backend (most stable)

The Python backend stays on the Windows box / Aliyun ECS where QMT lives. The Mac runs only the web
tier and proxies to it. Two ways to reach the backend:

### Option A — SSH tunnel (recommended: encrypted, no firewall changes)

```bash
# Forward the remote FastAPI (:8001) to localhost:8001 on the Mac
ssh -N -L 8001:localhost:8001 user@your-ecs-host

# In another terminal, from quant_web/ :
./start_web_services.sh            # API_BASE_URL defaults to http://localhost:8001/api
```

### Option B — point directly at the remote host

```bash
# From quant_web/
API_BASE_URL="http://<windows-or-ecs-ip>:8001/api" ./start_web_services.sh
```

(Option B requires the FastAPI port to be reachable/opened; the SSH tunnel avoids that.)

Then open **http://localhost:3001**. First run: `npm install` in both `quant_web/` and `quant_web/client/`.

> The dashboard is **read-only**, so running it from a Mac against the live DB is safe — it cannot
> place orders. The "Add Order" button POSTs to the remote API, which injects into the `stocks`
> table in whatever mode (LIVE/DRY RUN) the *remote* engine is configured for. Use with care.

---

## Configuration (env)

Copy the examples and edit as needed (these files are git-ignored):

```bash
cp .env.example .env                 # BFF: PORT, API_BASE_URL, CORS_ORIGIN
cp client/.env.example client/.env   # client: REACT_APP_API_BASE_URL, PORT
```

| Var | Where | Default | Meaning |
|-----|-------|---------|---------|
| `API_BASE_URL` | BFF | `http://localhost:8001/api` | which FastAPI backend to proxy to |
| `PORT` | BFF | `3000` | BFF listen port |
| `CORS_ORIGIN` | BFF | `*` | tighten in production |
| `REACT_APP_API_BASE_URL` | client | `http://localhost:3000/api` | the BFF the client calls (keep as local BFF) |
| `PORT` | client | `3001` | React dev port (must differ from the BFF's 3000) |

---

## Stability / making it better (notes, no code changed here)

1. **Decouple `xtquant`** (biggest win): make those imports lazy/guarded so `--service db` runs on
   any OS and a broken QMT install can't crash the DB endpoints. Would let the Mac run the API locally.
2. **Health gating:** the launchers wait for the API's `/api/health` before starting the web tier, so
   you don't get a blank dashboard during a slow backend boot.
3. **Pin ports:** React is pinned to `:3001` (CRA would otherwise grab `:3000` and collide with the BFF).
4. **One backend, many viewers:** keep the engine + API on the Windows/ECS box; every Mac just tunnels
   in. Single source of truth, nothing to keep in sync.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `ModuleNotFoundError: xtquant` on Mac | Expected — don't run the Python backend on Mac; use a tunnel (Option A). |
| Blank dashboard, "Cannot connect to backend" | API (2) not up or `API_BASE_URL` wrong. Check `curl $API_BASE_URL/health`. |
| React opens on :3000 and collides | `PORT` not set; use the launch scripts or `set PORT=3001`. |
| Toast: "Failed to load transactions" | One endpoint failed; rest of UI still works. Check the BFF/API logs. |
| CORS error in browser console | Set `CORS_ORIGIN` on the BFF, or keep client pointed at the local BFF (default). |
