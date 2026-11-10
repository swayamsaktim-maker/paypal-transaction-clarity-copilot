import { useState } from 'react';
import { 
  SettingsIcon, 
  ShieldCheckIcon, 
  SparklesIcon, 
  CheckmarkIcon
} from '../components/icons/Icons';

export function SettingsView() {
  const [clarityTone, setClarityTone] = useState('reassuring');
  const [modelChoice, setModelChoice] = useState('gemini-2.5-flash');
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
            <h1 className="view-title">Copilot Settings & Sandbox Controls</h1>
            <span className="demo-pill-small">SANDBOX SIMULATION</span>
          </div>
          <p className="view-subtitle">
            Configure AI explanation parameters, sandbox safety guardrails, and backend integration endpoints.
          </p>
        </div>

        {saveToast && (
          <div className="settings-toast">
            <CheckmarkIcon size={14} />
            <span>Preferences Saved to Local Session</span>
          </div>
        )}
      </div>

      <div className="settings-cards-grid">
        {/* Card 1: AI Model & Clarity Engine */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="card-header-icon-wrap">
              <SparklesIcon size={18} />
            </div>
            <div>
              <h3 className="card-title">AI Clarity Engine</h3>
              <p className="card-desc">Configure the AI model and explanation style</p>
            </div>
          </div>

          <div className="settings-form-group">
            <label className="form-label">Underlying Model</label>
            <select
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value)}
              className="form-select"
            >
              <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (Recommended: Low Latency ~0.4s)</option>
              <option value="gemini-2.5-pro">Google Gemini 2.5 Pro (Deep Banking Reasoning)</option>
              <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Legacy)</option>
            </select>
            <span className="form-help">Selected model will power the forthcoming backend REST API integration.</span>
          </div>

          <div className="settings-form-group">
            <label className="form-label">Clarity Communication Tone</label>
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
              <span className="toggle-title">Automatic Descriptor Decoding</span>
              <span className="toggle-sub">Instantly match cryptic statement strings against PayPal's merchant directory</span>
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
              <span className="toggle-title">Dispute Guard Active</span>
              <span className="toggle-sub">Pre-screen confusing charges with AI before suggesting a bank dispute</span>
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
              <p className="card-desc">Fintech hackathon security and compliance boundaries</p>
            </div>
          </div>

          <div className="guardrail-items-list">
            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">Real Money Movement Disabled</span>
                <p className="guardrail-desc">
                  This prototype is strictly an advisory clarity layer. It does NOT initiate captures, payouts, charges, or withdrawals.
                </p>
              </div>
            </div>

            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">Dispute Guard Interlock Enabled</span>
                <p className="guardrail-desc">
                  Premature disputes are intercepted with reassuring guidance before sending buyers to formal claims.
                </p>
              </div>
            </div>

            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">Zero API Key or Secret Exposure</span>
                <p className="guardrail-desc">
                  No secrets or real PayPal client keys are bundled in client assets. Future calls proxy through secure backend routes.
                </p>
              </div>
            </div>

            <div className="guardrail-item">
              <div className="guardrail-icon-done">
                <CheckmarkIcon size={16} />
              </div>
              <div className="guardrail-content">
                <span className="guardrail-title">Synthetic Sandbox Data Only</span>
                <p className="guardrail-desc">
                  All transaction records, merchant identifiers, and bank accounts are simulated mock data for demo purposes.
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
              <h3 className="card-title">Backend Architecture & API Roadmap</h3>
              <p className="card-desc">Endpoints ready for live PayPal Sandbox REST API and Gemini integration</p>
            </div>
          </div>

          <div className="endpoints-table-wrap">
            <table className="endpoints-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Service</th>
                  <th>Status in Prototype</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="http-badge http-get">GET</span></td>
                  <td><code>/api/v1/paypal/transactions</code></td>
                  <td>PayPal Sandbox REST API</td>
                  <td><span className="status-chip chip-mock">Simulated (mockTransactions.js)</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-post">POST</span></td>
                  <td><code>/api/v1/copilot/explain</code></td>
                  <td>Google Gemini 2.5 API</td>
                  <td><span className="status-chip chip-ready">Ready for Hookup</span></td>
                </tr>
                <tr>
                  <td><span className="http-badge http-post">POST</span></td>
                  <td><code>/api/v1/webhooks/paypal</code></td>
                  <td>PayPal Webhook Listener</td>
                  <td><span className="status-chip chip-simulated">Simulated in UI</span></td>
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
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
