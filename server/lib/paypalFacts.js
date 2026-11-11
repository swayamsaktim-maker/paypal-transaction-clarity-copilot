const VALID_DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
const VALID_CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizePayPalAmount(rawAmount) {
    if (!isPlainObject(rawAmount)) return null;

    const rawValue = rawAmount.value;
    const rawCurrency = rawAmount.currency_code ?? rawAmount.currency;

    if (
        rawValue === null ||
        rawValue === undefined ||
        typeof rawValue === "boolean" ||
        typeof rawValue === "object"
    ) {
        return null;
    }

    const valueStr = String(rawValue).trim();
    if (!VALID_DECIMAL_PATTERN.test(valueStr)) return null;

    const numeric = Number(valueStr);
    if (!Number.isFinite(numeric)) return null;

    const currencyStr = normalizeString(rawCurrency);
    if (!currencyStr || !VALID_CURRENCY_PATTERN.test(currencyStr)) return null;

    return {
        value: valueStr,
        currency: currencyStr
    };
}

function getDecimalPlaces(valueStr) {
    const dotIndex = valueStr.indexOf(".");
    return dotIndex === -1 ? 0 : valueStr.length - dotIndex - 1;
}

function toScaledBigInt(valueStr, targetScale) {
    const dotIndex = valueStr.indexOf(".");
    const intPart = dotIndex === -1 ? valueStr : valueStr.slice(0, dotIndex);
    const fracPart = dotIndex === -1 ? "" : valueStr.slice(dotIndex + 1);
    return BigInt(`${intPart}${fracPart.padEnd(targetScale, "0")}`);
}

function formatScaledBigInt(scaledValue, scale) {
    const raw = scaledValue.toString();
    if (scale === 0) return raw;
    const padded = raw.padStart(scale + 1, "0");
    const splitIndex = padded.length - scale;
    return `${padded.slice(0, splitIndex)}.${padded.slice(splitIndex)}`;
}

function deriveVerifiedOrderAmount(purchaseUnits) {
    if (!Array.isArray(purchaseUnits) || purchaseUnits.length === 0) {
        return null;
    }

    if (purchaseUnits.length === 1) {
        const onlyAmount = purchaseUnits[0]?.amount;
        return onlyAmount ? { value: onlyAmount.value, currency: onlyAmount.currency } : null;
    }

    const amounts = purchaseUnits.map(unit => unit.amount);
    if (amounts.some(amount => !amount)) {
        return null;
    }

    const currencies = Array.from(new Set(amounts.map(amount => amount.currency.toUpperCase())));
    if (currencies.length !== 1) {
        return null;
    }

    const maxScale = amounts.reduce(
        (max, amount) => Math.max(max, getDecimalPlaces(amount.value)),
        0
    );
    const totalScaled = amounts.reduce(
        (acc, amount) => acc + toScaledBigInt(amount.value, maxScale),
        0n
    );

    return {
        value: formatScaledBigInt(totalScaled, maxScale),
        currency: amounts[0].currency
    };
}

function extractStatusDetailsReason(rawRecord) {
    if (!isPlainObject(rawRecord)) return null;
    const details =
        (isPlainObject(rawRecord.status_details) && rawRecord.status_details) ||
        (isPlainObject(rawRecord.statusDetails) && rawRecord.statusDetails) ||
        null;
    return normalizeString(
        details?.reason ??
        rawRecord.status_details_reason ??
        rawRecord.statusDetailsReason
    );
}

function extractSellerReceivableBreakdown(rawCapture) {
    if (!isPlainObject(rawCapture)) return null;
    const raw =
        (isPlainObject(rawCapture.seller_receivable_breakdown) && rawCapture.seller_receivable_breakdown) ||
        (isPlainObject(rawCapture.sellerReceivableBreakdown) && rawCapture.sellerReceivableBreakdown) ||
        null;

    if (!raw) return null;

    const grossAmount = normalizePayPalAmount(raw.gross_amount ?? raw.grossAmount);
    const paypalFee = normalizePayPalAmount(raw.paypal_fee ?? raw.paypalFee);
    const netAmount = normalizePayPalAmount(raw.net_amount ?? raw.netAmount);

    if (!grossAmount && !paypalFee && !netAmount) {
        return null;
    }

    return {
        grossAmount,
        paypalFee,
        netAmount
    };
}

function extractAuthorizationRecord(rawAuth) {
    if (!isPlainObject(rawAuth)) return null;

    const id = normalizeString(rawAuth.id);
    const status = normalizeString(rawAuth.status);
    const amount = normalizePayPalAmount(rawAuth.amount);
    const expirationTime = normalizeString(rawAuth.expiration_time ?? rawAuth.expirationTime);
    const statusDetailsReason = extractStatusDetailsReason(rawAuth);
    const createTime = normalizeString(rawAuth.create_time ?? rawAuth.createTime);
    const updateTime = normalizeString(rawAuth.update_time ?? rawAuth.updateTime);

    if (!id && !status && !amount && !expirationTime && !statusDetailsReason) {
        return null;
    }

    return {
        id,
        status,
        amount,
        statusDetailsReason,
        expirationTime,
        createTime,
        updateTime
    };
}

