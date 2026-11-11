# PayPal Transaction Clarity Copilot

A full-stack React + Express prototype that combines a clearly labeled simulated clarity dashboard with live PayPal Orders v2 Sandbox verification and Gemini-powered transaction explanations.

## Architecture Overview

- **Backend (`server/index.js`)**: Express API that authenticates with PayPal Sandbox OAuth2, retrieves verified order state from PayPal Orders v2 (`GET /api/paypal/orders/:orderId`), supports explicit checkout order creation and user-confirmed capture, and calls Google Gemini (`POST /api/copilot/explain`) with strict JSON schema validation and safety rules.
- **Hybrid Intelligence & Preserved Ground Truth**: In `POST /api/copilot/explain`, PayPal order facts are retrieved first and analyzed deterministically before calling Gemini:
  - When PayPal facts are successfully retrieved but Gemini fails (rate limit, timeout, missing key, malformed or schema-invalid response, etc.), the backend switches to the deterministic rule-based fallback (`server/lib/fallbackExplainer.js`) and returns HTTP `200` with `explanationSource: "deterministic_rules"`, `isAiGenerated: false`, `aiFallbackUsed: true`, and `aiError` alongside `verifiedFacts`, `intelligence`, and `explanation`.
  - PayPal lookup failures do not produce fabricated fallback explanations and instead return the appropriate upstream/validation error status.
- **Frontend (`client/`)**: Vite + React workspace with two clearly separated experiences:
  - **Real PayPal Sandbox Order** (`CopilotView` / `RealOrderClaritySection`): Live lookup via `POST /api/copilot/explain`, keeping PayPal-verified facts strictly separated from Gemini-generated explanations.
  - **Interactive Demo Mode** (`DashboardView`, `TransactionsView`, Demo Chat): Preloaded synthetic sample records labeled `DEMO DATA`.

## Environment Configuration

### Backend (`server/.env`)

Create `server/.env` (never commit real credentials):

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_TIMEOUT_MS=15000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
```

- `FRONTEND_URL`: Base frontend URL used for PayPal checkout `return_url` and `cancel_url` (defaults to `http://localhost:5173`).
- `CORS_ORIGIN`: Allowed CORS origin or comma-separated origins (defaults to `FRONTEND_URL`).
- `PAYPAL_TIMEOUT_MS`: Timeout in milliseconds for PayPal Sandbox OAuth and Orders v2 requests (defaults to `15000`, returning HTTP `504` on timeout).
- `GEMINI_MODEL`: Server-configured Gemini model name (defaults to `gemini-3.8-flash`).

### Frontend (`client/.env`, optional)

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_USE_MOCK_API=false
```

- `VITE_BACKEND_URL`: Express backend base URL (defaults to `http://localhost:5000`).
- `VITE_USE_MOCK_API`: Defaults to mock mode when omitted (any value other than `'false'`). Set `VITE_USE_MOCK_API=false` to enable real PayPal order creation, verification, and capture flows (the AI Copilot explanation endpoint `POST /api/copilot/explain` always calls the real backend independently of `VITE_USE_MOCK_API`).

## Local Development

### 1. Run Backend

```bash
cd server
npm install
node index.js
```

### 2. Run Frontend

```bash
cd client
npm install
npm run dev
```

### 3. Automated Tests, Build & Lint Verification

Run the automated test suites (currently **67 server tests** and **9 client tests**, for **76 total**):

```bash
npm test --prefix server
npm test --prefix client
```

Verify syntax, linting, and production build:

```bash
node -c server/index.js
npm --prefix client run lint
npm --prefix client run build
```

## Implemented Backend Endpoints

- `GET /api/health` — Backend health check
- `GET /api/paypal/test` — PayPal Sandbox OAuth connectivity test
- `GET /api/gemini/test` — Gemini API connectivity test
- `POST /api/paypal/orders` — Create PayPal Sandbox checkout order
- `GET /api/paypal/orders/:orderId` — Retrieve and verify PayPal Sandbox order details
- `POST /api/paypal/orders/:orderId/capture` — Explicitly capture an `APPROVED` PayPal Sandbox order
- `POST /api/copilot/explain` — Retrieve PayPal Orders v2 facts, run deterministic transaction intelligence, and generate schema-validated Gemini or deterministic fallback explanations
