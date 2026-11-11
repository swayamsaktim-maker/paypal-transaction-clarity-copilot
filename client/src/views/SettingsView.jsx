import { useState } from 'react';
import { 
  SettingsIcon, 
  ShieldCheckIcon, 
  SparklesIcon, 
  CheckmarkIcon
} from '../components/icons/Icons';

export function SettingsView() {
  const [clarityTone, setClarityTone] = useState('reassuring');
  const [autoDecode, setAutoDecode] = useState(true);
  const [disputeGuard, setDisputeGuard] = useState(true);
  const [saveToast, setSaveToast] = useState(false);

  const handleSave = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2400);
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <div>
          <div className="flex-row-align gap-2">
            <h1 className="view-title">Copilot Settings & Architecture Status</h1>
            <span className="demo-pill-small">LOCAL UI PREFERENCES + LIVE API MAP</span>
          </div>
          <p className="view-subtitle">
            View server-enforced AI guardrails, implemented backend endpoints, and local demo session toggles.
          </p>
        </div>

        {saveToast && (
          <div className="settings-toast">
            <CheckmarkIcon size={14} />
            <span>Demo Preferences Saved to Browser Session</span>
          </div>
        )}
      </div>

      <div className="settings-cards-grid">
        {/* Card 1: AI Model & Local Demo Preferences */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon-wrap">
              <SparklesIcon size={18} />
            </div>
            <div>
              <h3 className="card-title">AI Clarity Engine</h3>
              <p className="card-desc">Server-managed Gemini configuration & local UI preview options</p>
            </div>
          </div>

          <div className="settings-form-group">
            <label className="form-label">Active Backend Model (Server-Configured)</label>
            <div className="form-select" aria-readonly="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.9 }}>
              <span><code>GEMINI_MODEL</code> (server default: <code>gemini-3.8-flash</code>)</span>
            </div>
            <span className="form-help">
              Live <code>POST /api/copilot/explain</code> calls always use the server&apos;s configured <code>GEMINI_MODEL</code> environment variable. The options below are local demo UI preview preferences only.
            </span>
          </div>

          <div className="settings-form-group">
            <label className="form-label">Demo Workspace Tone (Local Session Only)</label>
            <div className="radio-options-grid">
              <label className={`radio-card ${clarityTone === 'reassuring' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="tone"
                  value="reassuring"
                  checked={clarityTone === 'reassuring'}
                  onChange={() => setClarityTone('reassuring')}
                />
                <div className="radio-card-content">
                  <span className="radio-title">Reassuring & Plain English</span>
                  <span className="radio-sub">Empathetic, demystifies banking jargon, reduces anxiety</span>
                </div>
              </label>

              <label className={`radio-card ${clarityTone === 'concise' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="tone"
                  value="concise"
                  checked={clarityTone === 'concise'}
                  onChange={() => setClarityTone('concise')}
                />
                <div className="radio-card-content">
                  <span className="radio-title">Concise Financial Ledger</span>
                  <span className="radio-sub">Bullet points, fee math, transaction timestamps</span>
                </div>
              </label>
            </div>
          </div>

          <div className="settings-toggle-row">
            <div className="toggle-text">
              <span className="toggle-title">Demo Descriptor Preview (Local UI)</span>
              <span className="toggle-sub">Local display preference for simulated sample ledger records</span>
            </div>
            <input
              type="checkbox"
              checked={autoDecode}
              onChange={(e) => setAutoDecode(e.target.checked)}
              className="toggle-checkbox"
            />
          </div>

          <div className="settings-toggle-row">
            <div className="toggle-text">
              <span className="toggle-title">Demo Dispute Guard Label (Local UI)</span>
              <span className="toggle-sub">Local display preference in the simulated dashboard preview</span>
            </div>
            <input
              type="checkbox"
              checked={disputeGuard}
              onChange={(e) => setDisputeGuard(e.target.checked)}
              className="toggle-checkbox"
            />
          </div>
        </div>

        {/* Card 2: Sandbox Environment & Guardrails */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon-wrap">
              <ShieldCheckIcon size={18} />
            </div>
            <div>
              <h3 className="card-title">Sandbox Environment & Safety Policies</h3>
              <p className="card-desc">Actual server-side security and financial accuracy boundaries</p>
            </div>
          </div>

          <div className="guardrail-items-list">
            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">AI Is Read-Only (No AI-Triggered Money Movement)</span>
                <p className="guardrail-desc">
                  Gemini explanations are strictly advisory and never execute captures, refunds, or payouts. PayPal Sandbox checkout creation and capture require explicit user actions.
                </p>
              </div>
            </div>

            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">PayPal Ground Truth Verification</span>
                <p className="guardrail-desc">
                  The backend fetches order state directly from PayPal Orders v2 Sandbox API and distinguishes APPROVED, COMPLETED capture, and bank settlement.
                </p>
              </div>
            </div>

            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">Zero Client-Side Secret Exposure</span>
                <p className="guardrail-desc">
                  PayPal and Gemini credentials remain strictly on the Express server and are never bundled into Vite client assets.
                </p>
              </div>
            </div>

            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">Clear Demo vs Real Sandbox Separation</span>
                <p className="guardrail-desc">
                  Sample dashboard records are labeled DEMO DATA, while AI Copilot Order ID lookups query real PayPal Sandbox and preserve verified PayPal facts if Gemini fails.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Backend API Integration Map */}
        <div className="settings-card full-width-card">
          <div className="settings-card-header">
            <div className="card-header-icon-wrap">
              <SettingsIcon size={18} />
            </div>
            <div>
              <h3 className="card-title">Implemented Backend Endpoints & Mode Map</h3>
              <p className="card-desc">Actual Express backend routes vs simulated frontend demo views</p>
            </div>
          </div>

          <div className="endpoints-table-wrap">
            <table className="endpoints-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint / Mode</th>
                  <th>Service</th>
                  <th>Current Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="http-badge http-post">POST</span></td>
                  <td><code>/api/copilot/explain</code></td>
                  <td>PayPal Orders v2 + Gemini API</td>
                  <td><span className="status-chip chip-ready">Live Backend Endpoint</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-get">GET</span></td>
                  <td><code>/api/paypal/orders/:orderId</code></td>
                  <td>PayPal Orders v2 Sandbox Lookup</td>
                  <td><span className="status-chip chip-ready">Live Backend Endpoint</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-post">POST</span></td>
                  <td><code>/api/paypal/orders</code></td>
                  <td>PayPal Sandbox Order Creation</td>
                  <td><span className="status-chip chip-ready">Live Backend Endpoint</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-post">POST</span></td>
                  <td><code>/api/paypal/orders/:orderId/capture</code></td>
                  <td>Explicit PayPal Sandbox Capture</td>
                  <td><span className="status-chip chip-ready">Live Backend Endpoint</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-get">GET</span></td>
                  <td><code>/api/health</code>, <code>/api/paypal/test</code>, <code>/api/gemini/test</code></td>
                  <td>Server Diagnostics & Connectivity</td>
                  <td><span className="status-chip chip-ready">Live Backend Endpoint</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-get">LOCAL</span></td>
                  <td><code>mockTransactions.js</code></td>
                  <td>Dashboard Table & Demo Chat</td>
                  <td><span className="status-chip chip-mock">Simulated (DEMO DATA)</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="settings-footer-actions">
            <button
              type="button"
              onClick={handleSave}
              className="save-settings-btn"
            >
              <span>Save Local Demo Preferences</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
