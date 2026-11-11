import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheckIcon,
  SparklesIcon,
  CheckmarkIcon,
  CopyIcon,
  AlertCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  InfoIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from './icons/Icons';
import { explainOrder, isValidPayPalOrderId } from '../services/apiService';
import {
  formatTimestamp,
  formatCurrencyAmount,
  getExplainErrorGuidance,
  getExplanationProvenance,
  buildIntelligenceViewModel,
  resolveNextLastSubmittedRequest
} from '../utils/paypalFormatting';

const DEFAULT_PROMPT = 'Explain the current payment status in simple language.';

/**
 * Render an official PayPal status badge from verified API data without inventing statuses
 */
function PayPalStatusBadge({ status }) {
  const raw = typeof status === 'string' ? status.trim() : '';
  const norm = raw.toUpperCase();

  let badgeClass = 'status-badge-neutral';
  let badgeIcon = <ClockIcon size={14} />;
  let semanticNote = null;

  if (!norm) {
    return (
      <div className="paypal-status-badge-wrapper">
        <span className="paypal-status-pill status-badge-neutral">
          <InfoIcon size={14} />
          <span className="font-bold">Not provided by PayPal</span>
        </span>
      </div>
    );
  }

  if (norm === 'COMPLETED') {
    badgeClass = 'status-badge-completed';
    badgeIcon = <CheckCircleIcon size={14} />;
    semanticNote = 'PayPal confirmed capture completion (subject to bank settlement)';
  } else if (norm === 'APPROVED') {
    badgeClass = 'status-badge-approved';
    badgeIcon = <ClockIcon size={14} />;
    semanticNote = 'Approved by buyer; payment capture has NOT been executed yet';
  } else if (norm === 'CREATED' || norm === 'PAYER_ACTION_REQUIRED') {
    badgeClass = 'status-badge-pending';
    badgeIcon = <ClockIcon size={14} />;
    semanticNote = 'Checkout created; buyer authorization pending';
  } else if (norm === 'VOIDED' || norm === 'FAILED') {
    badgeClass = 'status-badge-failed';
    badgeIcon = <AlertCircleIcon size={14} />;
    semanticNote = 'Authorization voided or expired; no funds moved';
  }

  return (
    <div className="paypal-status-badge-wrapper">
      <span className={`paypal-status-pill ${badgeClass}`}>
        {badgeIcon}
        <span className="font-bold tracking-wide">{norm}</span>
      </span>
      {semanticNote && <span className="paypal-status-subnote">{semanticNote}</span>}
    </div>
  );
}

/**
 * Map a PayPal capture status string to an accurate visual style without fabricating 'COMPLETED'
 */
function getCaptureStatusClass(captureStatus) {
  const norm = typeof captureStatus === 'string' ? captureStatus.trim().toUpperCase() : '';
  if (norm === 'COMPLETED') return 'capture-status-completed';
  if (norm === 'PENDING') return 'capture-status-pending';
  if (norm === 'DECLINED' || norm === 'FAILED' || norm === 'REFUNDED') return 'capture-status-failed';
  return 'capture-status-neutral';
}

/**
 * Compact verified transaction intelligence summary derived deterministically
 * from PayPal Orders v2 facts (never exposes raw JSON or internal IDs).
 */
export function VerifiedIntelligenceSection({ intelligence }) {
  const vm = buildIntelligenceViewModel(intelligence);

  return (
    <section
      className="results-section intelligence-summary-section"
      aria-label="Verified Transaction Intelligence"
    >
      <div className="intelligence-header">
        <div className="intelligence-title-wrap">
          <ShieldCheckIcon size={17} className="icon-blue flex-shrink-0" />
          <div>
            <h3 className="intelligence-heading">Verified Transaction Intelligence</h3>
            <p className="intelligence-subheading">
              Deterministic analysis of verified PayPal order, capture, authorization, and refund records
            </p>
          </div>
        </div>
        <span className="intelligence-mode-badge">Deterministic Analysis</span>
      </div>

      {vm.isMissing && (
        <div className="intelligence-missing-note" role="status">
          <InfoIcon size={15} className="icon-amber flex-shrink-0" />
          <span>
            Detailed transaction intelligence metadata was not returned for this response. Official PayPal facts above and bank settlement boundaries still apply.
          </span>
        </div>
      )}

      <div className="intelligence-grid">
        <div className="intelligence-item">
          <span className="intelligence-item-label">Lifecycle Stage</span>
          <span className="intelligence-item-value intelligence-stage-text">
            {vm.lifecycleLabel}
          </span>
        </div>

        <div className="intelligence-item">
          <span className="intelligence-item-label">Capture State</span>
          <div className="intelligence-state-row">
            <span className={`capture-state-pill capture-state-${vm.captureStateCode}`}>
              {vm.captureStateLabel}
            </span>
          </div>
          <span className="intelligence-item-hint">{vm.captureStateDetail}</span>
        </div>

        <div className="intelligence-item">
          <span className="intelligence-item-label">Authorization Counts</span>
          <span className="intelligence-item-value">{vm.authorizationSummaryText}</span>
        </div>

        <div className="intelligence-item">
          <span className="intelligence-item-label">Capture Counts</span>
          <span className="intelligence-item-value">{vm.captureSummaryText}</span>
        </div>

        <div className="intelligence-item">
          <span className="intelligence-item-label">Refund Counts &amp; Scope</span>
          <div className="intelligence-state-row">
            <span className="refund-scope-pill">{vm.refundScopeLabel}</span>
          </div>
          <span className="intelligence-item-hint">{vm.refundCountsText}</span>
        </div>

        <div className="intelligence-item">
          <span className="intelligence-item-label">Bank Settlement</span>
          <div className="intelligence-state-row">
            <span className="settlement-unverified-pill">{vm.bankSettlementLabel}</span>
          </div>
          <span className="intelligence-item-hint">{vm.bankSettlementDetail}</span>
        </div>
      </div>

      {vm.purchaseUnitNote && (
        <div className="intelligence-unit-note">
          <InfoIcon size={14} className="icon-blue flex-shrink-0" />
          <span>{vm.purchaseUnitNote}</span>
        </div>
      )}
    </section>
  );
}

