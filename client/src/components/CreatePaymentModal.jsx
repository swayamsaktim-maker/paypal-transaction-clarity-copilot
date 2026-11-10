import { useEffect, useState, useCallback } from 'react';
import { 
  PayPalLogo, 
  CloseIcon, 
  CopyIcon, 
  CheckmarkIcon, 
  ExternalLinkIcon, 
  AlertCircleIcon, 
  RefreshCwIcon,
  InfoIcon
} from './icons/Icons';

export function CreatePaymentModal({ 
  isOpen, 
  isLoading, 
  error, 
  orderData, 
  onClose, 
  onRetry 
}) {
  const [copied, setCopied] = useState(false);
  const [redirectError, setRedirectError] = useState(null);

  const handleClose = useCallback(() => {
    setRedirectError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, handleClose]);

  if (!isOpen) return null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleContinueToPayPal = () => {
    if (orderData?.approvalUrl) {
      setRedirectError(null);
      window.location.href = orderData.approvalUrl;
    } else {
      setRedirectError('The checkout link was not returned by PayPal Sandbox. Please close this dialog and try again.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!isLoading) handleClose(); }}>
      <div 
        className="modal-container create-payment-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        {/* Modal Top Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-title-row">
              <span className="modal-badge-sandbox">PAYPAL SANDBOX API</span>
              <h2 id="payment-modal-title" className="modal-title">Create Sandbox Payment</h2>
            </div>
            <p className="modal-subtitle">
              Initiates a real order on PayPal Sandbox via <code>POST http://localhost:5000/api/paypal/orders</code>
            </p>
          </div>

          {!isLoading && (
            <button 
              type="button" 
              onClick={handleClose}
              className="modal-close-btn"
              aria-label="Close dialog"
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="modal-body-scroll create-payment-body">
          {/* Loading State */}
          {isLoading && (
            <div className="payment-loading-state">
              <div className="payment-spinner-wrap">
                <div className="payment-spinner"></div>
                <PayPalLogo size={28} className="payment-spinner-icon" />
              </div>
              <h3 className="loading-heading">Connecting to PayPal Sandbox API...</h3>
              <p className="loading-subtext">
                Requesting OAuth access token and generating order for <strong>$10.00 USD</strong>.
              </p>
              <div className="loading-target-chip">
                <span>Endpoint:</span>
                <code>POST http://localhost:5000/api/paypal/orders</code>
              </div>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="payment-error-state">
              <div className="error-icon-badge">
                <AlertCircleIcon size={32} />
              </div>
              <h3 className="error-heading">Failed to Create Sandbox Order</h3>
              <p className="error-message-text">{error}</p>

              <div className="error-help-box">
                <InfoIcon size={16} className="error-help-icon" />
                <div className="error-help-content">
                  <span className="error-help-title">Troubleshooting Connection:</span>
                  <p>
                    Verify that your backend server is running on <code>http://localhost:5000</code>.
                    In a separate terminal, run:
                  </p>
                  <code className="error-help-code">cd server; node index.js</code>
                </div>
              </div>

              <div className="error-actions-row">
                <button 
                  type="button"
                  onClick={onRetry}
                  className="payment-retry-btn"
                >
                  <RefreshCwIcon size={14} />
                  <span>Retry Order Creation</span>
                </button>
                <button 
                  type="button"
                  onClick={handleClose}
                  className="payment-cancel-btn"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {!isLoading && !error && orderData && (
            <div className="payment-success-state">
              <div className="payment-success-header">
                <div className="success-badge-icon">
                  <CheckmarkIcon size={22} />
                </div>
                <div>
                  <h3 className="success-heading">PayPal Sandbox Order Created</h3>
                  <span className="success-sub">Order successfully initialized with intent <strong>CAPTURE</strong></span>
                </div>
              </div>

              {/* Order Data Breakdown */}
              <div className="order-details-card">
                <div className="order-detail-row">
                  <span className="order-detail-label">Order ID:</span>
                  <div className="order-id-group">
                    <code className="order-id-value">{orderData.orderId}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(orderData.orderId)}
                      className="order-copy-btn"
                      title="Copy PayPal Order ID"
                    >
                      {copied ? <CheckmarkIcon size={13} /> : <CopyIcon size={13} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="order-detail-row">
                  <span className="order-detail-label">Status:</span>
                  <div className="order-status-group">
                    <span className="order-status-badge badge-created">
                      <span className="status-dot"></span>
                      <span>{orderData.status || "CREATED"}</span>
                    </span>
                    <span className="order-status-hint">Awaiting buyer approval</span>
                  </div>
                </div>

                <div className="order-detail-row">
                  <span className="order-detail-label">Amount:</span>
                  <span className="order-amount-value">$10.00 USD</span>
                </div>

                <div className="order-detail-row">
                  <span className="order-detail-label">Description:</span>
                  <span className="order-desc-value">PayPal Clarity Hackathon Demo</span>
                </div>

                {orderData.approvalUrl ? (
                  <div className="order-detail-row approval-row">
                    <span className="order-detail-label">Approval URL:</span>
                    <a 
                      href={orderData.approvalUrl} 
                      className="order-approval-link"
                      title={orderData.approvalUrl}
                    >
                      {orderData.approvalUrl}
                    </a>
                  </div>
                ) : (
                  <div className="order-detail-row approval-row">
                    <span className="order-detail-label">Approval URL:</span>
                    <span className="order-missing-link-text">Not returned by PayPal Sandbox</span>
                  </div>
                )}
              </div>

              {/* Warning when approval link is missing or redirection failed */}
              {(!orderData.approvalUrl || redirectError) && (
                <div className="approval-warning-box">
                  <AlertCircleIcon size={18} className="approval-warning-icon" />
                  <div className="approval-warning-content">
                    <span className="approval-warning-title">Checkout Link Unavailable</span>
                    <p>
                      {redirectError || "The PayPal Sandbox checkout link was not returned. Please close this dialog and try creating the payment again."}
                    </p>
                  </div>
                </div>
              )}

              {/* Verified Clarity Caution Callout */}
              <div className="clarity-capture-notice">
                <div className="notice-icon">
                  <InfoIcon size={18} />
                </div>
                <div className="notice-content">
                  <span className="notice-title">Important Payment Status Notice</span>
                  <p>
                    This order is <strong>CREATED</strong> and awaiting buyer authorization. Funds are <strong>NOT</strong> yet captured or debited. Only PayPal's verified capture response can establish successful capture.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="payment-actions-footer">
                <button
                  type="button"
                  onClick={handleContinueToPayPal}
                  disabled={!orderData.approvalUrl}
                  className="continue-paypal-btn"
                  title={orderData.approvalUrl ? "Redirect to PayPal Sandbox for approval" : "Checkout link not returned — please try again"}
                >
                  <PayPalLogo size={18} />
                  <span>Continue to PayPal</span>
                  <ExternalLinkIcon size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="dismiss-modal-btn"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreatePaymentModal;

