/**
 * Formatting and error-guidance utilities for PayPal transaction facts.
 * Pure helpers without mock or synthetic fallback values.
 */

/**
 * Format an ISO timestamp into readable local date/time, or return an explicit
 * fallback when PayPal did not provide one.
 *
 * @param {string|null|undefined} isoString
 * @returns {string}
 */
export function formatTimestamp(isoString) {
  if (!isoString || typeof isoString !== 'string' || isoString.trim() === '') {
    return 'Not provided by PayPal';
  }
  const trimmed = isoString.trim();
  try {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      return trimmed;
    }
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return trimmed;
  }
}

/**
 * Format a PayPal monetary amount safely using Intl.NumberFormat without assuming USD
 * or displaying $NaN on missing or invalid inputs.
 *
 * Accepts either a PayPal amount object ({ value, currency }) or (value, currency).
 *
 * @param {{ value?: string|number|null, currency?: string|null }|string|number|null|undefined} amountOrValue
 * @param {string|null|undefined} [explicitCurrency]
 * @returns {string}
 */
export function formatCurrencyAmount(amountOrValue, explicitCurrency) {
  let rawValue;
  let rawCurrency;

  if (amountOrValue !== null && typeof amountOrValue === 'object' && !Array.isArray(amountOrValue)) {
    rawValue = amountOrValue.value;
    rawCurrency = amountOrValue.currency ?? amountOrValue.currency_code ?? explicitCurrency;
  } else {
    rawValue = amountOrValue;
    rawCurrency = explicitCurrency;
  }

  if (
    rawValue === null ||
    rawValue === undefined ||
    typeof rawValue === 'boolean' ||
    typeof rawValue === 'object' ||
    (typeof rawValue === 'string' && rawValue.trim() === '')
  ) {
    return 'Not provided by PayPal';
  }

  const numericValue = Number(typeof rawValue === 'string' ? rawValue.trim() : rawValue);
  if (!Number.isFinite(numericValue)) {
    return 'Not provided by PayPal';
  }

  const normalizedCurrency = typeof rawCurrency === 'string' ? rawCurrency.trim().toUpperCase() : '';

  if (!normalizedCurrency) {
    const plainNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericValue);
    return `${plainNumber} (Currency not provided by PayPal)`;
  }

  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    try {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: normalizedCurrency
      }).format(numericValue);
      return formatted.includes(normalizedCurrency) ? formatted : `${formatted} ${normalizedCurrency}`;
    } catch {
      // Fallback for non-ISO 3-letter codes without injecting a '$' prefix
    }
  }

  const fallbackNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericValue);
  return `${fallbackNumber} ${normalizedCurrency}`;
}

/**
 * Return contextual troubleshooting guidance based on backend error status/network failure.
 *
 * @param {{ status?: number, isNetworkError?: boolean }|null|undefined} error
 * @returns {string}
 */
export function getExplainErrorGuidance(error, options = {}) {
  if (!error) return '';

  const hasVerifiedFacts = Boolean(options?.hasVerifiedFacts || error?.verifiedFacts);
  const preservedSuffix = hasVerifiedFacts
    ? ' Verified PayPal order facts remain displayed above and were not affected by this AI error.'
    : '';

  if (error.isNetworkError || !error.status) {
    return `Could not reach the local backend server. Confirm the Express backend is running and accessible, then click Retry Explanation.${preservedSuffix}`;
  }

  switch (error.status) {
    case 400:
      return 'The server rejected the request input. Confirm the PayPal Order ID is 10–40 valid characters and your prompt is non-empty (up to 500 characters).';
    case 404:
      return 'PayPal Sandbox did not find an order matching this ID under the configured developer credentials. Double-check the Order ID and sandbox account.';
    case 429:
      return `The Gemini API rate limit or daily quota has been reached. Wait briefly or check your Gemini API quota before retrying manually.${preservedSuffix}`;
    case 502:
      return `The AI output did not meet strict safety or JSON schema validation rules, or Gemini returned an upstream error. Rather than showing unverified claims, the AI narrative was withheld.${preservedSuffix}`;
    case 503:
      return `The Gemini service is temporarily overloaded or unavailable. Click Retry Explanation in a moment.${preservedSuffix}`;
    case 504:
      return hasVerifiedFacts
        ? `The Gemini AI request timed out. Click Retry Explanation to try generating the AI narrative again.${preservedSuffix}`
        : 'The request timed out waiting for PayPal or Gemini to respond. Click Retry Explanation to try again.';
    default:
      return `An unexpected backend error occurred. Review the message above and click Retry Explanation to try again.${preservedSuffix}`;
  }
}

