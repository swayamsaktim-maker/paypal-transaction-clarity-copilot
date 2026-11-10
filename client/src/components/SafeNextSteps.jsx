import { useState } from 'react';
import { 
  ShieldCheckIcon, 
  CheckmarkIcon, 
  CopyIcon, 
  AlertTriangleIcon, 
  InfoIcon, 
  SparklesIcon,
  ExternalLinkIcon
} from './icons/Icons';

export function SafeNextSteps({ steps = [], transaction, onAskCopilot }) {
  const [copiedId, setCopiedId] = useState(null);
  const [completedSteps, setCompletedSteps] = useState({});

  const handleCopySummary = () => {
    if (!transaction) return;
    const summaryText = `[PayPal Clarity Copilot] ${transaction.resolvedMerchant} (${transaction.id})
Status: ${transaction.status} | Amount: ${transaction.direction === 'debit' ? '-' : '+'}$${transaction.amount.toFixed(2)} ${transaction.currency}
AI Explanation: ${transaction.aiExplanation?.claritySummary || 'N/A'}
Recommended Next Steps:
${steps.map((s, idx) => `${idx + 1}. ${s.title}: ${s.description}`).join('\n')}`;

    navigator.clipboard.writeText(summaryText).then(() => {
      setCopiedId('summary');
      setTimeout(() => setCopiedId(null), 2200);
    }).catch(() => {
      // fallback
    });
  };

  const toggleStepDone = (id) => {
    setCompletedSteps(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="safe-next-steps-container">
      <div className="safe-steps-header">
        <div className="safe-steps-title-group">
          <div className="safe-steps-icon-badge">
            <ShieldCheckIcon size={18} />
          </div>
          <div>
            <h4 className="safe-steps-title">Suggested Safe Next Steps</h4>
            <p className="safe-steps-subtitle">
              Verified fintech guidance designed to prevent duplicate debits, delays & premature disputes
            </p>
          </div>
        </div>

        <button 
          type="button"
          onClick={handleCopySummary}
          className="copy-summary-btn"
          title="Copy plain-English explanation and steps to clipboard"
        >
          {copiedId === 'summary' ? (
            <>
              <CheckmarkIcon size={14} />
              <span>Copied Summary!</span>
            </>
          ) : (
            <>
              <CopyIcon size={14} />
              <span>Copy Guidance</span>
            </>
          )}
        </button>
      </div>

      <div className="safe-steps-list">
        {steps.map((step, idx) => {
          const isDone = !!completedSteps[step.id];
          const severityIcon = step.severity === 'warning' 
            ? <AlertTriangleIcon size={16} /> 
            : step.severity === 'safe'
            ? <ShieldCheckIcon size={16} />
            : <InfoIcon size={16} />;

          return (
            <div 
              key={step.id || idx} 
              className={`safe-step-card safe-step-${step.severity || 'info'} ${isDone ? 'step-completed' : ''}`}
            >
              <div className="safe-step-left">
                <button
                  type="button"
                  onClick={() => toggleStepDone(step.id)}
                  className={`step-checkbox ${isDone ? 'checked' : ''}`}
                  title={isDone ? "Mark as pending" : "Mark as reviewed"}
                >
                  {isDone ? <CheckmarkIcon size={14} /> : <span className="step-number">{idx + 1}</span>}
                </button>
              </div>

              <div className="safe-step-content">
                <div className="safe-step-title-row">
                  <span className="safe-step-heading">{step.title}</span>
                  <span className={`safe-step-pill pill-${step.severity || 'info'}`}>
                    {severityIcon}
                    <span>{step.severity === 'warning' ? 'Important' : step.severity === 'safe' ? 'Recommended' : 'Info'}</span>
                  </span>
                </div>

                <p className="safe-step-description">{step.description}</p>

                {step.actionText && (
                  <div className="safe-step-action-row">
                    <button 
                      type="button"
                      onClick={() => {
                        if (onAskCopilot) {
                          onAskCopilot(`How do I proceed with step "${step.title}" for transaction ${transaction?.id}?`);
                        }
                      }}
                      className="step-inline-action-btn"
                    >
                      <span>{step.actionText}</span>
                      <ExternalLinkIcon size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {onAskCopilot && (
        <div className="safe-steps-footer-prompt">
          <div className="prompt-content">
            <SparklesIcon size={16} className="prompt-icon" />
            <span>Unsure about any of these recommendations? Ask the Copilot to elaborate.</span>
          </div>
          <button 
            type="button"
            onClick={() => onAskCopilot(`Can you explain why you suggested these steps for ${transaction?.resolvedMerchant}?`)}
            className="ask-copilot-mini-btn"
          >
            Ask Copilot
          </button>
        </div>
      )}
    </div>
  );
}

export default SafeNextSteps;
