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
