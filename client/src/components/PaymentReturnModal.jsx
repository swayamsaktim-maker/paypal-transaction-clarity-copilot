import { useEffect, useState, useCallback } from 'react';
import { 
  PayPalLogo, 
  CloseIcon, 
  CopyIcon, 
  CheckmarkIcon, 
  AlertCircleIcon, 
  RefreshCwIcon,
  InfoIcon
} from './icons/Icons';
import { apiService } from '../services/apiService';

export function PaymentReturnModal({ 
  isOpen, 
  token, 
  isCancelled, 
  onClose, 
  onCaptureSuccess 
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Derived loading state: true while open with a candidate token before order or error settles
  const isLoading = Boolean(token) && !order && !error;

  // Retrieve actual order details from PayPal Sandbox via backend
  useEffect(() => {
    if (!isOpen || !token) return;

    let isCurrent = true;
    apiService.getOrder(token)
      .then((data) => {
        if (!isCurrent) return;
        if (data.orderId !== token) {
          throw new Error("Returned order ID does not match the verification token.");
        }
        setOrder(data);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err.message || "Failed to verify order details with PayPal Sandbox.");
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, token, retryTrigger]);

  const handleRetry = useCallback(() => {
    setOrder(null);
    setError(null);
    setCaptureError(null);
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isCapturing && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCapturing, isLoading, onClose]);

  if (!isOpen) return null;

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCapture = async () => {
    if (!order?.orderId || isCapturing) return;

    setIsCapturing(true);
    setCaptureError(null);

    try {
      await apiService.captureOrder(order.orderId);
      // Re-retrieve verified order from PayPal Sandbox to guarantee verified final state
      const verifiedLatest = await apiService.getOrder(order.orderId);
      setOrder(verifiedLatest);
      if (onCaptureSuccess) {
        onCaptureSuccess(verifiedLatest);
      }
    } catch (err) {
      setCaptureError(err.message || "Failed to capture payment.");
    } finally {
      setIsCapturing(false);
    }
  };

  const isApproved = order?.status === 'APPROVED';
  const isCompleted = order?.isCompleted || order?.status === 'COMPLETED';
  const isPayerActionRequired = order?.status === 'PAYER_ACTION_REQUIRED';

  // Modal Title based on verified order status & checkout return outcome
  const getModalTitle = () => {
    if (order) {
      if (isCompleted) return "Payment Completed";
      if (isApproved) return "Buyer Approval Confirmed";
      if (isPayerActionRequired) return "Payment Authorization Incomplete";
      if (order.status === 'VOIDED') return "Order Voided";
      return `PayPal Order: ${order.status}`;
    }
    if (isCancelled && !token) return "PayPal Checkout Closed";
    if (error) return "Order Verification Failed";
    return "Verifying PayPal Order Status";
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!isCapturing && !isLoading) onClose(); }}>
      <div 
        className="modal-container create-payment-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-modal-title"
      >
        {/* Modal Top Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-title-row">
              <span className="modal-badge-sandbox">PAYPAL SANDBOX VERIFICATION</span>
              <h2 id="return-modal-title" className="modal-title">
                {getModalTitle()}
              </h2>
            </div>
            <p className="modal-subtitle">
              Live order verification via <code>GET /api/paypal/orders/:orderId</code>
            </p>
          </div>

          {!isCapturing && !isLoading && (
            <button 
              type="button" 
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close dialog"
            >
              <CloseIcon size={20} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="modal-body-scroll create-payment-body">

          {/* Case 1: Cancelled route without a token */}
          {isCancelled && !token && (
            <div className="payment-error-state">
              <div className="error-icon-badge cancel-icon-badge">
                <InfoIcon size={32} />
              </div>
              <h3 className="error-heading">Checkout Closed Without Token</h3>
              <p className="error-message-text">
                The buyer session was closed without returning an order token. No order reference was provided to verify with PayPal. No funds were debited or captured.
              </p>
              <div className="error-actions-row">
                <button 
                  type="button"
                  onClick={onClose}
                  className="payment-cancel-btn"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Case 2: Loading State (actively verifying candidate token with PayPal) */}
          {isLoading && (
            <div className="payment-loading-state">
              <div className="payment-spinner-wrap">
                <div className="payment-spinner"></div>
                <PayPalLogo size={28} className="payment-spinner-icon" />
              </div>
              <h3 className="loading-heading">Checking Verified PayPal Order Status...</h3>
              <p className="loading-subtext">
                {isCancelled
                  ? `Buyer returned from checkout. Fetching actual order state from PayPal Sandbox for order ${token}...`
                  : `Retrieving verified order status and buyer approval details for order ${token}...`}
              </p>
              <div className="loading-target-chip">
                <span>Endpoint:</span>
                <code>GET http://localhost:5000/api/paypal/orders/{token}</code>
              </div>
            </div>
          )}

          {/* Case 3: Error State (API call failed or token didn't match) */}
          {!isLoading && error && (
            <div className="payment-error-state">
              <div className="error-icon-badge">
                <AlertCircleIcon size={32} />
              </div>
              <h3 className="error-heading">PayPal Order Status Unverified</h3>
              <p className="error-message-text">{error}</p>
              <p className="error-sub-text" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Because the backend could not verify the order with PayPal Sandbox, the payment status cannot be confirmed. Do not assume funds were captured or that the order was cancelled.
              </p>

              {token && (
                <div className="order-details-card" style={{ marginTop: '16px', textAlign: 'left' }}>
                  <div className="order-detail-row">
                    <span className="order-detail-label">Candidate Order ID:</span>
                    <div className="order-id-group">
                      <code className="order-id-value">{token}</code>
                      <button
                        type="button"
                        onClick={() => handleCopy(token)}
                        className="order-copy-btn"
                        title="Copy Order ID"
                      >
                        {copied ? <CheckmarkIcon size={13} /> : <CopyIcon size={13} />}
                        <span>{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="error-actions-row">
                <button 
                  type="button"
                  onClick={handleRetry}
                  className="payment-retry-btn"
                >
                  <RefreshCwIcon size={14} />
                  <span>Retry Verification</span>
                </button>
                <button 
                  type="button"
                  onClick={onClose}
                  className="payment-cancel-btn"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Case 4: Verified Order State (order successfully retrieved from PayPal Sandbox) */}
          {!isLoading && !error && order && (
            <div className="payment-success-state">
              
              {/* Separate Info 1: Checkout Outcome Banner */}
              <div className={`checkout-outcome-banner ${isCancelled ? 'outcome-interrupted' : 'outcome-returned'}`}>
                <div className="outcome-icon">
                  <InfoIcon size={18} />
                </div>
                <div className="outcome-text">
                  <span className="outcome-title">
                    {isCancelled 
                      ? "Checkout Outcome: Buyer Returned from PayPal Checkout" 
                      : "Checkout Outcome: Standard Return Redirect"}
                  </span>
                  <p>
                    {isCancelled 
                      ? "The buyer returned to the application via the cancellation route. This occurs when a buyer clicks cancel or when a transaction is declined or interrupted by PayPal. The actual order status on PayPal is shown below."
                      : "The buyer completed the PayPal interaction and returned via the completion redirect."}
                  </p>
                </div>
              </div>

              {/* Status Header Badge */}
              <div className="payment-success-header">
                <div className={`success-badge-icon ${isCompleted ? 'badge-icon-completed' : isApproved ? 'badge-icon-approved' : 'badge-icon-pending'}`}>
                  {isCompleted ? <CheckmarkIcon size={22} /> : isApproved ? <PayPalLogo size={22} /> : <InfoIcon size={22} />}
                </div>
                <div>
                  <h3 className="success-heading">
                    {isCompleted 
                      ? "Payment Captured & Completed" 
                      : isApproved 
                        ? "Buyer Approval Confirmed" 
                        : isPayerActionRequired
                          ? "PayPal Status: Authorization Incomplete"
                          : `PayPal Status: ${order.status}`}
                  </h3>
                  <span className="success-sub">
                    {isCompleted 
                      ? "Verified capture confirmed on PayPal Sandbox ledger" 
                      : isApproved 
                        ? "Buyer has authorized the payment. Ready for capture." 
                        : isPayerActionRequired
                          ? "PayPal did not confirm approval; authorization remains pending on PayPal Sandbox."
                          : `Reported by PayPal Sandbox API as ${order.status}`}
                  </span>
                </div>
              </div>

              {/* Order Data Breakdown */}
              <div className="order-details-card">
                <div className="order-detail-row">
                  <span className="order-detail-label">Order ID:</span>
                  <div className="order-id-group">
                    <code className="order-id-value">{order.orderId}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.orderId)}
                      className="order-copy-btn"
                      title="Copy PayPal Order ID"
                    >
                      {copied ? <CheckmarkIcon size={13} /> : <CopyIcon size={13} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Separate Info 2: Actual PayPal Order Status */}
                <div className="order-detail-row">
                  <span className="order-detail-label">PayPal Order Status:</span>
                  <div className="order-status-group">
                    <span className={`order-status-badge ${isCompleted ? 'badge-completed' : isApproved ? 'badge-approved' : isPayerActionRequired ? 'badge-created' : 'badge-pending'}`}>
                      <span className="status-dot"></span>
                      <span>{order.status}</span>
                    </span>
                    <span className="order-status-hint">
                      {isCompleted 
                        ? "Captured" 
                        : isApproved 
                          ? "Ready for capture" 
                          : isPayerActionRequired
                            ? "Authorization not approved"
                            : "On record"}
                    </span>
                  </div>
                </div>

                <div className="order-detail-row">
                  <span className="order-detail-label">Checkout Return Route:</span>
                  <span className="order-desc-value">
                    {isCancelled ? "Cancellation route (?paypal_status=cancelled)" : "Return route (?paypal_status=returned)"}
                  </span>
                </div>

                {order.amount && (
                  <div className="order-detail-row">
                    <span className="order-detail-label">Amount:</span>
                    <span className="order-amount-value">
                      ${Number(order.amount.value).toFixed(2)} {order.amount.currency}
                    </span>
                  </div>
                )}

                {order.description && (
                  <div className="order-detail-row">
                    <span className="order-detail-label">Description:</span>
                    <span className="order-desc-value">{order.description}</span>
                  </div>
                )}

                {/* Buyer Information (Only when available from PayPal) */}
                {order.payer?.emailAddress && (
                  <div className="order-detail-row">
                    <span className="order-detail-label">Buyer Email:</span>
                    <span className="order-payer-value">{order.payer.emailAddress}</span>
                  </div>
                )}

                {order.payer?.payerId && (
                  <div className="order-detail-row">
                    <span className="order-detail-label">Payer ID:</span>
                    <code className="order-payer-id">{order.payer.payerId}</code>
                  </div>
                )}

                {/* Capture Details (Only when capture has occurred) */}
                {order.capture?.id && (
                  <div className="order-detail-row">
                    <span className="order-detail-label">Capture ID:</span>
                    <code className="order-capture-id">{order.capture.id}</code>
                  </div>
                )}
              </div>

              {/* Capture Error Banner (if manual capture request failed) */}
              {captureError && (
                <div className="approval-warning-box" style={{ marginTop: '12px' }}>
                  <AlertCircleIcon size={18} className="approval-warning-icon" />
                  <div className="approval-warning-content">
                    <span className="approval-warning-title">Capture Request Failed</span>
                    <p>{captureError}</p>
                  </div>
                </div>
              )}

              {/* Clarity Notice Callout */}
              <div className={`clarity-capture-notice ${isPayerActionRequired ? 'clarity-notice-amber' : ''}`}>
                <div className="notice-icon">
                  <InfoIcon size={18} />
                </div>
                <div className="notice-content">
                  <span className="notice-title">
                    {isCompleted 
                      ? "Transaction Clarity: Capture Confirmed" 
                      : isApproved 
                        ? "Transaction Clarity: Authorization Confirmed" 
                        : isPayerActionRequired
                          ? "Transaction Clarity: Authorization Incomplete"
                          : `Transaction Clarity: Order ${order.status}`}
                  </span>
                  <p>
                    {isCompleted ? (
                      <>Capture confirmed with status <strong>COMPLETED</strong>. Verified funds are safely recorded in PayPal Sandbox ledger.</>
                    ) : isApproved ? (
                      <>Buyer approval is confirmed by PayPal. In accordance with Orders v2 architecture, funds are <strong>NOT</strong> yet captured until you click <strong>Capture Payment</strong> below.</>
                    ) : isPayerActionRequired ? (
                      <>
                        PayPal reports the order in <strong>PAYER_ACTION_REQUIRED</strong> state. 
                        Buyer authorization was not confirmed (which occurs when checkout is cancelled by the buyer or declined by PayPal regulations). 
                        PayPal has <strong>NOT</strong> confirmed a successful payment, and <strong>NO</strong> funds have been debited or captured.
                      </>
                    ) : (
                      <>PayPal Sandbox reports order status <strong>{order.status}</strong>. No funds have been captured.</>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="payment-actions-footer">
                {/* Capture button is ONLY shown when PayPal explicitly reports APPROVED */}
                {isApproved && (
                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={isCapturing}
                    className="capture-payment-btn"
                    title="Execute deliberate server-side capture"
                  >
                    {isCapturing ? (
                      <>
                        <RefreshCwIcon size={16} className="btn-spin-icon" />
                        <span>Capturing Payment...</span>
                      </>
                    ) : (
                      <>
                        <PayPalLogo size={18} />
                        <span>Capture Payment (${order.amount?.value || '10.00'})</span>
                      </>
                    )}
                  </button>
                )}

                {/* If authorization is incomplete (PAYER_ACTION_REQUIRED), offer Re-check button to poll PayPal */}
                {isPayerActionRequired && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="payment-retry-btn"
                    title="Poll PayPal Sandbox for updated order status"
                  >
                    <RefreshCwIcon size={14} />
                    <span>Re-check PayPal Status</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isCapturing}
                  className="dismiss-modal-btn"
                >
                  {isCompleted ? "Done" : "Close"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentReturnModal;
