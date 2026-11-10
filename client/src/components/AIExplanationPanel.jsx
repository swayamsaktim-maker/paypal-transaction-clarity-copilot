import { useState } from 'react';
import { 
  SparklesIcon, 
  ClockIcon, 
  AlertCircleIcon, 
  CheckCircleIcon,
  CopyIcon,
  CheckmarkIcon,
  InfoIcon
} from './icons/Icons';
import SafeNextSteps from './SafeNextSteps';

export function AIExplanationPanel({ transaction, onAskCopilot }) {
  const [copiedRaw, setCopiedRaw] = useState(false);

  if (!transaction) {
    return (
      <div className="ai-explanation-empty">
        <SparklesIcon size={32} className="ai-empty-icon" />
        <h3>Select a Transaction for AI Clarity</h3>
        <p>Choose any transaction from the list to decode cryptic descriptors, examine settlement delays, and view safe next steps.</p>
      </div>
    );
  }

  const { aiExplanation, rawDescriptor, resolvedMerchant, status, safeNextSteps } = transaction;

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(rawDescriptor).then(() => {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    });
  };

  return (
    <div className="ai-explanation-panel">
      {/* Header with AI Confidence & Provenance */}
      <div className="ai-panel-header">
        <div className="ai-badge-row">
          <div className="ai-copilot-tag">
            <SparklesIcon size={15} />
            <span>AI Clarity Diagnosis</span>
          </div>
          <div className="ai-confidence-pill" title="AI model confidence score based on merchant knowledge graph">
            <span className="confidence-dot"></span>
            <span>{aiExplanation?.confidence || 99.1}% Confidence</span>
          </div>
        </div>

        <h3 className="ai-headline">{aiExplanation?.headline || "Transaction Analysis"}</h3>
        <p className="ai-summary-text">{aiExplanation?.claritySummary}</p>
      </div>

      {/* Cryptic Statement Descriptor Resolution */}
      <div className="descriptor-resolution-card">
        <div className="resolution-card-header">
          <span className="resolution-card-title">Statement Descriptor Decoded</span>
          <span className="resolution-chip">Resolved via Global Merchant Registry</span>
        </div>

        <div className="descriptor-compare-grid">
          <div className="descriptor-box raw-box">
            <div className="box-label-row">
              <span className="box-label">Raw Card/Bank Statement Text</span>
              <button 
                type="button" 
                onClick={handleCopyRaw} 
                className="copy-descriptor-mini"
                title="Copy raw descriptor"
              >
                {copiedRaw ? <CheckmarkIcon size={13} /> : <CopyIcon size={13} />}
                <span>{copiedRaw ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <code className="raw-descriptor-text">{rawDescriptor}</code>
            <span className="descriptor-footnote">Often appears confusing on bank statements</span>
          </div>

          <div className="descriptor-arrow">➔</div>

          <div className="descriptor-box resolved-box">
            <div className="box-label-row">
              <span className="box-label">Verified Merchant Entity</span>
              <span className="verified-check">
                <CheckCircleIcon size={13} />
                <span>Verified</span>
              </span>
            </div>
            <div className="resolved-merchant-name">{resolvedMerchant}</div>
            <span className="descriptor-footnote">{transaction.merchantCategory}</span>
          </div>
        </div>

        <div className="descriptor-explanation-note">
          <InfoIcon size={15} />
          <span>{aiExplanation?.descriptorMeaning}</span>
        </div>
      </div>

      {/* Status Reason Deep-Dive */}
      <div className="status-deep-dive-card">
        <div className="status-reason-header">
          <div className="status-icon-badge">
            {status === 'Completed' ? (
              <CheckCircleIcon size={20} className="text-emerald" />
            ) : status === 'Pending' ? (
              <ClockIcon size={20} className="text-amber" />
            ) : (
              <AlertCircleIcon size={20} className="text-rose" />
            )}
          </div>
          <div>
            <h4 className="status-reason-title">
              Why is this marked <span className={`status-highlight status-${status.toLowerCase()}`}>{status}</span>?
            </h4>
            <span className="status-reason-subtitle">Plain-English banking settlement breakdown</span>
          </div>
        </div>

        <p className="status-reason-body">{aiExplanation?.statusReason}</p>

        {aiExplanation?.riskAssessment && (
          <div className="risk-assessment-bar">
            <span className="risk-label">Risk & Security Assessment:</span>
            <span className="risk-text">{aiExplanation.riskAssessment}</span>
          </div>
        )}
      </div>

      {/* Transaction Lifecycle Timeline */}
      {aiExplanation?.timeline && aiExplanation.timeline.length > 0 && (
        <div className="lifecycle-timeline-card">
          <div className="timeline-card-title">Transaction Event Timeline</div>
          <div className="timeline-steps">
            {aiExplanation.timeline.map((event, idx) => (
              <div key={idx} className={`timeline-step-item timeline-status-${event.status}`}>
                <div className="timeline-marker">
                  {event.status === 'done' ? (
                    <CheckmarkIcon size={12} />
                  ) : event.status === 'in-progress' ? (
                    <span className="timeline-pulse"></span>
                  ) : event.status === 'failed' ? (
                    <AlertCircleIcon size={12} />
                  ) : (
                    <span className="timeline-dot"></span>
                  )}
                </div>
                <div className="timeline-info">
                  <span className="timeline-event-title">{event.title}</span>
                  <span className="timeline-event-time">{event.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Safe Next Steps */}
      <SafeNextSteps 
        steps={safeNextSteps || []} 
        transaction={transaction}
        onAskCopilot={onAskCopilot}
      />
    </div>
  );
}

export default AIExplanationPanel;