const LIFECYCLE_LABELS = {
  CREATED: 'Order Created (Not Paid)',
  AWAITING_PAYER: 'Awaiting Buyer Action',
  AUTHORIZED_NOT_CAPTURED: 'Approved / Authorized (Not Captured)',
  CAPTURED_PENDING: 'Capture Pending',
  CAPTURED_COMPLETED: 'Capture Completed',
  CAPTURE_DECLINED: 'Capture Declined / Failed',
  REFUNDED_OR_PARTIAL: 'Refunded or Partially Refunded',
  VOIDED: 'Voided or Expired',
  UNKNOWN: 'Unknown / Conflicting Records'
};

const REFUND_SCOPE_LABELS = {
  none: 'None',
  partial: 'Partial Refund',
  full: 'Full Refund',
  pending: 'Refund Pending',
  unknown: 'Unverified Scope'
};

const DEFAULT_FALLBACK_NOTICE =
  'Gemini is temporarily unavailable. This explanation was generated using verified PayPal transaction facts and deterministic rules.';

/**
 * Ensure any fallback AI notice displayed in the UI never leaks raw URLs, keys,
 * stack traces, or SDK internals even if an unexpected upstream payload arrives.
 *
 * @param {{ code?: string|null, message?: string|null }|null|undefined} aiError
 * @returns {string}
 */
export function sanitizeAiErrorMessage(aiError) {
  const raw = typeof aiError?.message === 'string' ? aiError.message.trim() : '';
  if (!raw || raw.length > 260) {
    return DEFAULT_FALLBACK_NOTICE;
  }
  const hasUnsafePattern =
    /https?:\/\/|AIza[0-9A-Za-z_-]{6,}|Bearer\s+|ECONN[A-Z_]+|RESOURCE_EXHAUSTED|\bat\s+\S+\s*\(|[{}\n\r]/i.test(raw);
  return hasUnsafePattern ? DEFAULT_FALLBACK_NOTICE : raw;
}

/**
 * Derive clear UI provenance labels and guardrails from a hybrid Copilot result.
 * Never labels deterministic or unknown-source responses under a Gemini AI heading.
 *
 * @param {object|null|undefined} result
 * @returns {object}
 */
export function getExplanationProvenance(result) {
  const hasExplanation = Boolean(
    result?.explanation &&
    typeof result.explanation === 'object' &&
    !Array.isArray(result.explanation)
  );

  const isDeterministicFlagged =
    result?.aiFallbackUsed === true ||
    result?.explanationSource === 'deterministic_rules' ||
    result?.isAiGenerated === false;

  const isGemini = Boolean(
    hasExplanation &&
    !isDeterministicFlagged &&
    result?.explanationSource === 'gemini' &&
    result?.isAiGenerated === true
  );

  const isDeterministic = Boolean(hasExplanation && !isGemini);
  const modelName =
    isGemini && typeof result?.model === 'string' && result.model.trim()
      ? result.model.trim()
      : null;

  if (isGemini) {
    return {
      mode: 'gemini',
      isGemini: true,
      isDeterministic: false,
      isFallbackUsed: false,
      modelName,
      sourceLabel: modelName
        ? `AI-Generated Explanation · Gemini ${modelName}`
        : 'AI-Generated Explanation · Gemini',
      heading: 'Gemini AI Explanation',
      ariaLabel: 'Gemini AI Explanation',
      sourceBadge: 'AI Clarification Model',
      statusLabel: 'Structured Output Validated',
      headlineLabel: 'Diagnosis Headline',
      fallbackNote: null,
      safetyText:
        'The natural-language explanation below is generated by Gemini AI grounded strictly on the verified PayPal facts above. It provides plain-language assistance and does not alter, replace, or supersede official PayPal accounting records.'
    };
  }

  if (isDeterministic) {
    const isFallbackUsed = Boolean(result?.aiFallbackUsed);
    return {
      mode: 'deterministic',
      isGemini: false,
      isDeterministic: true,
      isFallbackUsed,
      modelName: null,
      sourceLabel: 'Rule-Based Explanation · Verified PayPal Facts',
      heading: 'Rule-Based Transaction Explanation',
      ariaLabel: 'Rule-Based Transaction Explanation',
      sourceBadge: 'Deterministic Rules',
      statusLabel: isFallbackUsed ? 'Deterministic Fallback Active' : 'Verified Rule-Based Analysis',
      headlineLabel: 'Rule-Based Diagnosis Headline',
      fallbackNote: isFallbackUsed ? sanitizeAiErrorMessage(result?.aiError) : null,
      safetyText:
        'This explanation was generated deterministically from verified PayPal Orders v2 facts and transaction rules without live Gemini AI output. Official PayPal records take precedence.'
    };
  }

  return {
    mode: 'unavailable',
    isGemini: false,
    isDeterministic: false,
    isFallbackUsed: false,
    modelName: null,
    sourceLabel: 'AI Explanation Unavailable',
    heading: 'Transaction Explanation',
    ariaLabel: 'Transaction Explanation',
    sourceBadge: 'Hybrid Clarity Engine',
    statusLabel: 'AI Unavailable — PayPal Facts Preserved',
    headlineLabel: 'Diagnosis Headline',
    fallbackNote: null,
    safetyText: ''
  };
}

function formatBreakdownCounts(summary, orderedFields) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return 'Not provided';
  }
  const total = Number.isInteger(summary.total) && summary.total >= 0 ? summary.total : null;
  if (total === null) {
    return 'Not provided';
  }
  if (total === 0) {
    return '0 records';
  }
  const parts = [];
  for (const [key, label] of orderedFields) {
    const count = summary[key];
    if (Number.isInteger(count) && count > 0) {
      parts.push(`${count} ${label}`);
    }
  }
  return parts.length > 0 ? `${total} total (${parts.join(', ')})` : `${total} total`;
}