/**
 * Render Gemini AI or deterministic rule-based explanation with unambiguous
 * provenance labeling, sanitized fallback notice, and preserved retry controls.
 */
export function ExplanationResultsSection({
  result,
  error,
  errorHint,
  isLoading,
  activeRequestMeta,
  retryTargetOrderId,
  onRetry,
  onDismissError
}) {
  const hasExplanation = Boolean(
    result?.explanation &&
    typeof result.explanation === 'object' &&
    !Array.isArray(result.explanation)
  );
  const provenance = getExplanationProvenance(result);

  const sectionClass = provenance.isDeterministic
    ? 'results-section deterministic-explanation-section'
    : 'results-section gemini-explanation-section';

  const brandIconClass = provenance.isDeterministic
    ? 'section-brand-icon deterministic-brand-icon'
    : 'section-brand-icon gemini-brand-icon';

  const sourcePillClass = provenance.isDeterministic
    ? 'section-source-pill deterministic-source-pill'
    : 'section-source-pill gemini-source-pill';

  return (
    <section
      className={sectionClass}
      aria-label={provenance.ariaLabel}
    >
      <div className="section-header gemini-section-header">
        <div className="section-title-group">
          <div className={brandIconClass} aria-hidden="true">
            {provenance.isDeterministic ? <ShieldCheckIcon size={20} /> : <SparklesIcon size={20} />}
          </div>
          <div>
            <div className={sourcePillClass}>
              <span className="source-label">Source:</span>
              <span className="source-name">{provenance.sourceLabel}</span>
              <span className="source-type-badge">{provenance.sourceBadge}</span>
            </div>
            <h3 className="section-heading">{provenance.heading}</h3>
          </div>
        </div>

        <div className={`ai-provenance-status ${provenance.isDeterministic ? 'status-deterministic' : ''}`}>
          {isLoading ? (
            <>
              <RefreshCwIcon size={14} className="icon-purple" />
              <span>Generating Explanation...</span>
            </>
          ) : provenance.isGemini ? (
            <>
              <SparklesIcon size={14} className="icon-purple" />
              <span>{provenance.statusLabel}</span>
            </>
          ) : provenance.isDeterministic ? (
            <>
              <ShieldCheckIcon size={14} className="icon-teal" />
              <span>{provenance.statusLabel}</span>
            </>
          ) : (
            <>
              <AlertCircleIcon size={14} className="icon-amber" />
              <span>{provenance.statusLabel}</span>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="clarity-loading-card clarity-loading-card-inline" aria-live="polite" aria-busy="true">
          <div className="loading-pulse-animation" aria-hidden="true">
            <div className="pulse-ring"></div>
            <SparklesIcon size={22} className="loading-pulse-icon" />
          </div>
          <h4 className="loading-title">Retrying Transaction Explanation</h4>
          {(activeRequestMeta?.orderId || retryTargetOrderId) && (
            <p className="loading-order-badge">
              Retrying Order ID:{' '}
              <code className="retry-target-code">{activeRequestMeta?.orderId || retryTargetOrderId}</code>
            </p>
          )}
          <p className="loading-subtitle">
            Verified PayPal Sandbox order facts above remain intact while requesting an updated explanation...
          </p>
        </div>
      )}

      {!isLoading && !hasExplanation && (
        <div className="clarity-error-card clarity-ai-error-card" role="alert">
          <div className="error-card-header">
            <div className="error-icon-box" aria-hidden="true">
              <AlertCircleIcon size={20} />
            </div>
            <div className="error-content">
              <h4 className="error-title">
                {error ? 'Transaction Explanation Unavailable' : 'Explanation Not Loaded'}
              </h4>
              <p className="error-message">
                {error?.message || 'Verified PayPal transaction facts are displayed above, but the narrative explanation has not been loaded.'}
              </p>
              {retryTargetOrderId && (
                <p className="retry-target-note">
                  Retry target (last submitted order):{' '}
                  <code className="retry-target-code">{retryTargetOrderId}</code>
                </p>
              )}
              {errorHint && <p className="error-hint">{errorHint}</p>}
            </div>
          </div>
          <div className="error-actions-row">
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading || !retryTargetOrderId}
              className="error-retry-btn"
              aria-label={retryTargetOrderId ? `Retry explanation for order ${retryTargetOrderId}` : 'Retry Explanation'}
            >
              <RefreshCwIcon size={14} />
              <span>Retry Explanation</span>
            </button>
            {error && (
              <button
                type="button"
                onClick={onDismissError}
                className="error-dismiss-btn"
              >
                Dismiss Notice
              </button>
            )}
          </div>
        </div>
      )}

      {!isLoading && hasExplanation && (
        <>
          {provenance.isFallbackUsed && provenance.fallbackNote && (
            <div className="fallback-info-banner" role="status">
              <div className="fallback-info-content">
                <InfoIcon size={16} className="icon-amber flex-shrink-0" />
                <span className="fallback-info-text">{provenance.fallbackNote}</span>
              </div>
              {retryTargetOrderId && typeof onRetry === 'function' && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={isLoading}
                  className="fallback-retry-btn"
                  aria-label={`Try Gemini AI again for order ${retryTargetOrderId}`}
                >
                  <RefreshCwIcon size={13} />
                  <span>Try Gemini Again</span>
                </button>
              )}
            </div>
          )}

          {/* Safety Boundary Notice */}
          <div className={provenance.isDeterministic ? 'deterministic-safety-banner' : 'gemini-safety-banner'}>
            <InfoIcon size={15} className="safety-icon flex-shrink-0" />
            <span className="safety-text">{provenance.safetyText}</span>
          </div>

          {/* Diagnosis Headline */}
          <div className={provenance.isDeterministic ? 'deterministic-headline-box' : 'gemini-headline-box'}>
            <div className="headline-meta">
              {provenance.isDeterministic ? <ShieldCheckIcon size={15} /> : <SparklesIcon size={15} />}
              <span className="headline-label">{provenance.headlineLabel}</span>
            </div>
            <h4 className="headline-content">{result.explanation.headline}</h4>
          </div>

          {/* Explanation Summary Card */}
          <div className="explanation-card summary-card">
            <div className="card-header-bar">
              <InfoIcon size={16} className="icon-blue flex-shrink-0" />
              <h5 className="card-title">Plain-English Status Summary</h5>
            </div>
            <p className="card-body-paragraph">{result.explanation.summary}</p>
          </div>

          {/* Financial Impact Card */}
          <div className="explanation-card financial-card">
            <div className="card-header-bar">
              <AlertTriangleIcon size={16} className="icon-amber flex-shrink-0" />
              <h5 className="card-title">Financial Movement &amp; Settlement Impact</h5>
            </div>
            <p className="card-body-paragraph">{result.explanation.financialImpact}</p>
          </div>

          {/* Safe Next Steps Card */}
          <div className="explanation-card steps-card">
            <div className="card-header-bar">
              <ShieldCheckIcon size={16} className="icon-emerald flex-shrink-0" />
              <div>
                <h5 className="card-title">Recommended Safe Next Steps</h5>
                <span className="card-subtitle">Factual, safe procedural guidance (non-financial)</span>
              </div>
            </div>
            <div className="steps-list-container">
              {result.explanation.safeNextSteps.map((step, idx) => (
                <div key={idx} className="step-list-item">
                  <span className="step-idx-pill">{idx + 1}</span>
                  <span className="step-description">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Limitations & Constraints Card */}
          <div className="explanation-card limitations-card">
            <div className="card-header-bar">
              <AlertCircleIcon size={16} className="icon-rose flex-shrink-0" />
              <div>
                <h5 className="card-title">Financial Constraints &amp; Boundaries</h5>
                <span className="card-subtitle">Verification limits and safety guardrails</span>
              </div>
            </div>
            <div className="limitations-list-container">
              {result.explanation.limitations.map((limitation, idx) => (
                <div key={idx} className="limitation-list-item">
                  <span className="limitation-bullet" aria-hidden="true">•</span>
                  <span className="limitation-description">{limitation}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function RealOrderClaritySection() {
  const [orderId, setOrderId] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({ orderId: null, prompt: null });
  const [result, setResult] = useState(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState(null);
  const [activeRequestMeta, setActiveRequestMeta] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const inFlightRequestIdRef = useRef(null);
  const orderInputRef = useRef(null);
  const promptInputRef = useRef(null);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      inFlightRequestIdRef.current = null;
      abortControllerRef.current?.abort();
    };
  }, []);

  const samplePrompts = [
    DEFAULT_PROMPT,
    'Has this payment been captured or is it still waiting for merchant action?',
    'Did this transaction debit the buyer’s bank account?',
    'What safe, non-financial next steps should be taken?'
  ];

  const handleCopy = (text, fieldName, accessibleLabel) => {
    if (!text) return;
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      setLiveAnnouncement(`Clipboard unavailable in this browser for ${accessibleLabel}.`);
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedField(fieldName);
        setLiveAnnouncement(`${accessibleLabel} copied to clipboard.`);
        setTimeout(() => setCopiedField(null), 2000);
      })
      .catch(() => {
        setLiveAnnouncement(`Failed to copy ${accessibleLabel} to clipboard.`);
      });
  };

  const validateInputs = (rawOrderId, rawPrompt) => {
    const errors = { orderId: null, prompt: null };
    const trimmedId = rawOrderId.trim();
    const trimmedPrompt = rawPrompt.trim();

    if (!trimmedId) {
      errors.orderId = 'Please enter a PayPal Sandbox Order ID.';
    } else if (!isValidPayPalOrderId(trimmedId)) {
      errors.orderId = 'Order ID must be 10–40 characters using letters, numbers, hyphens, or underscores.';
    }

    if (!trimmedPrompt) {
      errors.prompt = 'Please enter a clarification question.';
    } else if (trimmedPrompt.length > 500) {
      errors.prompt = 'Question exceeds maximum allowed length of 500 characters.';
    }

    return errors;
  };

  const executeExplain = async ({ targetOrderId, targetPrompt, isRetry }) => {
    if (isLoading || inFlightRequestIdRef.current !== null) return;

    const existingVerifiedOrderId = result?.verifiedFacts
      ? (result?.submittedOrderId || result?.verifiedFacts?.orderId || null)
      : null;
    const isSameOrderWithFacts = Boolean(existingVerifiedOrderId && existingVerifiedOrderId === targetOrderId);

    const updatedTarget = resolveNextLastSubmittedRequest(lastSubmittedRequest, {
      orderId: targetOrderId,
      prompt: targetPrompt,
      isRetry
    });
    if (!isRetry && updatedTarget) {
      setLastSubmittedRequest(updatedTarget);
    }

    // Cancel any previous in-flight request before issuing a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    requestIdRef.current += 1;
    const activeRequestId = requestIdRef.current;
    inFlightRequestIdRef.current = activeRequestId;

    setValidationErrors({ orderId: null, prompt: null });
    setError(null);
    setActiveRequestMeta({ orderId: targetOrderId, isRetry });
    if (!isSameOrderWithFacts) {
      setResult(null);
    } else {
      setResult(prev => (prev ? {
        ...prev,
        explanation: null,
        explanationSource: null,
        isAiGenerated: false,
        aiFallbackUsed: false,
        aiError: null,
        success: false
      } : prev));
    }
    setIsLoading(true);
    setLiveAnnouncement(
      isRetry
        ? `Retrying explanation for submitted PayPal order ${targetOrderId}.`
        : `Retrieving verified order facts for PayPal order ${targetOrderId}.`
    );

    try {
      const data = await explainOrder(targetOrderId, targetPrompt, { signal: controller.signal });
      if (activeRequestId !== requestIdRef.current) return;
      const nextResult = {
        ...data,
        submittedOrderId: targetOrderId
      };
      setResult(nextResult);
      const provenance = getExplanationProvenance(nextResult);
      setLiveAnnouncement(
        provenance.isDeterministic
          ? `PayPal-verified facts and deterministic rule-based explanation loaded for order ${targetOrderId}.`
          : `PayPal-verified facts and Gemini AI explanation loaded for order ${targetOrderId}.`
      );
    } catch (err) {
      if (err?.name === 'AbortError' || activeRequestId !== requestIdRef.current) {
        return;
      }

      const returnedFacts =
        err?.verifiedFacts && typeof err.verifiedFacts === 'object' && !Array.isArray(err.verifiedFacts)
          ? err.verifiedFacts
          : null;
      const returnedIntelligence =
        err?.intelligence && typeof err.intelligence === 'object' && !Array.isArray(err.intelligence)
          ? err.intelligence
          : null;

      const shouldPreserveExistingFacts =
        !returnedFacts &&
        isSameOrderWithFacts &&
        (Boolean(err?.isNetworkError) || [429, 500, 502, 503, 504].includes(err?.status));

      if (returnedFacts) {
        setResult({
          success: false,
          explanationSource: err.explanationSource || null,
          isAiGenerated: false,
          aiFallbackUsed: Boolean(err.aiFallbackUsed),
          model: err.model || null,
          aiError: err.aiError || null,
          verifiedFacts: returnedFacts,
          intelligence: returnedIntelligence ?? (isSameOrderWithFacts ? result?.intelligence || null : null),
          explanation: null,
          submittedOrderId: targetOrderId
        });
      } else if (!shouldPreserveExistingFacts) {
        setResult(null);
      }

      const hasVerifiedContext = Boolean(returnedFacts || shouldPreserveExistingFacts);

      setError({
        status: err.status ?? null,
        code: err.code || null,
        isNetworkError: Boolean(err.isNetworkError),
        isAiFailureOnly: hasVerifiedContext,
        message: err.message || 'Failed to explain order.'
      });
      setLiveAnnouncement(
        hasVerifiedContext
          ? `PayPal facts verified for ${targetOrderId}, but AI explanation failed: ${err.message || 'Unknown AI error.'}`
          : `Error for order ${targetOrderId}: ${err.message || 'Failed to explain order.'}`
      );
    } finally {
      if (activeRequestId === requestIdRef.current) {
        inFlightRequestIdRef.current = null;
        setIsLoading(false);
        setActiveRequestMeta(null);
        abortControllerRef.current = null;
      }
    }
  };

  const handleExplain = (e) => {
    e?.preventDefault();
    if (isLoading || inFlightRequestIdRef.current !== null) return;

    const fieldErrors = validateInputs(orderId, prompt);
    if (fieldErrors.orderId || fieldErrors.prompt) {
      setValidationErrors(fieldErrors);
      setError(null);
      if (fieldErrors.orderId) {
        orderInputRef.current?.focus();
      } else {
        promptInputRef.current?.focus();
      }
      return;
    }

    executeExplain({
      targetOrderId: orderId.trim(),
      targetPrompt: prompt.trim(),
      isRetry: false
    });
  };

  const handleRetry = () => {
    if (isLoading || inFlightRequestIdRef.current !== null) return;
    if (!lastSubmittedRequest?.orderId || !lastSubmittedRequest?.prompt) return;

    executeExplain({
      targetOrderId: lastSubmittedRequest.orderId,
      targetPrompt: lastSubmittedRequest.prompt,
      isRetry: true
    });
  };

  const handleOrderIdChange = (value) => {
    setOrderId(value);
    if (validationErrors.orderId) {
      setValidationErrors(prev => ({ ...prev, orderId: null }));
    }
  };

  const handlePromptChange = (value) => {
    setPrompt(value);
    if (validationErrors.prompt) {
      setValidationErrors(prev => ({ ...prev, prompt: null }));
    }
  };

  const handleSelectSamplePrompt = (p) => {
    if (isLoading) return;
    setPrompt(p);
    setValidationErrors(prev => ({ ...prev, prompt: null }));
  };

  const handleClearAll = () => {
    requestIdRef.current += 1;
    inFlightRequestIdRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setActiveRequestMeta(null);
    setOrderId('');
    setPrompt(DEFAULT_PROMPT);
    setLastSubmittedRequest(null);
    setResult(null);
    setError(null);
    setValidationErrors({ orderId: null, prompt: null });
    setLiveAnnouncement('Form cleared for a new order lookup.');
    orderInputRef.current?.focus();
  };

  const verifiedFacts = result?.verifiedFacts || null;
  const displayedOrderId = verifiedFacts?.orderId || verifiedFacts?.id || result?.submittedOrderId || 'Not provided by PayPal';
  const retryTargetOrderId =
    lastSubmittedRequest?.orderId ||
    (displayedOrderId !== 'Not provided by PayPal' ? displayedOrderId : null);
  const errorHint = getExplainErrorGuidance(error, { hasVerifiedFacts: Boolean(verifiedFacts) });

  return (
    <div className="real-order-clarity-container">
      {/* Screen-reader live announcement region for async & copy actions */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Section Header */}
      <div className="real-order-header">
        <div className="real-order-title-wrap">
          <div className="real-order-icon-badge" aria-hidden="true">
            <ShieldCheckIcon size={22} />
          </div>
          <div>
            <div className="real-order-provenance-tags">
              <span className="provenance-tag tag-paypal">
                <CheckCircleIcon size={12} />
                <span>PayPal Orders v2 API • Ground Truth</span>
              </span>
              <span className="provenance-tag tag-gemini">
                <SparklesIcon size={12} />
                <span>Gemini AI • Structured Clarification</span>
              </span>
            </div>
            <h2 className="real-order-main-title">Real PayPal Sandbox Order Clarity</h2>
            <p className="real-order-subtitle">
              Fetch authoritative transaction facts directly from PayPal Sandbox, then receive a plain-English, safe AI analysis.
            </p>
          </div>
        </div>

        {(result || error || isLoading) && (
          <button
            type="button"
            onClick={handleClearAll}
            className="clear-results-btn"
            title={isLoading ? 'Cancel current lookup and inspect another order' : 'Clear current results and inspect another order'}
          >
            {isLoading ? 'Cancel & Reset' : 'Inspect New Order'}
          </button>
        )}
      </div>

      {/* Input Form Panel */}
      <form onSubmit={handleExplain} noValidate className="real-order-form-card">
        {/* Order ID Input Row */}
        <div className="form-field-group">
          <div className="field-label-row">
            <label htmlFor="paypal-order-id-input" className="field-label">
              PayPal Sandbox Order ID <span className="text-required" aria-hidden="true">*</span>
            </label>
            <span id="order-id-format-hint" className="field-hint">
              10–40 characters (letters, numbers, -, _)
            </span>
          </div>

          <div className="input-with-action">
            <input
              ref={orderInputRef}
              id="paypal-order-id-input"
              type="text"
              value={orderId}
              onChange={(e) => handleOrderIdChange(e.target.value)}
              placeholder="Paste or enter your PayPal Sandbox Order ID"
              disabled={isLoading}
              required
              aria-required="true"
              aria-invalid={Boolean(validationErrors.orderId)}
              aria-describedby={
                validationErrors.orderId
                  ? 'order-id-format-hint order-id-validation-error'
                  : 'order-id-format-hint'
              }
              className={`real-order-text-input font-mono ${validationErrors.orderId ? 'input-error' : ''}`}
              autoComplete="off"
            />
            {orderId && !isLoading && (
              <button
                type="button"
                onClick={() => handleOrderIdChange('')}
                className="input-clear-btn"
                aria-label="Clear PayPal Order ID"
                title="Clear Order ID"
              >
                ✕
              </button>
            )}
          </div>

          {validationErrors.orderId && (
            <p id="order-id-validation-error" role="alert" className="field-error-text">
              {validationErrors.orderId}
            </p>
          )}
        </div>

        {/* Prompt Input Row */}
        <div className="form-field-group">
          <div className="field-label-row">
            <label htmlFor="clarity-prompt-input" className="field-label">
              Clarification Question / Prompt <span className="text-required" aria-hidden="true">*</span>
            </label>
            <span id="prompt-char-counter" className="field-counter">
              {prompt.length} / 500
            </span>
          </div>

          <textarea
            ref={promptInputRef}
            id="clarity-prompt-input"
            rows={2}
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder="Ask about payment status, settlement delays, fees, or safe next steps..."
            disabled={isLoading}
            required
            aria-required="true"
            aria-invalid={Boolean(validationErrors.prompt)}
            aria-describedby={
              validationErrors.prompt
                ? 'prompt-char-counter prompt-validation-error'
                : 'prompt-char-counter'
            }
            maxLength={500}
            className={`real-order-textarea ${validationErrors.prompt ? 'input-error' : ''}`}
          />

          {validationErrors.prompt && (
            <p id="prompt-validation-error" role="alert" className="field-error-text">
              {validationErrors.prompt}
            </p>
          )}

          {/* Suggested Question Chips */}
          <div className="sample-prompts-row">
            <span className="sample-prompts-label">Quick Inquiries:</span>
            <div className="sample-prompts-scroll">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSamplePrompt(p)}
                  disabled={isLoading}
                  className={`sample-prompt-chip ${prompt.trim() === p ? 'sample-prompt-chip-selected' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="form-submit-row">
          <button
            type="submit"
            disabled={!orderId.trim() || !prompt.trim() || isLoading}
            className="real-order-submit-btn"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner" aria-hidden="true"></span>
                <span>Retrieving Facts & Consulting Gemini...</span>
              </>
            ) : (
              <>
                <SparklesIcon size={16} />
                <span>Explain Order with Gemini</span>
              </>
            )}
          </button>
          <span className="submit-disclaimer">
            Queries the PayPal Orders v2 Sandbox API in real-time. No mock data or synthetic fallbacks.
          </span>
        </div>
      </form>

      {/* State 1: Initial Loading State (when no verified facts are displayed yet) */}
      {isLoading && !verifiedFacts && (
        <div
          className="clarity-loading-card"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="loading-pulse-animation" aria-hidden="true">
            <div className="pulse-ring"></div>
            <SparklesIcon size={24} className="loading-pulse-icon" />
          </div>
          <h3 className="loading-title">
            {activeRequestMeta?.isRetry ? 'Retrying Real PayPal Sandbox Order' : 'Analyzing Real PayPal Sandbox Order'}
          </h3>
          {activeRequestMeta?.orderId && (
            <p className="loading-order-badge">
              {activeRequestMeta.isRetry ? 'Retrying Order ID:' : 'Inspecting Order ID:'}{' '}
              <code className="retry-target-code">{activeRequestMeta.orderId}</code>
            </p>
          )}
          <p className="loading-subtitle">
            Querying PayPal Orders v2 Sandbox API for verified order facts, then requesting a structured explanation from Gemini AI...
          </p>
          <div className="loading-steps-indicator">
            <span className="loading-step-item step-active-anim">PayPal Orders v2 Lookup</span>
            <span className="step-arrow" aria-hidden="true">➔</span>
            <span className="loading-step-item step-active-anim">Gemini AI Explanation</span>
          </div>
        </div>
      )}

      {/* State 2: Pre-Verification Error State (PayPal lookup failed or backend unreachable before facts returned) */}
      {!isLoading && error && !verifiedFacts && (
        <div className="clarity-error-card" role="alert">
          <div className="error-card-header">
            <div className="error-icon-box" aria-hidden="true">
              <AlertCircleIcon size={22} />
            </div>
            <div className="error-content">
              <h3 className="error-title">Unable to Retrieve Order</h3>
              <p className="error-message">{error.message}</p>
              {retryTargetOrderId && (
                <p className="retry-target-note">
                  Retry target (last submitted order):{' '}
                  <code className="retry-target-code">{retryTargetOrderId}</code>
                </p>
              )}
              {errorHint && <p className="error-hint">{errorHint}</p>}
            </div>
          </div>
          <div className="error-actions-row">
            <button
              type="button"
              onClick={handleRetry}
              disabled={isLoading || !retryTargetOrderId}
              className="error-retry-btn"
              aria-label={retryTargetOrderId ? `Retry explanation for order ${retryTargetOrderId}` : 'Retry explanation'}
            >
              <RefreshCwIcon size={14} />
              <span>Retry Explanation</span>
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="error-dismiss-btn"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* State 3: Initial Idle State (No result, not loading, no error) */}
      {!isLoading && !error && !result && (
        <div className="clarity-idle-guide-card">
          <div className="idle-guide-header">
            <InfoIcon size={20} className="icon-blue" />
            <h3 className="idle-guide-title">How Real Order Clarity Works</h3>
          </div>
          <div className="idle-guide-grid">
            <div className="guide-feature-box">
              <div className="feature-number">1</div>
              <h4 className="feature-title">PayPal Ground Truth</h4>
              <p className="feature-text">
                The backend calls PayPal Orders v2 Sandbox API directly. Order status, amount, and capture identifiers come strictly from PayPal.
              </p>
            </div>
            <div className="guide-feature-box">
              <div className="feature-number">2</div>
              <h4 className="feature-title">Zero Mock Fallbacks</h4>
              <p className="feature-text">
                No simulated data, mock timeouts, or fake merchant resolution. Only genuine PayPal Sandbox transaction facts are analyzed.
              </p>
            </div>
            <div className="guide-feature-box">
              <div className="feature-number">3</div>
              <h4 className="feature-title">AI Safety Boundaries</h4>
              <p className="feature-text">
                Gemini AI explains the verified facts in clear language without inventing bank debits or claiming unverified final settlement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* State 4: Verified PayPal Facts + Gemini AI Section (facts preserved even if AI fails) */}
      {result && verifiedFacts && (
        <div className="clarity-results-wrapper">
          {/* ================================================================ */}
          {/* SECTION A: PayPal-Verified Transaction Facts                      */}
          {/* Source: PayPal Orders v2 Sandbox API                              */}
          {/* ================================================================ */}
          <section
            className="results-section verified-facts-section"
            aria-label="PayPal-Verified Transaction Facts"
          >
            <div className="section-header facts-section-header">
              <div className="section-title-group">
                <div className="section-brand-icon facts-brand-icon" aria-hidden="true">
                  <ShieldCheckIcon size={20} />
                </div>
                <div>
                  <div className="section-source-pill facts-source-pill">
                    <span className="source-label">Source:</span>
                    <span className="source-name">PayPal Orders v2 Sandbox API</span>
                    <span className="source-type-badge">Official Ground Truth</span>
                  </div>
                  <h3 className="section-heading">PayPal-Verified Transaction Facts</h3>
                </div>
              </div>

              <div className="facts-provenance-status">
                <CheckCircleIcon size={14} className="text-emerald" />
                <span>Verified Direct from PayPal Sandbox</span>
              </div>
            </div>

            {/* Facts Key-Value Grid */}
            <div className="facts-grid">
              {/* Order ID */}
              <div className="fact-card">
                <span className="fact-label">PayPal Order ID</span>
                <div className="fact-value-with-copy">
                  <code className="fact-id-code">{displayedOrderId}</code>
                  {displayedOrderId !== 'Not provided by PayPal' && (
                    <button
                      type="button"
                      onClick={() => handleCopy(displayedOrderId, 'orderId', 'PayPal Order ID')}
                      className="fact-copy-mini"
                      aria-label={copiedField === 'orderId' ? 'PayPal Order ID copied' : 'Copy PayPal Order ID'}
                      title="Copy Order ID"
                    >
                      {copiedField === 'orderId' ? <CheckmarkIcon size={12} /> : <CopyIcon size={12} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="fact-card fact-card-status">
                <span className="fact-label">Official PayPal Status</span>
                <PayPalStatusBadge status={verifiedFacts.status} />
              </div>

              {/* Intent */}
              <div className="fact-card">
                <span className="fact-label">Order Intent</span>
                <span
                  className={`fact-value ${verifiedFacts.intent ? 'font-mono font-bold fact-intent-text' : 'fact-missing-text'}`}
                >
                  {verifiedFacts.intent || 'Not provided by PayPal'}
                </span>
              </div>

              {/* Amount & Currency */}
              <div className="fact-card">
                <span className="fact-label">Order Amount</span>
                <span className="fact-value fact-amount">
                  {formatCurrencyAmount(verifiedFacts.amount)}
                </span>
              </div>

              {/* Creation Time */}
              <div className="fact-card">
                <span className="fact-label">Created At</span>
                <span className="fact-value fact-timestamp">
                  {formatTimestamp(verifiedFacts.createTime)}
                </span>
              </div>

              {/* Update Time */}
              <div className="fact-card">
                <span className="fact-label">Last Updated</span>
                <span className="fact-value fact-timestamp">
                  {formatTimestamp(verifiedFacts.updateTime)}
                </span>
              </div>
            </div>

            {/* Capture Details Subsection */}
            <div className="capture-details-card">
              <div className="capture-card-header">
                <div className="capture-header-left">
                  <span className="capture-card-title">PayPal Capture Details</span>
                  <span className="capture-card-hint">Execution of payment funds transfer</span>
                </div>
                <span className={`capture-status-badge ${verifiedFacts.capture ? 'capture-present' : 'capture-none'}`}>
                  {verifiedFacts.capture ? 'Capture Record Present' : 'No Capture'}
                </span>
              </div>

              {verifiedFacts.capture ? (
                <div className="capture-grid">
                  <div className="capture-item">
                    <span className="capture-item-label">Capture ID</span>
                    <div className="capture-item-code-row">
                      <code className="capture-code">
                        {verifiedFacts.capture.id || 'Not provided by PayPal'}
                      </code>
                      {verifiedFacts.capture.id && (
                        <button
                          type="button"
                          onClick={() => handleCopy(verifiedFacts.capture.id, 'captureId', 'PayPal Capture ID')}
                          className="fact-copy-mini"
                          aria-label={copiedField === 'captureId' ? 'PayPal Capture ID copied' : 'Copy PayPal Capture ID'}
                          title="Copy Capture ID"
                        >
                          {copiedField === 'captureId' ? <CheckmarkIcon size={12} /> : <CopyIcon size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="capture-item">
                    <span className="capture-item-label">Capture Status</span>
                    <span
                      className={`capture-item-status font-bold ${getCaptureStatusClass(verifiedFacts.capture.status)}`}
                    >
                      {verifiedFacts.capture.status || 'Not provided by PayPal'}
                    </span>
                  </div>

                  <div className="capture-item">
                    <span className="capture-item-label">Captured Amount</span>
                    <span className="capture-item-amount font-bold">
                      {formatCurrencyAmount(verifiedFacts.capture.amount)}
                    </span>
                  </div>

                  <div className="capture-item">
                    <span className="capture-item-label">Capture Created</span>
                    <span className="capture-item-time">
                      {formatTimestamp(verifiedFacts.capture.createTime)}
                    </span>
                  </div>

                  <div className="capture-item">
                    <span className="capture-item-label">Capture Updated</span>
                    <span className="capture-item-time">
                      {formatTimestamp(verifiedFacts.capture.updateTime)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="no-capture-notice">
                  <InfoIcon size={16} className="icon-amber flex-shrink-0" />
                  <div>
                    <span className="no-capture-headline">No capture record exists in PayPal for this order.</span>
                    <p className="no-capture-desc">
                      Payment capture has not occurred. Even if the buyer approved checkout, funds are not captured unless a capture record exists.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION A2: Verified Deterministic Transaction Intelligence */}
          <VerifiedIntelligenceSection intelligence={result?.intelligence} />

          {/* SECTION B: Hybrid Explanation (Gemini AI or Deterministic Rules) */}
          <ExplanationResultsSection
            result={result}
            error={error}
            errorHint={errorHint}
            isLoading={isLoading}
            activeRequestMeta={activeRequestMeta}
            retryTargetOrderId={retryTargetOrderId}
            onRetry={handleRetry}
            onDismissError={() => setError(null)}
          />
        </div>
      )}
    </div>
  );
}

export default RealOrderClaritySection;