function extractCaptureRecord(rawCapture) {
    if (!isPlainObject(rawCapture)) return null;

    const id = normalizeString(rawCapture.id);
    const status = normalizeString(rawCapture.status);
    const amount = normalizePayPalAmount(rawCapture.amount);
    const finalCapture = typeof rawCapture.final_capture === "boolean"
        ? rawCapture.final_capture
        : (typeof rawCapture.finalCapture === "boolean" ? rawCapture.finalCapture : null);
    const statusDetailsReason = extractStatusDetailsReason(rawCapture);
    const sellerReceivableBreakdown = extractSellerReceivableBreakdown(rawCapture);
    const createTime = normalizeString(rawCapture.create_time ?? rawCapture.createTime);
    const updateTime = normalizeString(rawCapture.update_time ?? rawCapture.updateTime);

    if (!id && !status && !amount && !sellerReceivableBreakdown && !statusDetailsReason) {
        return null;
    }

    return {
        id,
        status,
        amount,
        finalCapture,
        statusDetailsReason,
        sellerReceivableBreakdown,
        createTime,
        updateTime
    };
}

function extractRefundRecord(rawRefund) {
    if (!isPlainObject(rawRefund)) return null;

    const id = normalizeString(rawRefund.id);
    const status = normalizeString(rawRefund.status);
    const amount = normalizePayPalAmount(rawRefund.amount);
    const statusDetailsReason = extractStatusDetailsReason(rawRefund);
    const createTime = normalizeString(rawRefund.create_time ?? rawRefund.createTime);
    const updateTime = normalizeString(rawRefund.update_time ?? rawRefund.updateTime);

    if (!id && !status && !amount && !statusDetailsReason) {
        return null;
    }

    return {
        id,
        status,
        amount,
        statusDetailsReason,
        createTime,
        updateTime
    };
}

function extractPurchaseUnit(rawUnit) {
    if (!isPlainObject(rawUnit)) return null;

    const referenceId = normalizeString(rawUnit.reference_id ?? rawUnit.referenceId);
    const amount = normalizePayPalAmount(rawUnit.amount);
    const rawPayments = isPlainObject(rawUnit.payments) ? rawUnit.payments : {};

    const authorizations = Array.isArray(rawPayments.authorizations)
        ? rawPayments.authorizations.map(extractAuthorizationRecord).filter(Boolean)
        : [];
    const captures = Array.isArray(rawPayments.captures)
        ? rawPayments.captures.map(extractCaptureRecord).filter(Boolean)
        : [];
    const refunds = Array.isArray(rawPayments.refunds)
        ? rawPayments.refunds.map(extractRefundRecord).filter(Boolean)
        : [];

    // Do not copy unit payee email/merchant_id, shipping address, or HATEOAS links
    return {
        referenceId,
        amount,
        payments: {
            authorizations,
            captures,
            refunds
        }
    };
}

/**
 * Pure extractor converting a PayPal Orders v2 response into minimal,
 * PII-free verified transaction facts accepted by `analyzeTransactionIntelligence`.
 *
 * Excludes payer/buyer PII, shipping details, merchant email/IDs, HATEOAS links,
 * OAuth credentials, and unverified settlement assumptions. Does not mutate input.
 *
 * @param {object} orderData Raw PayPal Orders v2 GET/capture response object
 * @returns {{
 *   id: string|null,
 *   status: string|null,
 *   intent: string|null,
 *   amount: { value: string, currency: string }|null,
 *   createTime: string|null,
 *   updateTime: string|null,
 *   purchaseUnits: Array<{
 *     referenceId: string|null,
 *     amount: { value: string, currency: string }|null,
 *     payments: {
 *       authorizations: Array<object>,
 *       captures: Array<object>,
 *       refunds: Array<object>
 *     }
 *   }>
 * }|null}
 */
function extractVerifiedPayPalFacts(orderData) {
    if (!isPlainObject(orderData)) {
        return null;
    }

    const rawUnits = Array.isArray(orderData.purchase_units)
        ? orderData.purchase_units
        : (Array.isArray(orderData.purchaseUnits) ? orderData.purchaseUnits : []);

    const purchaseUnits = rawUnits.map(extractPurchaseUnit).filter(Boolean);

    return {
        id: normalizeString(orderData.id),
        status: normalizeString(orderData.status),
        intent: normalizeString(orderData.intent),
        amount: deriveVerifiedOrderAmount(purchaseUnits),
        createTime: normalizeString(orderData.create_time ?? orderData.createTime),
        updateTime: normalizeString(orderData.update_time ?? orderData.updateTime),
        purchaseUnits
    };
}

module.exports = {
    extractVerifiedPayPalFacts
};
