import { useState } from 'react';
import { SparklesIcon, RefreshCwIcon, InfoIcon, ShieldCheckIcon, CloseIcon } from './icons/Icons';

export function DemoBanner({ onSimulateEvent, onResetData, isSimulating }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (isDismissed) {
    return (
      <div className="demo-banner-collapsed">
        <div className="demo-banner-collapsed-content">
          <span className="demo-indicator-dot"></span>
          <span className="demo-tag">DEMO DATA</span>
          <span className="demo-subtext">PayPal AI Hackathon Simulation Mode</span>
        </div>
        <button 
          onClick={() => setIsDismissed(false)}
          className="demo-expand-btn"
          title="Show demo details"
        >
          Expand Notice
        </button>
      </div>
    );
  }

  return (
    <div className="demo-banner">
      <div className="demo-banner-main">
        <div className="demo-banner-left">
          <div className="demo-badge-pill">
            <span className="demo-badge-dot"></span>
            <span className="font-bold">SANDBOX SIMULATION</span>
          </div>
          <div className="demo-message">
            <span className="demo-headline">
              PayPal AI Hackathon Showcase
            </span>
            <span className="demo-divider">|</span>
            <span className="demo-description">
              All transactions, balances, and AI explanations are synthetic sandbox records. Real money movement, captures, and refunds are disabled.
            </span>
          </div>
        </div>

        <div className="demo-banner-actions">
          <button 
            type="button"
            onClick={onSimulateEvent}
            disabled={isSimulating}
            className="demo-action-btn simulate-btn"
            title="Simulate a new incoming PayPal transaction event"
          >
            <RefreshCwIcon size={14} className={isSimulating ? "spin-animation" : ""} />
            <span>{isSimulating ? "Simulating..." : "Simulate Webhook"}</span>
          </button>

          <button 
            type="button"
            onClick={onResetData}
            className="demo-action-btn reset-btn"
            title="Reset to default mock data"
          >
            Reset
          </button>

          <button 
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="demo-action-btn info-btn"
            title="What is Transaction Clarity Copilot?"
          >
            <InfoIcon size={14} />
            <span>{showDetails ? "Hide Info" : "Why Copilot?"}</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsDismissed(true)}
            className="demo-close-btn"
            aria-label="Dismiss banner"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="demo-banner-accordion">
          <div className="demo-accordion-grid">
            <div className="demo-accordion-card">
              <div className="demo-accordion-card-title">
                <ShieldCheckIcon size={16} />
                <span>The Problem: Consumer Panic & Chargebacks</span>
              </div>
              <p>
                Millions of users panic over cryptic descriptors like <code>PAYPAL *XF829-SPO</code> or normal authorization holds, immediately disputing charges with their bank.
              </p>
            </div>

            <div className="demo-accordion-card">
              <div className="demo-accordion-card-title">
                <SparklesIcon size={16} />
                <span>The Solution: AI Transaction Clarity Copilot</span>
              </div>
              <p>
                Our Copilot decodes descriptors into recognized merchants, explains banking holds in human language, and suggests safe next steps before premature disputes happen.
              </p>
            </div>

            <div className="demo-accordion-card">
              <div className="demo-accordion-card-title">
                <InfoIcon size={16} />
                <span>Safety Architecture</span>
              </div>
              <p>
                Strictly read-only advisory model. Copilot never moves funds, executes refunds, or alters balances. All insights are explainable and verifiable.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DemoBanner;