/**
 * Convert backend `intelligence` metadata into safe, human-readable UI fields
 * without exposing raw JSON, internal IDs, or unverified settlement claims.
 *
 * @param {object|null|undefined} intelligence
 * @returns {object}
 */
export function buildIntelligenceViewModel(intelligence) {
  if (!intelligence || typeof intelligence !== 'object' || Array.isArray(intelligence)) {
    return {
      isMissing: true,
      lifecycleCode: 'UNKNOWN',
      lifecycleLabel: 'Intelligence Metadata Not Provided',
      captureStateCode: 'unknown',
      captureStateLabel: 'Unknown',
      captureStateDetail: 'Deterministic intelligence metadata was not provided by the backend.',
      authorizationSummaryText: 'Not provided',
      captureSummaryText: 'Not provided',
      refundCountsText: 'Not provided',
      refundScopeLabel: 'Unverified',
      bankSettlementLabel: 'Not verified',
      bankSettlementDetail: 'PayPal Orders v2 does not confirm buyer bank debit or final bank settlement.',
      purchaseUnitNote: null
    };
  }

  const rawStage = typeof intelligence.lifecycleStage === 'string' ? intelligence.lifecycleStage.trim() : '';
  const lifecycleCode = Object.prototype.hasOwnProperty.call(LIFECYCLE_LABELS, rawStage)
    ? rawStage
    : 'UNKNOWN';
  const lifecycleLabel = LIFECYCLE_LABELS[lifecycleCode];

  let captureStateCode = 'unknown';
  let captureStateLabel = 'Unknown';
  let captureStateDetail = 'Capture certainty cannot be confirmed from available PayPal records.';

  if (intelligence.fundsCaptured === true) {
    captureStateCode = 'captured';
    captureStateLabel = 'Captured';
    captureStateDetail = 'PayPal verified capture completion (does not verify final bank settlement).';
  } else if (intelligence.fundsCaptured === false) {
    captureStateCode = 'not_captured';
    captureStateLabel = 'Not Captured';
    captureStateDetail = 'Verified PayPal records confirm no funds have been captured.';
  } else if (intelligence.fundsCaptured === 'pending') {
    captureStateCode = 'pending';
    captureStateLabel = 'Pending';
    captureStateDetail = 'Capture is pending and has not completed yet.';
  }

  const authorizationSummaryText = formatBreakdownCounts(intelligence.authorizationSummary, [
    ['created', 'created'],
    ['pending', 'pending'],
    ['authorized', 'authorized'],
    ['captured', 'captured'],
    ['partiallyCaptured', 'partially captured'],
    ['denied', 'denied'],
    ['expired', 'expired'],
    ['voided', 'voided'],
    ['unknown', 'unknown']
  ]);

  let captureSummaryText = formatBreakdownCounts(intelligence.captureSummary, [
    ['completed', 'completed'],
    ['pending', 'pending'],
    ['declined', 'declined'],
    ['refunded', 'refunded'],
    ['unknown', 'unknown']
  ]);
  const completedCapAmount = intelligence.captureSummary?.completedAmount;
  if (
    completedCapAmount &&
    typeof completedCapAmount === 'object' &&
    completedCapAmount.value !== undefined &&
    completedCapAmount.currency
  ) {
    const formattedCap = formatCurrencyAmount(completedCapAmount);
    if (formattedCap !== 'Not provided by PayPal') {
      captureSummaryText = `${captureSummaryText} · Confirmed total: ${formattedCap}`;
    }
  }

  let refundCountsText = formatBreakdownCounts(intelligence.refundSummary, [
    ['completed', 'completed'],
    ['pending', 'pending'],
    ['failedOrCancelled', 'failed/cancelled'],
    ['unknown', 'unknown']
  ]);
  const rawScope = typeof intelligence.refundSummary?.refundScope === 'string'
    ? intelligence.refundSummary.refundScope.trim().toLowerCase()
    : '';
  const refundScopeLabel =
    intelligence.refundSummary && typeof intelligence.refundSummary === 'object'
      ? (REFUND_SCOPE_LABELS[rawScope] || 'Unverified Scope')
      : 'Unverified';
  const completedRefAmount = intelligence.refundSummary?.completedAmount;
  if (
    completedRefAmount &&
    typeof completedRefAmount === 'object' &&
    completedRefAmount.value !== undefined &&
    completedRefAmount.currency
  ) {
    const formattedRef = formatCurrencyAmount(completedRefAmount);
    if (formattedRef !== 'Not provided by PayPal') {
      refundCountsText = `${refundCountsText} · Completed refunds: ${formattedRef}`;
    }
  }

  const bankSettlementLabel = intelligence.bankSettlementVerified === true ? 'Verified' : 'Not verified';
  const bankSettlementDetail =
    intelligence.bankSettlementVerified === true
      ? 'Bank settlement explicitly confirmed.'
      : 'PayPal Orders v2 does not verify buyer bank debit or final bank settlement.';

  const unitCount = Array.isArray(intelligence.purchaseUnitSummary)
    ? intelligence.purchaseUnitSummary.length
    : 0;
  const purchaseUnitNote = unitCount > 1
    ? `${unitCount} purchase units aggregated conservatively`
    : null;

  return {
    isMissing: false,
    lifecycleCode,
    lifecycleLabel,
    captureStateCode,
    captureStateLabel,
    captureStateDetail,
    authorizationSummaryText,
    captureSummaryText,
    refundCountsText,
    refundScopeLabel,
    bankSettlementLabel,
    bankSettlementDetail,
    purchaseUnitNote
  };
}

/**
 * Determine the next `lastSubmittedRequest` target across fresh submits vs retries.
 * On retry (`isRetry: true`), the previously submitted target is always preserved.
 *
 * @param {{ orderId: string, prompt: string }|null} previousRequest
 * @param {{ orderId: string, prompt: string, isRetry: boolean }} nextAttempt
 * @returns {{ orderId: string, prompt: string }|null}
 */
export function resolveNextLastSubmittedRequest(previousRequest, nextAttempt) {
  if (nextAttempt?.isRetry) {
    return previousRequest || null;
  }
  const orderId = typeof nextAttempt?.orderId === 'string' ? nextAttempt.orderId.trim() : '';
  const prompt = typeof nextAttempt?.prompt === 'string' ? nextAttempt.prompt.trim() : '';
  if (!orderId || !prompt) {
    return previousRequest || null;
  }
  return { orderId, prompt };
}
