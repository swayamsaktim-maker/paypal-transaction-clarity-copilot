import { useEffect, useState } from 'react';
import { 
  CloseIcon, 
  CopyIcon, 
  CheckmarkIcon, 
  CreditCardIcon, 
  BankIcon, 
  ShieldCheckIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  SparklesIcon
} from './icons/Icons';
import StatusBadge from './StatusBadge';
import AIExplanationPanel from './AIExplanationPanel';

export function TransactionDetailModal({ transaction, onClose, onAskCopilot }) {
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState('explanation'); // 'explanation' or 'ledger'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!transaction) return null;

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(field);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const isDebit = transaction.direction === 'debit';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Top Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-title-row">
              <span className="modal-badge-sandbox">DEMO DATA</span>
              <h2 id="modal-title" className="modal-title">Transaction Clarity Inspection</h2>
            </div>
            <div className="modal-tx-meta">
              <span className="tx-id-label">ID:</span>
              <code className="tx-id-code">{transaction.id}</code>
              <button 
                type="button" 
                onClick={() => handleCopy(transaction.id, 'id')}
                className="tx-copy-btn"
                title="Copy Transaction ID"
              >
                {copiedId === 'id' ? <CheckmarkIcon size={13} /> : <CopyIcon size={13} />}
              </button>
              <span className="tx-meta-divider">•</span>
              <span className="tx-meta-date">{transaction.dateFormatted}</span>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Modal Summary Hero Bar */}
        <div className="modal-hero-bar">
          <div className="modal-hero-entity">
            <div className="modal-entity-icon">
              {isDebit ? <ArrowUpRight size={22} /> : <ArrowDownLeft size={22} />}
            </div>
            <div className="modal-entity-details">
              <span className="modal-entity-role">{isDebit ? 'Paid to' : 'Received from'}</span>
              <h3 className="modal-entity-name">{transaction.resolvedMerchant}</h3>
              <span className="modal-entity-category">{transaction.merchantCategory}</span>
            </div>
          </div>

          <div className="modal-hero-financials">
            <div className="modal-amount-display">
              <span className={`modal-amount ${isDebit ? 'text-debit' : 'text-credit'}`}>
                {isDebit ? '-' : '+'}${transaction.amount.toFixed(2)}
              </span>
              <span className="modal-currency">{transaction.currency}</span>
            </div>
            <div className="modal-status-pill">
              <StatusBadge status={transaction.status} size="lg" />
            </div>
          </div>
        </div>

        {/* Tab Navigation for modal */}
        <div className="modal-tab-bar">
          <button 
            type="button"
            onClick={() => setActiveTab('explanation')}
            className={`modal-tab-btn ${activeTab === 'explanation' ? 'active' : ''}`}
          >
            <SparklesIcon size={16} />
            <span>AI Clarity & Safe Next Steps</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`modal-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          >
            <CreditCardIcon size={16} />
            <span>Ledger, Fees & Protection</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="modal-body-scroll">
          {activeTab === 'explanation' ? (
            <AIExplanationPanel 
              transaction={transaction}
              onAskCopilot={(prompt) => {
                onClose();
                if (onAskCopilot) onAskCopilot(prompt, transaction);
              }}
            />
          ) : (
            <div className="modal-ledger-panel">
              {/* Financial Breakdown Table */}
              <div className="ledger-card">
                <h4 className="ledger-card-title">Accounting & Settlement Breakdown</h4>
                <div className="ledger-table">
                  <div className="ledger-row">
                    <span className="ledger-label">Gross Transaction Amount</span>
                    <span className="ledger-value font-semibold">
                      ${transaction.amount.toFixed(2)} {transaction.currency}
                    </span>
                  </div>
                  <div className="ledger-row">
                    <span className="ledger-label">PayPal Processing Fee</span>
                    <span className="ledger-value text-muted">
                      {transaction.fee > 0 ? `-$${transaction.fee.toFixed(2)} ${transaction.currency}` : '$0.00 USD'}
                    </span>
                  </div>
                  <div className="ledger-row-divider"></div>
                  <div className="ledger-row total-row">
                    <span className="ledger-label">Net Settlement Amount</span>
                    <span className="ledger-value font-bold text-navy">
                      ${transaction.net.toFixed(2)} {transaction.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Details */}
              <div className="ledger-card">
                <h4 className="ledger-card-title">Payment Instrument Used</h4>
                <div className="payment-instrument-box">
                  <div className="instrument-icon">
                    {transaction.paymentMethod?.type?.toLowerCase().includes('bank') ? (
                      <BankIcon size={22} />
                    ) : (
                      <CreditCardIcon size={22} />
                    )}
                  </div>
                  <div className="instrument-info">
                    <div className="instrument-title">
                      {transaction.paymentMethod?.brand}
                      {transaction.paymentMethod?.last4 !== 'N/A' && ` (•••• ${transaction.paymentMethod?.last4})`}
                    </div>
                    <div className="instrument-meta">
                      Type: {transaction.paymentMethod?.type} • Backup: {transaction.paymentMethod?.backup}
                    </div>
                  </div>
                </div>
              </div>

              {/* Protection Status */}
              <div className="ledger-card">
                <h4 className="ledger-card-title">PayPal Protection Coverage</h4>
                <div className="protection-card-content">
                  <div className="protection-status-row">
                    <ShieldCheckIcon size={20} className={transaction.protection?.eligible ? 'text-emerald' : 'text-muted'} />
                    <span className="protection-program-name">
                      {transaction.protection?.program || 'Standard Policy'}
                    </span>
                    <span className={`protection-badge ${transaction.protection?.eligible ? 'eligible' : 'ineligible'}`}>
                      {transaction.protection?.eligible ? 'Eligible' : 'Not Applicable'}
                    </span>
                  </div>
                  <p className="protection-details">{transaction.protection?.details}</p>
                </div>
              </div>

              {/* Technical / Reference Identifiers */}
              <div className="ledger-card">
                <h4 className="ledger-card-title">Identifiers & Traceability</h4>
                <div className="identifiers-grid">
                  <div className="ident-item">
                    <span className="ident-label">PayPal Transaction ID</span>
                    <code className="ident-value">{transaction.id}</code>
                  </div>
                  <div className="ident-item">
                    <span className="ident-label">Merchant Invoice ID</span>
                    <code className="ident-value">{transaction.invoiceId || 'N/A'}</code>
                  </div>
                  <div className="ident-item">
                    <span className="ident-label">Raw Card Statement String</span>
                    <code className="ident-value">{transaction.rawDescriptor}</code>
                  </div>
                  <div className="ident-item">
                    <span className="ident-label">Environment</span>
                    <span className="ident-value text-amber font-semibold">PayPal Sandbox (Demo)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="modal-footer-disclaimer">
            <span className="disclaimer-dot"></span>
            <span>Simulated Hackathon Sandbox Record • Real money movement is disabled.</span>
          </div>

          <div className="modal-footer-actions">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onAskCopilot) {
                  onAskCopilot(`Can you give me a comprehensive breakdown of transaction ${transaction.id}?`, transaction);
                }
              }}
              className="modal-copilot-btn"
            >
              <SparklesIcon size={16} />
              <span>Ask Copilot About This</span>
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="modal-dismiss-btn"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransactionDetailModal;
