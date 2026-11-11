# PayPal Transaction Clarity Copilot — Frontend

React + Vite frontend for inspecting simulated demo records (`DEMO DATA`), PayPal Sandbox checkout flows, and live PayPal Orders v2 + Gemini clarity explanations.

## Environment Variables (`client/.env`, optional)

Create `client/.env` inside this directory if you need custom settings:

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_USE_MOCK_API=false
```

- `VITE_BACKEND_URL`: Express backend base URL (defaults to `http://localhost:5000`).
- `VITE_USE_MOCK_API`: Defaults to mock mode when omitted. Set `VITE_USE_MOCK_API=false` to enable real PayPal order creation, verification, and capture flows. The **Real PayPal Sandbox Order** AI Copilot explanation endpoint (`POST /api/copilot/explain`) always calls the real backend independently of `VITE_USE_MOCK_API`.

## Commands

Run all commands from the `client/` directory:

```bash
# Install dependencies
npm install

# Start Vite development server (http://localhost:5173)
npm run dev

# Run ESLint checks
npm run lint

# Build production bundle (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

For full-stack setup and Express backend configuration, see the root [README.md](../README.md).
