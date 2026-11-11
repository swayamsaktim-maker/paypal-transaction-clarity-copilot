/**
 * Deterministic Transaction Intelligence Engine
 *
 * Pure, side-effect-free classification and factual highlight extraction built
 * strictly on verified PayPal Orders v2 facts. Never accesses environment
 * variables, Express, PayPal APIs, or Gemini.
 */

const LIFECYCLE_STAGES = Object.freeze({
    CREATED: "CREATED",
    AWAITING_PAYER: "AWAITING_PAYER",
    AUTHORIZED_NOT_CAPTURED: "AUTHORIZED_NOT_CAPTURED",
    CAPTURED_PENDING: "CAPTURED_PENDING",
    CAPTURED_COMPLETED: "CAPTURED_COMPLETED",
    CAPTURE_DECLINED: "CAPTURE_DECLINED",
    REFUNDED_OR_PARTIAL: "REFUNDED_OR_PARTIAL",
    VOIDED: "VOIDED",
    UNKNOWN: "UNKNOWN"
});

const PROMPT_INTENTS = Object.freeze({
    STATUS: "status",
    CAPTURE: "capture",
    BANK_DEBIT: "bank_debit",
    FEES: "fees",
    REFUND: "refund",
    NEXT_STEPS: "next_steps",
    GENERAL: "general"
});

const INTENT_RULES = [
    {
        intent: PROMPT_INTENTS.BANK_DEBIT,
        patterns: [
            { regex: /\bbank(\s+(account|statement|debit|transfer|settlement|clearing))?\b/, weight: 2 },
            { regex: /\bdebit(ed|s)?\b/, weight: 2 },
            { regex: /\b(credit|debit)\s+card\b/, weight: 2 },
            { regex: /\bcard\s+statement\b/, weight: 2 },
            { regex: /\bdouble\s+charg(e|ed|ing)\b/, weight: 2 },
            { regex: /\bcharged\s+twice\b/, weight: 2 },
            { regex: /\bwithdrawn\b/, weight: 2 },
            { regex: /\bchecking\s+account\b/, weight: 2 },
            { regex: /\bach\b/, weight: 2 },
            { regex: /\b(final\s+)?(bank\s+)?settlement\b/, weight: 2 },
            { regex: /\bsettled\b/, weight: 2 },
            { regex: /\baccount\s+balance\b/, weight: 2 }
        ]
    },
    {
        intent: PROMPT_INTENTS.FEES,
        patterns: [
            { regex: /\bfees?\b/, weight: 2 },
            { regex: /\bnet(\s+(amount|receivable|total|payout|proceeds))?\b/, weight: 2 },
            { regex: /\bgross(\s+amount)?\b/, weight: 2 },
            { regex: /\breceivable(\s+breakdown)?\b/, weight: 2 },
            { regex: /\bbreakdown\b/, weight: 2 },
            { regex: /\bcommission\b/, weight: 2 },
            { regex: /\bdeduct(ed|ion|ions)?\b/, weight: 2 },
            { regex: /\bpayout\s+amount\b/, weight: 2 }
        ]
    },
    {
        intent: PROMPT_INTENTS.REFUND,
        patterns: [
            { regex: /\brefund(ed|s|ing)?\b/, weight: 2 },
            { regex: /\bpartially\s+refunded\b/, weight: 2 },
            { regex: /\bmoney\s+back\b/, weight: 2 },
            { regex: /\breimburs(e|ed|ement)\b/, weight: 2 },
            { regex: /\breversal\b/, weight: 2 },
            { regex: /\bchargeback\b/, weight: 2 },
            { regex: /\bdispute(d|s)?\b/, weight: 2 }
        ]
    },
    {
        intent: PROMPT_INTENTS.CAPTURE,
        patterns: [
            { regex: /\bcaptur(e|ed|ing|es)\b/, weight: 2 },
            { regex: /\buncaptured\b/, weight: 2 },
            { regex: /\bauthoriz(e|ed|ation|ing)\b/, weight: 2 },
            { regex: /\bpre-?auth(orization|orized)?\b/, weight: 2 },
            { regex: /\bholds?\b/, weight: 2 },
            { regex: /\bcollect\s+payment\b/, weight: 2 },
            { regex: /\brelease\s+funds\b/, weight: 2 },
            { regex: /\bfunds\s+(moved|received|transferred)\b/, weight: 2 }
        ]
    },
    {
        intent: PROMPT_INTENTS.NEXT_STEPS,
        patterns: [
            { regex: /\bnext\s+steps?\b/, weight: 2 },
            { regex: /\bsafe\s+steps?\b/, weight: 2 },
            { regex: /\bwhat\s+should\s+(i|we|the\s+merchant|the\s+buyer)\s+do\b/, weight: 2 },
            { regex: /\bwhat\s+(do|can|to)\s+(i|we)\s+do\b/, weight: 2 },
            { regex: /\bhow\s+(do\s+i|should\s+i|to)\s+proceed\b/, weight: 2 },
            { regex: /\brecommend(ed|ations?)?\b/, weight: 2 },
            { regex: /\bwhat\s+now\b/, weight: 2 }
        ]
    },
    {
        intent: PROMPT_INTENTS.STATUS,
        patterns: [
            { regex: /\b(payment|order|current|transaction)?\s*status\b/, weight: 2 },
            { regex: /\b(current\s+)?(state|stage)\b/, weight: 2 },
            { regex: /\bwhere\s+is\s+(my|this|the)\s+(payment|order)\b/, weight: 2 },
            { regex: /\bwhat\s+happened\b/, weight: 2 },
            { regex: /\b(pending|approved|completed|voided|declined)\b/, weight: 1 }
        ]
    }
];

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUpperString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeNonEmptyString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

const VALID_DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
const VALID_CURRENCY_PATTERN = /^[A-Z]{3}$/;

function normalizeAmount(rawAmount) {
    if (!isPlainObject(rawAmount)) return null;
    const rawValue = rawAmount.value;
    const rawCurrency = rawAmount.currency ?? rawAmount.currency_code;

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

    const currency = normalizeUpperString(rawCurrency);
    if (!currency || !VALID_CURRENCY_PATTERN.test(currency)) return null;

    return {
        value: valueStr,
        numeric,
        currency
    };
}

function formatVerifiedAmount(amount) {
    if (!amount) return null;
    return `${amount.value} ${amount.currency}`;
}

function getDecimalPlaces(valueStr) {
    const dotIndex = valueStr.indexOf(".");
    return dotIndex === -1 ? 0 : valueStr.length - dotIndex - 1;
}

function toScaledBigInt(valueStr, targetScale) {
    const dotIndex = valueStr.indexOf(".");
    const intPart = dotIndex === -1 ? valueStr : valueStr.slice(0, dotIndex);
    const fracPart = dotIndex === -1 ? "" : valueStr.slice(dotIndex + 1);
    const paddedFrac = fracPart.padEnd(targetScale, "0");
    return BigInt(`${intPart}${paddedFrac}`);
}

function formatScaledBigInt(scaledValue, scale) {
    const isNegative = scaledValue < 0n;
    const absValue = isNegative ? -scaledValue : scaledValue;
    const raw = absValue.toString();

    if (scale === 0) {
        return `${isNegative ? "-" : ""}${raw}`;
    }

    const padded = raw.padStart(scale + 1, "0");
    const splitIndex = padded.length - scale;
    const intPart = padded.slice(0, splitIndex);
    const fracPart = padded.slice(splitIndex);
    return `${isNegative ? "-" : ""}${intPart}.${fracPart}`;
}

function sumVerifiedAmountsStrict(amounts) {
    if (!Array.isArray(amounts) || amounts.length === 0) {
        return { ok: false, reason: "empty" };
    }

    if (amounts.some(amount => !amount)) {
        return { ok: false, reason: "invalid_or_missing_amount" };
    }

    const currencies = Array.from(new Set(amounts.map(amount => amount.currency)));
    if (currencies.length !== 1) {
        return { ok: false, reason: "currency_mismatch", currencies };
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
        ok: true,
        currency: currencies[0],
        value: formatScaledBigInt(totalScaled, maxScale),
        scaled: totalScaled,
        scale: maxScale,
        count: amounts.length
    };
}

function compareVerifiedAmounts(leftAmount, rightAmount) {
    if (!leftAmount || !rightAmount) {
        return { comparable: false, reason: "invalid_or_missing_amount" };
    }
    if (leftAmount.currency !== rightAmount.currency) {
        return { comparable: false, reason: "currency_mismatch" };
    }

    const scale = Math.max(
        getDecimalPlaces(leftAmount.value),
        getDecimalPlaces(rightAmount.value)
    );
    const leftScaled = toScaledBigInt(leftAmount.value, scale);
    const rightScaled = toScaledBigInt(rightAmount.value, scale);
    const cmp = leftScaled < rightScaled ? -1 : (leftScaled > rightScaled ? 1 : 0);

    return {
        comparable: true,
        cmp,
        currency: leftAmount.currency
    };
}

function extractNormalizedBreakdown(source) {
    if (!isPlainObject(source)) return null;
    const raw =
        (isPlainObject(source.sellerReceivableBreakdown) && source.sellerReceivableBreakdown) ||
        (isPlainObject(source.seller_receivable_breakdown) && source.seller_receivable_breakdown) ||
        null;

    if (!raw) return null;

    const grossAmount = normalizeAmount(raw.grossAmount ?? raw.gross_amount);
    const paypalFee = normalizeAmount(raw.paypalFee ?? raw.paypal_fee);
    const netAmount = normalizeAmount(raw.netAmount ?? raw.net_amount);

    if (!paypalFee && !netAmount) {
        return null;
    }

    return {
        grossAmount,
        paypalFee,
        netAmount
    };
}

function normalizeSingleAuthorization(rawAuth) {
    if (!isPlainObject(rawAuth)) return null;
    const statusDetails =
        (isPlainObject(rawAuth.statusDetails) && rawAuth.statusDetails) ||
        (isPlainObject(rawAuth.status_details) && rawAuth.status_details) ||
        null;

    const id = normalizeNonEmptyString(rawAuth.id);
    const status = normalizeUpperString(rawAuth.status);
    const amount = normalizeAmount(rawAuth.amount);
    const expirationTime = normalizeNonEmptyString(rawAuth.expirationTime ?? rawAuth.expiration_time);

    if (!id && !status && !amount && !expirationTime) return null;

    return {
        id,
        status,
        amount,
        expirationTime,
        statusDetailsReason: normalizeUpperString(
            rawAuth.statusDetailsReason ??
            rawAuth.status_details_reason ??
            statusDetails?.reason
        ),
        createTime: normalizeNonEmptyString(rawAuth.createTime ?? rawAuth.create_time),
        updateTime: normalizeNonEmptyString(rawAuth.updateTime ?? rawAuth.update_time)
    };
}

function normalizeUnitLabel(referenceId, unitIndex) {
    return referenceId ? `unit "${referenceId}"` : `unit #${unitIndex + 1}`;
}

function attachUnitContext(item, unitIndex, referenceId, unitLabel) {
    if (!item) return null;
    return {
        ...item,
        unitIndex,
        unitReferenceId: referenceId,
        unitLabel
    };
}

function extractNormalizedPurchaseUnits(verifiedFacts) {
    if (!isPlainObject(verifiedFacts)) return [];
    const rawUnits = Array.isArray(verifiedFacts.purchaseUnits)
        ? verifiedFacts.purchaseUnits
        : (Array.isArray(verifiedFacts.purchase_units) ? verifiedFacts.purchase_units : null);

    if (!Array.isArray(rawUnits)) return [];

    const normalizedUnits = [];
    for (let i = 0; i < rawUnits.length; i += 1) {
        const rawUnit = rawUnits[i];
        if (!isPlainObject(rawUnit)) continue;

        const unitIndex = normalizedUnits.length;
        const referenceId = normalizeNonEmptyString(rawUnit.referenceId ?? rawUnit.reference_id);
        const unitLabel = normalizeUnitLabel(referenceId, unitIndex);
        const amount = normalizeAmount(rawUnit.amount);
        const rawPayments = isPlainObject(rawUnit.payments) ? rawUnit.payments : rawUnit;

        const authorizations = (Array.isArray(rawPayments.authorizations) ? rawPayments.authorizations : [])
            .map(normalizeSingleAuthorization)
            .filter(Boolean)
            .map(item => attachUnitContext(item, unitIndex, referenceId, unitLabel));

        const captures = (Array.isArray(rawPayments.captures) ? rawPayments.captures : [])
            .map(normalizeSingleCapture)
            .filter(Boolean)
            .map(item => attachUnitContext(item, unitIndex, referenceId, unitLabel));

        const refunds = (Array.isArray(rawPayments.refunds) ? rawPayments.refunds : [])
            .map(normalizeSingleRefund)
            .filter(Boolean)
            .map(item => attachUnitContext(item, unitIndex, referenceId, unitLabel));

        normalizedUnits.push({
            unitIndex,
            referenceId,
            unitLabel,
            amount,
            authorizations,
            captures,
            refunds
        });
    }

    return normalizedUnits;
}

function extractNormalizedAuthorizations(verifiedFacts, normalizedUnits) {
    if (!isPlainObject(verifiedFacts)) return [];

    const units = Array.isArray(normalizedUnits)
        ? normalizedUnits
        : extractNormalizedPurchaseUnits(verifiedFacts);
    const unitAuths = units.flatMap(unit => unit.authorizations);
    if (unitAuths.length > 0) {
        return unitAuths;
    }

    if (Array.isArray(verifiedFacts.authorizations)) {
        return verifiedFacts.authorizations.map(normalizeSingleAuthorization).filter(Boolean);
    }

    const single = normalizeSingleAuthorization(verifiedFacts.authorization);
    return single ? [single] : [];
}

function normalizeSingleCapture(rawCapture) {
    if (!isPlainObject(rawCapture)) return null;
    const statusDetails =
        (isPlainObject(rawCapture.statusDetails) && rawCapture.statusDetails) ||
        (isPlainObject(rawCapture.status_details) && rawCapture.status_details) ||
        null;

    return {
        id: normalizeNonEmptyString(rawCapture.id),
        status: normalizeUpperString(rawCapture.status),
        amount: normalizeAmount(rawCapture.amount),
        finalCapture:
            typeof rawCapture.finalCapture === "boolean"
                ? rawCapture.finalCapture
                : (typeof rawCapture.final_capture === "boolean" ? rawCapture.final_capture : null),
        statusDetailsReason: normalizeUpperString(
            rawCapture.statusDetailsReason ??
            rawCapture.status_details_reason ??
            statusDetails?.reason
        ),
        breakdown: extractNormalizedBreakdown(rawCapture),
        createTime: normalizeNonEmptyString(rawCapture.createTime ?? rawCapture.create_time),
        updateTime: normalizeNonEmptyString(rawCapture.updateTime ?? rawCapture.update_time)
    };
}

function extractNormalizedCaptures(verifiedFacts, normalizedUnits) {
    if (!isPlainObject(verifiedFacts)) return [];

    const units = Array.isArray(normalizedUnits)
        ? normalizedUnits
        : extractNormalizedPurchaseUnits(verifiedFacts);
    const unitCaptures = units.flatMap(unit => unit.captures);
    if (unitCaptures.length > 0) {
        return unitCaptures;
    }

    if (Array.isArray(verifiedFacts.captures)) {
        return verifiedFacts.captures.map(normalizeSingleCapture).filter(Boolean);
    }

    const single = normalizeSingleCapture(verifiedFacts.capture);
    return single ? [single] : [];
}

function normalizeSingleRefund(rawRefund) {
    if (!isPlainObject(rawRefund)) return null;
    const id = normalizeNonEmptyString(rawRefund.id);
    const status = normalizeUpperString(rawRefund.status);
    const amount = normalizeAmount(rawRefund.amount);

    if (!id && !status && !amount) return null;

    return {
        id,
        status,
        amount
    };
}

function extractNormalizedRefunds(verifiedFacts, normalizedUnits) {
    if (!isPlainObject(verifiedFacts)) return [];

    const units = Array.isArray(normalizedUnits)
        ? normalizedUnits
        : extractNormalizedPurchaseUnits(verifiedFacts);
    const unitRefunds = units.flatMap(unit => unit.refunds);
    if (unitRefunds.length > 0) {
        return unitRefunds;
    }

    let rawList = [];
    if (Array.isArray(verifiedFacts.refunds)) {
        rawList = verifiedFacts.refunds;
    } else if (isPlainObject(verifiedFacts.refund)) {
        rawList = [verifiedFacts.refund];
    }

    return rawList.map(normalizeSingleRefund).filter(Boolean);
}

function countCaptureStatuses(captures) {
    const counts = {
        total: captures.length,
        completed: 0,
        pending: 0,
        declined: 0,
        refunded: 0,
        unknown: 0
    };
    for (const cap of captures) {
        if (cap.status === "COMPLETED") {
            counts.completed += 1;
        } else if (cap.status === "PENDING") {
            counts.pending += 1;
        } else if (cap.status === "DECLINED" || cap.status === "FAILED") {
            counts.declined += 1;
        } else if (cap.status === "REFUNDED" || cap.status === "PARTIALLY_REFUNDED") {
            counts.refunded += 1;
        } else {
            counts.unknown += 1;
        }
    }
    return counts;
}

function countAuthorizationStatuses(authorizations) {
    const counts = {
        total: authorizations.length,
        created: 0,
        pending: 0,
        authorized: 0,
        captured: 0,
        partiallyCaptured: 0,
        denied: 0,
        expired: 0,
        voided: 0,
        unknown: 0
    };
    for (const auth of authorizations) {
        switch (auth.status) {
            case "CREATED":
                counts.created += 1;
                break;
            case "PENDING":
                counts.pending += 1;
                break;
            case "AUTHORIZED":
            case "AUTHORIZED_FOR_PARTIAL_CAPTURE":
                counts.authorized += 1;
                break;
            case "CAPTURED":
                counts.captured += 1;
                break;
            case "PARTIALLY_CAPTURED":
                counts.partiallyCaptured += 1;
                break;
            case "DENIED":
                counts.denied += 1;
                break;
            case "EXPIRED":
                counts.expired += 1;
                break;
            case "VOIDED":
                counts.voided += 1;
                break;
            default:
                counts.unknown += 1;
                break;
        }
    }
    return counts;
}

function countRefundStatuses(refunds) {
    const counts = {
        total: refunds.length,
        completed: 0,
        pending: 0,
        failedOrCancelled: 0,
        unknown: 0
    };
    for (const refund of refunds) {
        if (refund.status === "COMPLETED") {
            counts.completed += 1;
        } else if (refund.status === "PENDING") {
            counts.pending += 1;
        } else if (refund.status === "FAILED" || refund.status === "CANCELLED") {
            counts.failedOrCancelled += 1;
        } else {
            counts.unknown += 1;
        }
    }
    return counts;
}

/**
 * Deterministically classify a user prompt into a Clarity Copilot intent category.
 * Returns "general" for null, empty, unknown, or ambiguous multi-topic prompts.
 *
 * @param {string|null|undefined} prompt
 * @returns {"status"|"capture"|"bank_debit"|"fees"|"refund"|"next_steps"|"general"}
 */
function detectPromptIntent(prompt) {
    if (typeof prompt !== "string") {
        return PROMPT_INTENTS.GENERAL;
    }

    const normalized = prompt.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized) {
        return PROMPT_INTENTS.GENERAL;
    }

    const scores = [];
    for (const rule of INTENT_RULES) {
        let score = 0;
        for (const { regex, weight } of rule.patterns) {
            if (regex.test(normalized)) {
                score += weight;
            }
        }
        if (score > 0) {
            scores.push({ intent: rule.intent, score });
        }
    }

    if (scores.length === 0) {
        return PROMPT_INTENTS.GENERAL;
    }

    let maxScore = 0;
    for (const entry of scores) {
        if (entry.score > maxScore) {
            maxScore = entry.score;
        }
    }

    const topMatches = scores.filter(entry => entry.score === maxScore);
    if (topMatches.length !== 1) {
        return PROMPT_INTENTS.GENERAL;
    }

    return topMatches[0].intent;
}

/**
 * Analyze verified PayPal Orders v2 facts deterministically without calling
 * external APIs or inventing missing data.
 *
 * @param {object} verifiedFacts
 * @param {string|{ prompt?: string }} [promptOrOptions]
 * @returns {{
 *   lifecycleStage: string,
 *   fundsCaptured: boolean|"pending"|null,
 *   bankSettlementVerified: false,
 *   actionRequiredBy: "buyer"|"merchant"|"paypal"|"none",
 *   hasBreakdown: boolean,
 *   missingFields: string[],
 *   factualHighlights: string[],
 *   questionIntent: string,
 *   captureSummary: {
 *     total: number,
 *     completed: number,
 *     pending: number,
 *     declined: number,
 *     refunded: number,
 *     unknown: number,
 *     completedAmount: { value: string, currency: string }|null
 *   },
 *   authorizationSummary: {
 *     total: number,
 *     created: number,
 *     pending: number,
 *     authorized: number,
 *     captured: number,
 *     partiallyCaptured: number,
 *     denied: number,
 *     expired: number,
 *     voided: number,
 *     unknown: number
 *   },
 *   refundSummary: {
 *     total: number,
 *     completed: number,
 *     pending: number,
 *     failedOrCancelled: number,
 *     unknown: number,
 *     completedAmount: { value: string, currency: string }|null,
 *     refundScope: "none"|"pending"|"partial"|"full"|"unverified"
 *   },
 *   purchaseUnitSummary: Array<{
 *     index: number,
 *     referenceId: string|null,
 *     amount: { value: string, currency: string }|null,
 *     lifecycleStage: string,
 *     fundsCaptured: boolean|"pending"|null,
 *     captureCounts: object,
 *     authorizationCounts: object,
 *     refundCounts: object,
 *     refundScope: string
 *   }>
 * }}
 */
function classifyOrderState({
    orderStatus,
    captures,
    captureCounts,
    authorizations,
    authCounts,
    refundCounts,
    activeRefunds
}) {
    const hasCompletedOrRefundedCapture = captureCounts.completed > 0 || captureCounts.refunded > 0;
    const hasCaptureConflictOnVoided = hasCompletedOrRefundedCapture || captureCounts.pending > 0 || activeRefunds.length > 0;

    if (orderStatus === "VOIDED") {
        return {
            lifecycleStage: LIFECYCLE_STAGES.VOIDED,
            fundsCaptured: hasCaptureConflictOnVoided ? null : false,
            actionRequiredBy: "none"
        };
    }

    if (activeRefunds.length > 0) {
        let fundsCaptured = null;
        if (hasCompletedOrRefundedCapture) {
            fundsCaptured = true;
        } else if (captureCounts.pending > 0) {
            fundsCaptured = "pending";
        }
        return {
            lifecycleStage: LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL,
            fundsCaptured,
            actionRequiredBy: refundCounts.pending > 0 ? "paypal" : "none"
        };
    }

    if (captures.length > 0) {
        if (captureCounts.pending > 0) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.CAPTURED_PENDING,
                fundsCaptured: "pending",
                actionRequiredBy: "paypal"
            };
        }

        if (captureCounts.completed === captures.length) {
            if (refundCounts.unknown > 0) {
                return {
                    lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                    fundsCaptured: null,
                    actionRequiredBy: "merchant"
                };
            }
            return {
                lifecycleStage: LIFECYCLE_STAGES.CAPTURED_COMPLETED,
                fundsCaptured: true,
                actionRequiredBy: "none"
            };
        }

        if (captureCounts.declined === captures.length) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.CAPTURE_DECLINED,
                fundsCaptured: false,
                actionRequiredBy: "merchant"
            };
        }

        if (captureCounts.refunded > 0) {
            // Capture says REFUNDED/PARTIALLY_REFUNDED without explicit verified refund records
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "merchant"
            };
        }

        if (captureCounts.completed > 0 && (captureCounts.declined > 0 || captureCounts.unknown > 0)) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "merchant"
            };
        }

        return {
            lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
            fundsCaptured: null,
            actionRequiredBy: captureCounts.declined > 0 ? "merchant" : "none"
        };
    }

    if (authorizations.length > 0) {
        if (authCounts.captured > 0 || authCounts.partiallyCaptured > 0) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "merchant"
            };
        }

        if (orderStatus === "COMPLETED") {
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "merchant"
            };
        }

        if (authCounts.expired + authCounts.voided === authorizations.length) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.VOIDED,
                fundsCaptured: false,
                actionRequiredBy: "none"
            };
        }

        if (authCounts.denied === authorizations.length) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: false,
                actionRequiredBy: "merchant"
            };
        }

        if (
            authCounts.authorized > 0 &&
            authCounts.denied === 0 &&
            authCounts.expired === 0 &&
            authCounts.voided === 0 &&
            authCounts.pending === 0 &&
            authCounts.unknown === 0
        ) {
            if (orderStatus === "PAYER_ACTION_REQUIRED") {
                return {
                    lifecycleStage: LIFECYCLE_STAGES.AWAITING_PAYER,
                    fundsCaptured: false,
                    actionRequiredBy: "buyer"
                };
            }
            return {
                lifecycleStage: LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED,
                fundsCaptured: false,
                actionRequiredBy: "merchant"
            };
        }

        if (authCounts.created === authorizations.length) {
            if (orderStatus === "PAYER_ACTION_REQUIRED") {
                return {
                    lifecycleStage: LIFECYCLE_STAGES.AWAITING_PAYER,
                    fundsCaptured: false,
                    actionRequiredBy: "buyer"
                };
            }
            if (orderStatus === "APPROVED") {
                return {
                    lifecycleStage: LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED,
                    fundsCaptured: false,
                    actionRequiredBy: "merchant"
                };
            }
            if (orderStatus === "CREATED" || orderStatus === "SAVED" || !orderStatus) {
                return {
                    lifecycleStage: LIFECYCLE_STAGES.CREATED,
                    fundsCaptured: false,
                    actionRequiredBy: "buyer"
                };
            }
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "none"
            };
        }

        if (authCounts.pending === authorizations.length) {
            if (orderStatus === "PAYER_ACTION_REQUIRED") {
                return {
                    lifecycleStage: LIFECYCLE_STAGES.AWAITING_PAYER,
                    fundsCaptured: false,
                    actionRequiredBy: "buyer"
                };
            }
            const knownNonCompleted =
                orderStatus === "CREATED" ||
                orderStatus === "SAVED" ||
                orderStatus === "APPROVED" ||
                !orderStatus;
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: knownNonCompleted ? false : null,
                actionRequiredBy: "paypal"
            };
        }

        return {
            lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
            fundsCaptured: null,
            actionRequiredBy: "none"
        };
    }

    switch (orderStatus) {
        case "CREATED":
        case "SAVED":
            return {
                lifecycleStage: LIFECYCLE_STAGES.CREATED,
                fundsCaptured: false,
                actionRequiredBy: "buyer"
            };
        case "PAYER_ACTION_REQUIRED":
            return {
                lifecycleStage: LIFECYCLE_STAGES.AWAITING_PAYER,
                fundsCaptured: false,
                actionRequiredBy: "buyer"
            };
        case "APPROVED":
            return {
                lifecycleStage: LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED,
                fundsCaptured: false,
                actionRequiredBy: "merchant"
            };
        case "COMPLETED":
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "merchant"
            };
        default:
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "none"
            };
    }
}

function evaluateSingleUnitState(unit, orderStatus) {
    const captureCounts = countCaptureStatuses(unit.captures);
    const authCounts = countAuthorizationStatuses(unit.authorizations);
    const refundCounts = countRefundStatuses(unit.refunds);
    const activeRefunds = unit.refunds.filter(r => r.status === "COMPLETED" || r.status === "PENDING");
    const hasPayments = unit.captures.length > 0 || unit.authorizations.length > 0 || unit.refunds.length > 0;

    if (!hasPayments) {
        return {
            unit,
            hasPayments: false,
            captureCounts,
            authCounts,
            refundCounts,
            activeRefunds,
            lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
            fundsCaptured: orderStatus === "VOIDED" || orderStatus === "CREATED" || orderStatus === "SAVED" || orderStatus === "PAYER_ACTION_REQUIRED" || orderStatus === "APPROVED"
                ? false
                : null,
            actionRequiredBy: orderStatus === "APPROVED" ? "merchant" : "none"
        };
    }

    const classification = classifyOrderState({
        orderStatus: orderStatus === "VOIDED" ? "VOIDED" : null,
        captures: unit.captures,
        captureCounts,
        authorizations: unit.authorizations,
        authCounts,
        refundCounts,
        activeRefunds
    });

    return {
        unit,
        hasPayments: true,
        captureCounts,
        authCounts,
        refundCounts,
        activeRefunds,
        ...classification
    };
}

function classifyMultiUnitOrder({
    orderStatus,
    unitEvaluations,
    captures,
    captureCounts,
    authorizations,
    authCounts,
    refundCounts,
    activeRefunds
}) {
    const hasCompletedOrRefundedCapture = captureCounts.completed > 0 || captureCounts.refunded > 0;
    const hasCaptureConflictOnVoided = hasCompletedOrRefundedCapture || captureCounts.pending > 0 || activeRefunds.length > 0;

    if (orderStatus === "VOIDED") {
        return {
            lifecycleStage: LIFECYCLE_STAGES.VOIDED,
            fundsCaptured: hasCaptureConflictOnVoided ? null : false,
            actionRequiredBy: "none",
            hasUnitConflict: hasCaptureConflictOnVoided
        };
    }

    if (activeRefunds.length > 0) {
        const hasMissingRefundUnitCapture = unitEvaluations.some(
            ev => ev.activeRefunds.length > 0 && ev.captureCounts.completed === 0 && ev.captureCounts.refunded === 0
        );
        const hasPendingCapture = captureCounts.pending > 0;
        const hasDeclinedOrMissingUnit = unitEvaluations.some(
            ev => !ev.hasPayments || ev.unit.captures.length === 0 || ev.captureCounts.declined > 0 || ev.captureCounts.unknown > 0
        );

        let fundsCaptured = true;
        if (hasMissingRefundUnitCapture || hasDeclinedOrMissingUnit) {
            fundsCaptured = null;
        } else if (hasPendingCapture) {
            fundsCaptured = "pending";
        }

        let actionRequiredBy = "none";
        if (refundCounts.pending > 0 || hasPendingCapture) {
            actionRequiredBy = "paypal";
        } else if (hasMissingRefundUnitCapture || hasDeclinedOrMissingUnit) {
            actionRequiredBy = "merchant";
        }

        return {
            lifecycleStage: LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL,
            fundsCaptured,
            actionRequiredBy,
            hasUnitConflict: hasDeclinedOrMissingUnit || hasPendingCapture
        };
    }

    if (captures.length === 0) {
        // Zero captures across all units: reuse conservative authorization / order-level classification across aggregated auths
        const base = classifyOrderState({
            orderStatus,
            captures,
            captureCounts,
            authorizations,
            authCounts,
            refundCounts,
            activeRefunds
        });
        const hasConflictingUnits =
            authorizations.length > 0 &&
            unitEvaluations.some(ev => !ev.hasPayments || ev.lifecycleStage !== unitEvaluations[0].lifecycleStage);
        return {
            ...base,
            hasUnitConflict: hasConflictingUnits
        };
    }

    const allUnitsCompleted = unitEvaluations.every(
        ev => ev.lifecycleStage === LIFECYCLE_STAGES.CAPTURED_COMPLETED
    );
    if (allUnitsCompleted) {
        if (refundCounts.unknown > 0) {
            return {
                lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
                fundsCaptured: null,
                actionRequiredBy: "merchant",
                hasUnitConflict: true
            };
        }
        return {
            lifecycleStage: LIFECYCLE_STAGES.CAPTURED_COMPLETED,
            fundsCaptured: true,
            actionRequiredBy: "none",
            hasUnitConflict: false
        };
    }

    const allUnitsDeclined = unitEvaluations.every(
        ev => ev.lifecycleStage === LIFECYCLE_STAGES.CAPTURE_DECLINED
    );
    if (allUnitsDeclined) {
        return {
            lifecycleStage: LIFECYCLE_STAGES.CAPTURE_DECLINED,
            fundsCaptured: false,
            actionRequiredBy: "merchant",
            hasUnitConflict: false
        };
    }

    const allUnitsCompletedOrPending = unitEvaluations.every(
        ev =>
            ev.lifecycleStage === LIFECYCLE_STAGES.CAPTURED_COMPLETED ||
            ev.lifecycleStage === LIFECYCLE_STAGES.CAPTURED_PENDING
    );
    if (allUnitsCompletedOrPending && captureCounts.pending > 0) {
        return {
            lifecycleStage: LIFECYCLE_STAGES.CAPTURED_PENDING,
            fundsCaptured: "pending",
            actionRequiredBy: "paypal",
            hasUnitConflict: captureCounts.completed > 0
        };
    }

    // Conflicting unit states (e.g. COMPLETED + DECLINED, COMPLETED + AUTHORIZED, COMPLETED + missing unit payments)
    return {
        lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
        fundsCaptured: null,
        actionRequiredBy: "merchant",
        hasUnitConflict: true
    };
}

function evaluateRefundTotals({ refunds, captures }) {
    const completedRefunds = refunds.filter(r => r.status === "COMPLETED");
    const pendingRefunds = refunds.filter(r => r.status === "PENDING");
    const capturedForRefundCheck = captures.filter(
        c => c.status === "COMPLETED" || c.status === "REFUNDED" || c.status === "PARTIALLY_REFUNDED"
    );

    const completedRefundSum = completedRefunds.length > 0
        ? sumVerifiedAmountsStrict(completedRefunds.map(r => r.amount))
        : null;
    const completedRefundAmount = completedRefundSum && completedRefundSum.ok
        ? { value: completedRefundSum.value, currency: completedRefundSum.currency }
        : null;

    if (refunds.length === 0 || (completedRefunds.length === 0 && pendingRefunds.length === 0)) {
        return {
            refundScope: "none",
            completedRefundAmount,
            capturedBaseSum: sumVerifiedAmountsStrict(capturedForRefundCheck.map(c => c.amount)),
            hasCapturedFunds: capturedForRefundCheck.length > 0,
            comparisonHighlight: null
        };
    }

    if (pendingRefunds.length > 0 && completedRefunds.length === 0) {
        return {
            refundScope: "pending",
            completedRefundAmount: null,
            capturedBaseSum: sumVerifiedAmountsStrict(capturedForRefundCheck.map(c => c.amount)),
            hasCapturedFunds: capturedForRefundCheck.length > 0,
            comparisonHighlight: "Refund completion is still pending; full vs partial refund outcome cannot be finalized until PayPal completes the pending refund."
        };
    }

    if (capturedForRefundCheck.length === 0) {
        return {
            refundScope: pendingRefunds.length > 0 ? "pending" : "unverified",
            completedRefundAmount,
            capturedBaseSum: { ok: false, reason: "empty" },
            hasCapturedFunds: false,
            comparisonHighlight: "Completed refund record(s) exist, but verified capture records are missing; full vs partial refund scope cannot be determined."
        };
    }

    if (!completedRefundSum || !completedRefundSum.ok) {
        const reasonText = completedRefundSum && completedRefundSum.reason === "currency_mismatch"
            ? `differing currencies (${completedRefundSum.currencies.join(", ")})`
            : "missing or malformed refund amounts";
        return {
            refundScope: "unverified",
            completedRefundAmount: null,
            capturedBaseSum: sumVerifiedAmountsStrict(capturedForRefundCheck.map(c => c.amount)),
            hasCapturedFunds: true,
            comparisonHighlight: `Completed refund records contain ${reasonText}; full vs partial refund scope cannot be verified.`
        };
    }

    const capturedBaseSum = sumVerifiedAmountsStrict(capturedForRefundCheck.map(c => c.amount));
    if (!capturedBaseSum.ok) {
        const reasonText = capturedBaseSum.reason === "currency_mismatch"
            ? `differing currencies (${capturedBaseSum.currencies.join(", ")})`
            : "missing or malformed capture amounts";
        return {
            refundScope: "unverified",
            completedRefundAmount,
            capturedBaseSum,
            hasCapturedFunds: true,
            comparisonHighlight: `Captured records contain ${reasonText}; completed refund total (${completedRefundSum.value} ${completedRefundSum.currency}) cannot be compared to confirm full vs partial refund.`
        };
    }

    const comparison = compareVerifiedAmounts(completedRefundAmount, {
        value: capturedBaseSum.value,
        currency: capturedBaseSum.currency
    });

    if (!comparison.comparable) {
        return {
            refundScope: "unverified",
            completedRefundAmount,
            capturedBaseSum,
            hasCapturedFunds: true,
            comparisonHighlight: `Completed refund currency (${completedRefundSum.currency}) does not match verified captured currency (${capturedBaseSum.currency}); full vs partial refund cannot be confirmed.`
        };
    }

    if (pendingRefunds.length > 0 || captures.some(c => c.status === "PENDING")) {
        return {
            refundScope: "pending",
            completedRefundAmount,
            capturedBaseSum,
            hasCapturedFunds: true,
            comparisonHighlight: `Verified completed refund subtotal is ${completedRefundSum.value} ${completedRefundSum.currency} out of ${capturedBaseSum.value} ${capturedBaseSum.currency} captured, while pending activity remains open; do not claim a final refund total.`
        };
    }

    if (comparison.cmp === 0) {
        return {
            refundScope: "full",
            completedRefundAmount,
            capturedBaseSum,
            hasCapturedFunds: true,
            comparisonHighlight: `Verified completed refund total (${completedRefundSum.value} ${completedRefundSum.currency}) matches verified captured total (${capturedBaseSum.value} ${capturedBaseSum.currency}) (full refund).`
        };
    }

    if (comparison.cmp < 0) {
        return {
            refundScope: "partial",
            completedRefundAmount,
            capturedBaseSum,
            hasCapturedFunds: true,
            comparisonHighlight: `Verified completed refund total (${completedRefundSum.value} ${completedRefundSum.currency}) is less than verified captured total (${capturedBaseSum.value} ${capturedBaseSum.currency}) (partial refund).`
        };
    }

    return {
        refundScope: "unverified",
        completedRefundAmount,
        capturedBaseSum,
        hasCapturedFunds: true,
        comparisonHighlight: `Verified completed refund total (${completedRefundSum.value} ${completedRefundSum.currency}) exceeds verified captured total (${capturedBaseSum.value} ${capturedBaseSum.currency}); manual review required.`
    };
}

function evaluateMultiUnitRefundTotals(unitEvaluations, allCaptures, allRefunds) {
    const unitRefundResults = unitEvaluations.map(ev => ({
        unit: ev.unit,
        hasPayments: ev.hasPayments,
        captureCounts: ev.captureCounts,
        refundCounts: ev.refundCounts,
        ...evaluateRefundTotals({ refunds: ev.unit.refunds, captures: ev.unit.captures })
    }));

    const activeRefundCount = allRefunds.filter(
        r => r.status === "COMPLETED" || r.status === "PENDING"
    ).length;

    const globalCompletedRefunds = allRefunds.filter(r => r.status === "COMPLETED");
    const globalRefundSum = globalCompletedRefunds.length > 0
        ? sumVerifiedAmountsStrict(globalCompletedRefunds.map(r => r.amount))
        : null;
    const completedRefundAmount = globalRefundSum && globalRefundSum.ok
        ? { value: globalRefundSum.value, currency: globalRefundSum.currency }
        : null;

    if (activeRefundCount === 0) {
        return {
            refundScope: "none",
            completedRefundAmount,
            comparisonHighlight: null,
            unitRefundResults
        };
    }

    const hasUnverifiedUnit = unitRefundResults.some(
        r =>
            r.refundScope === "unverified" ||
            (r.captureCounts.refunded > 0 && r.refundCounts.completed === 0 && r.refundCounts.pending === 0) ||
            !r.hasPayments ||
            r.captureCounts.unknown > 0
    );

    if (hasUnverifiedUnit) {
        return {
            refundScope: "unverified",
            completedRefundAmount,
            comparisonHighlight: "One or more purchase units lack comparable, valid, or currency-consistent capture/refund records; full vs partial refund across all units cannot be verified.",
            unitRefundResults
        };
    }

    const hasPendingActivity =
        unitRefundResults.some(r => r.refundScope === "pending") ||
        allCaptures.some(c => c.status === "PENDING");

    if (hasPendingActivity) {
        return {
            refundScope: "pending",
            completedRefundAmount,
            comparisonHighlight: "Pending refund or capture activity exists in at least one purchase unit; final refund scope across the order cannot be confirmed yet.",
            unitRefundResults
        };
    }

    const unitsWithCapturesOrRefunds = unitRefundResults.filter(
        r => r.hasCapturedFunds || r.refundCounts.completed > 0
    );
    const allCapturedUnitsFullyRefunded =
        unitsWithCapturesOrRefunds.length > 0 &&
        unitsWithCapturesOrRefunds.every(r => r.refundScope === "full");

    if (allCapturedUnitsFullyRefunded) {
        const allCurrencies = Array.from(
            new Set(unitsWithCapturesOrRefunds.map(r => r.completedRefundAmount?.currency).filter(Boolean))
        );
        if (allCurrencies.length === 1 && completedRefundAmount) {
            const globalCheck = evaluateRefundTotals({ refunds: allRefunds, captures: allCaptures });
            return {
                refundScope: globalCheck.refundScope,
                completedRefundAmount,
                comparisonHighlight: globalCheck.comparisonHighlight,
                unitRefundResults
            };
        }

        const perUnitNotes = unitsWithCapturesOrRefunds.map(
            r => `${r.unit.unitLabel}: ${r.completedRefundAmount.value} ${r.completedRefundAmount.currency}`
        );
        return {
            refundScope: "full",
            completedRefundAmount: null,
            comparisonHighlight: `Each purchase unit's completed refund matches its unit captured amount in its own currency (${perUnitNotes.join("; ")}) (full refund across units; cross-currency totals were not summed).`,
            unitRefundResults
        };
    }

    // At least one unit has a verified full/partial refund while another unit has unrefunded captured or declined funds
    const refundedUnits = unitRefundResults.filter(r => r.refundScope === "full" || r.refundScope === "partial");
    const unrefundedCapturedUnits = unitRefundResults.filter(
        r => r.hasCapturedFunds && r.refundScope === "none"
    );

    if (refundedUnits.length > 0 && unrefundedCapturedUnits.length > 0) {
        const refundedText = refundedUnits
            .map(r => `${r.unit.unitLabel} (${r.refundScope}${r.completedRefundAmount ? `: ${r.completedRefundAmount.value} ${r.completedRefundAmount.currency}` : ""})`)
            .join(", ");
        const unrefundedText = unrefundedCapturedUnits
            .map(r => r.unit.unitLabel)
            .join(", ");
        const globalEval = evaluateRefundTotals({ refunds: allRefunds, captures: allCaptures });
        const crossCurrencyNote = globalEval.capturedBaseSum && globalEval.capturedBaseSum.ok && completedRefundAmount
            ? ` (${completedRefundAmount.value} ${completedRefundAmount.currency} refunded out of ${globalEval.capturedBaseSum.value} ${globalEval.capturedBaseSum.currency} captured across units)`
            : " (differing currencies across units were not summed)";

        return {
            refundScope: "partial",
            completedRefundAmount,
            comparisonHighlight: `Partial refund across purchase units: ${refundedText} refunded, while ${unrefundedText} has captured funds with no refund records${crossCurrencyNote}.`,
            unitRefundResults
        };
    }

    const fallbackEval = evaluateRefundTotals({ refunds: allRefunds, captures: allCaptures });
    return {
        ...fallbackEval,
        unitRefundResults
    };
}

function formatCaptureCountsParts(captureCounts) {
    const parts = [];
    if (captureCounts.completed > 0) parts.push(`${captureCounts.completed} COMPLETED`);
    if (captureCounts.pending > 0) parts.push(`${captureCounts.pending} PENDING`);
    if (captureCounts.declined > 0) parts.push(`${captureCounts.declined} DECLINED/FAILED`);
    if (captureCounts.refunded > 0) parts.push(`${captureCounts.refunded} REFUNDED`);
    if (captureCounts.unknown > 0) parts.push(`${captureCounts.unknown} UNKNOWN`);
    return parts;
}

function formatAuthCountsParts(authCounts) {
    const parts = [];
    if (authCounts.authorized > 0) parts.push(`${authCounts.authorized} AUTHORIZED`);
    if (authCounts.created > 0) parts.push(`${authCounts.created} CREATED`);
    if (authCounts.pending > 0) parts.push(`${authCounts.pending} PENDING`);
    if (authCounts.captured > 0) parts.push(`${authCounts.captured} CAPTURED`);
    if (authCounts.partiallyCaptured > 0) parts.push(`${authCounts.partiallyCaptured} PARTIALLY_CAPTURED`);
    if (authCounts.denied > 0) parts.push(`${authCounts.denied} DENIED`);
    if (authCounts.expired > 0) parts.push(`${authCounts.expired} EXPIRED`);
    if (authCounts.voided > 0) parts.push(`${authCounts.voided} VOIDED`);
    if (authCounts.unknown > 0) parts.push(`${authCounts.unknown} UNKNOWN`);
    return parts;
}

function formatRefundCountsParts(refundCounts) {
    const parts = [];
    if (refundCounts.completed > 0) parts.push(`${refundCounts.completed} COMPLETED`);
    if (refundCounts.pending > 0) parts.push(`${refundCounts.pending} PENDING`);
    if (refundCounts.failedOrCancelled > 0) parts.push(`${refundCounts.failedOrCancelled} FAILED/CANCELLED`);
    if (refundCounts.unknown > 0) parts.push(`${refundCounts.unknown} UNKNOWN`);
    return parts;
}

function formatPurchaseUnitHighlight(ev) {
    const { unit, hasPayments, captureCounts, authCounts, refundCounts } = ev;
    const amountText = unit.amount ? formatVerifiedAmount(unit.amount) : "amount not provided";

    if (!hasPayments) {
        return `Purchase ${unit.unitLabel} (${amountText}): no capture, authorization, or refund records supplied.`;
    }

    const segments = [];
    const capParts = formatCaptureCountsParts(captureCounts);
    segments.push(`captures: ${capParts.length > 0 ? capParts.join(", ") : "none"}`);

    if (authCounts.total > 0) {
        segments.push(`authorizations: ${formatAuthCountsParts(authCounts).join(", ")}`);
    }
    if (refundCounts.total > 0) {
        segments.push(`refunds: ${formatRefundCountsParts(refundCounts).join(", ")}`);
    }

    return `Purchase ${unit.unitLabel} (${amountText}): ${segments.join("; ")}.`;
}

function analyzeTransactionIntelligence(verifiedFacts, promptOrOptions) {
    const promptInput = typeof promptOrOptions === "string"
        ? promptOrOptions
        : (isPlainObject(promptOrOptions) ? promptOrOptions.prompt : undefined);
    const questionIntent = detectPromptIntent(promptInput);

    // Strictly false: PayPal Orders v2 lookup never proves final bank settlement
    const bankSettlementVerified = false;

    const emptyCaptureSummary = {
        total: 0,
        completed: 0,
        pending: 0,
        declined: 0,
        refunded: 0,
        unknown: 0,
        completedAmount: null
    };
    const emptyAuthSummary = {
        total: 0,
        created: 0,
        pending: 0,
        authorized: 0,
        captured: 0,
        partiallyCaptured: 0,
        denied: 0,
        expired: 0,
        voided: 0,
        unknown: 0
    };
    const emptyRefundSummary = {
        total: 0,
        completed: 0,
        pending: 0,
        failedOrCancelled: 0,
        unknown: 0,
        completedAmount: null,
        refundScope: "none"
    };

    if (!isPlainObject(verifiedFacts)) {
        return {
            lifecycleStage: LIFECYCLE_STAGES.UNKNOWN,
            fundsCaptured: null,
            bankSettlementVerified,
            actionRequiredBy: "none",
            hasBreakdown: false,
            missingFields: ["verifiedFacts"],
            factualHighlights: [
                "Verified PayPal order facts were missing or malformed; transaction state and capture certainty cannot be determined."
            ],
            questionIntent,
            captureSummary: emptyCaptureSummary,
            authorizationSummary: emptyAuthSummary,
            refundSummary: emptyRefundSummary,
            purchaseUnitSummary: []
        };
    }

    const orderId = normalizeNonEmptyString(verifiedFacts.orderId ?? verifiedFacts.id);
    const orderStatus = normalizeUpperString(verifiedFacts.status);
    const intent = normalizeUpperString(verifiedFacts.intent);
    const createTime = normalizeNonEmptyString(verifiedFacts.createTime ?? verifiedFacts.create_time);
    const updateTime = normalizeNonEmptyString(verifiedFacts.updateTime ?? verifiedFacts.update_time);

    const units = extractNormalizedPurchaseUnits(verifiedFacts);
    const captures = extractNormalizedCaptures(verifiedFacts, units);
    const authorizations = extractNormalizedAuthorizations(verifiedFacts, units);
    const refunds = extractNormalizedRefunds(verifiedFacts, units);
    const topLevelBreakdown = extractNormalizedBreakdown(verifiedFacts);

    const unitCurrencySet = new Set(units.map(u => u.amount?.currency).filter(Boolean));
    let orderAmount = normalizeAmount(verifiedFacts.amount);
    if (!orderAmount && units.length === 1 && units[0].amount) {
        orderAmount = units[0].amount;
    } else if (!orderAmount && units.length > 1) {
        const unitSum = sumVerifiedAmountsStrict(units.map(u => u.amount));
        if (unitSum.ok) {
            orderAmount = {
                value: unitSum.value,
                numeric: Number(unitSum.value),
                currency: unitSum.currency
            };
        }
    }

    const captureCounts = countCaptureStatuses(captures);
    const authCounts = countAuthorizationStatuses(authorizations);
    const refundCounts = countRefundStatuses(refunds);
    const activeRefunds = refunds.filter(r => r.status === "COMPLETED" || r.status === "PENDING");

    // Collect verified missing fields conservatively without mutating input
    const missingFields = [];
    if (!orderId) missingFields.push("orderId");
    if (!orderStatus) missingFields.push("status");
    if (!intent) missingFields.push("intent");
    if (!orderAmount && unitCurrencySet.size <= 1) missingFields.push("amount");
    if (!createTime) missingFields.push("createTime");
    if (!updateTime) missingFields.push("updateTime");

    if (units.length > 1) {
        for (const u of units) {
            if (!u.amount) {
                missingFields.push(`purchaseUnits[${u.unitIndex}].amount`);
            }
            if (u.captures.length === 0) {
                missingFields.push(`purchaseUnits[${u.unitIndex}].capture`);
            }
        }
    }

    if (
        intent === "AUTHORIZE" &&
        authorizations.length === 0 &&
        captures.length === 0 &&
        (orderStatus === "APPROVED" || orderStatus === "COMPLETED")
    ) {
        missingFields.push("authorization");
    }

    if (authorizations.length > 0) {
        if (authorizations.some(a => !a.status)) {
            missingFields.push("authorization.status");
        }
        if (authorizations.some(a => !a.amount)) {
            missingFields.push("authorization.amount");
        }
    }

    if (captures.length === 0) {
        missingFields.push("capture");
    } else {
        if (captures.some(c => !c.status)) {
            missingFields.push("capture.status");
        }
        if (captures.some(c => !c.amount)) {
            missingFields.push("capture.amount");
        }
    }

    if (captureCounts.refunded > 0 && refunds.length === 0) {
        missingFields.push("refunds");
    }
    if (refunds.length > 0) {
        if (refunds.some(r => !r.status)) {
            missingFields.push("refund.status");
        }
        if (refunds.some(r => !r.amount)) {
            missingFields.push("refund.amount");
        }
    }

    const hasUnitMissingCapture = units.length > 1 && units.some(u => u.captures.length === 0);

    // Determine seller receivable breakdown availability without fabricating figures
    const nonDeclinedCaptures = captures.filter(
        c => c.status !== "DECLINED" && c.status !== "FAILED"
    );

    let hasBreakdown = false;
    if (captures.length > 0 && !hasUnitMissingCapture) {
        const targetCaptures = nonDeclinedCaptures.length > 0 ? nonDeclinedCaptures : captures;
        const withBreakdown = targetCaptures.filter(c => Boolean(c.breakdown));
        if (withBreakdown.length === targetCaptures.length && withBreakdown.length > 0) {
            hasBreakdown = true;
        } else if (captures.length === 1 && units.length <= 1 && Boolean(topLevelBreakdown)) {
            hasBreakdown = true;
        } else {
            missingFields.push("sellerReceivableBreakdown");
        }
    } else if (topLevelBreakdown && units.length <= 1 && captures.length === 0) {
        hasBreakdown = true;
    } else {
        missingFields.push("sellerReceivableBreakdown");
    }

    const effectiveBreakdowns = captures
        .map(c => c.breakdown)
        .filter(Boolean);
    if (effectiveBreakdowns.length === 0 && topLevelBreakdown) {
        effectiveBreakdowns.push(topLevelBreakdown);
    }
    for (const bd of effectiveBreakdowns) {
        if (!bd.paypalFee && !missingFields.includes("sellerReceivableBreakdown.paypalFee")) {
            missingFields.push("sellerReceivableBreakdown.paypalFee");
        }
        if (!bd.netAmount && !missingFields.includes("sellerReceivableBreakdown.netAmount")) {
            missingFields.push("sellerReceivableBreakdown.netAmount");
        }
    }

    const unitEvaluations = units.map(unit => evaluateSingleUnitState(unit, orderStatus));

    const classification = units.length > 1
        ? classifyMultiUnitOrder({
            orderStatus,
            unitEvaluations,
            captures,
            captureCounts,
            authorizations,
            authCounts,
            refundCounts,
            activeRefunds
        })
        : {
            ...classifyOrderState({
                orderStatus,
                captures,
                captureCounts,
                authorizations,
                authCounts,
                refundCounts,
                activeRefunds
            }),
            hasUnitConflict: false
        };

    const { lifecycleStage, fundsCaptured, actionRequiredBy, hasUnitConflict } = classification;

    const completedCaptures = captures.filter(c => c.status === "COMPLETED");
    const completedCaptureSum = completedCaptures.length > 0
        ? sumVerifiedAmountsStrict(completedCaptures.map(c => c.amount))
        : null;
    const completedCaptureAmount = completedCaptureSum && completedCaptureSum.ok
        ? { value: completedCaptureSum.value, currency: completedCaptureSum.currency }
        : null;

    const refundEvaluation = units.length > 1
        ? evaluateMultiUnitRefundTotals(unitEvaluations, captures, refunds)
        : evaluateRefundTotals({ refunds, captures });

    const { refundScope, completedRefundAmount, comparisonHighlight } = refundEvaluation;

    const unitRefundScopeMap = new Map();
    if (Array.isArray(refundEvaluation.unitRefundResults)) {
        for (const r of refundEvaluation.unitRefundResults) {
            unitRefundScopeMap.set(r.unit.unitIndex, r.refundScope);
        }
    }

    const purchaseUnitSummary = unitEvaluations.map(ev => ({
        index: ev.unit.unitIndex,
        referenceId: ev.unit.referenceId,
        amount: ev.unit.amount ? { value: ev.unit.amount.value, currency: ev.unit.amount.currency } : null,
        lifecycleStage: ev.lifecycleStage,
        fundsCaptured: ev.fundsCaptured,
        captureCounts: ev.captureCounts,
        authorizationCounts: ev.authCounts,
        refundCounts: ev.refundCounts,
        refundScope: units.length > 1
            ? (unitRefundScopeMap.get(ev.unit.unitIndex) || "none")
            : refundScope
    }));

    // Build factual highlights strictly grounded in verified facts (zero PII or speculation)
    const factualHighlights = [];

    if (orderStatus) {
        factualHighlights.push(`PayPal order status is ${orderStatus}${intent ? ` (intent: ${intent})` : ""}.`);
    } else {
        factualHighlights.push("PayPal order status was not provided.");
    }

    if (orderAmount) {
        factualHighlights.push(`Verified order amount: ${formatVerifiedAmount(orderAmount)}.`);
    } else if (unitCurrencySet.size > 1) {
        factualHighlights.push(
            `Purchase units use differing currencies (${Array.from(unitCurrencySet).join(", ")}); order-level amount was not summed across currencies.`
        );
    } else {
        factualHighlights.push("Verified order amount or currency was not provided or was malformed.");
    }

    switch (lifecycleStage) {
        case LIFECYCLE_STAGES.CREATED:
            factualHighlights.push("Order was created on PayPal, but buyer approval and payment capture have not occurred.");
            break;
        case LIFECYCLE_STAGES.AWAITING_PAYER:
            factualHighlights.push("Buyer action is still required on PayPal before the payment can proceed.");
            break;
        case LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED:
            if (authorizations.length > 0) {
                factualHighlights.push(
                    "Buyer approved PayPal authorization without a capture record; an authorization is not a completed capture and funds have NOT been captured yet."
                );
            } else if (intent === "AUTHORIZE") {
                factualHighlights.push(
                    "Order is APPROVED with AUTHORIZE intent and has no verified authorization or capture record; funds have NOT been captured yet."
                );
            } else {
                factualHighlights.push("Buyer approved checkout on PayPal, but no capture record exists; funds have NOT been captured yet.");
            }
            break;
        case LIFECYCLE_STAGES.CAPTURED_PENDING: {
            const pendingReasons = captures
                .filter(c => c.status === "PENDING" && c.statusDetailsReason)
                .map(c => c.statusDetailsReason);
            if (pendingReasons.length > 0) {
                factualHighlights.push(
                    `Capture status is PENDING (${pendingReasons.join(", ")}); payment capture is not completed yet.`
                );
            } else {
                factualHighlights.push("At least one PayPal capture is PENDING and has not completed.");
            }
            break;
        }
        case LIFECYCLE_STAGES.CAPTURED_COMPLETED:
            factualHighlights.push(
                "PayPal confirmed capture completion (COMPLETED); this does not prove final buyer bank debit or final bank settlement."
            );
            break;
        case LIFECYCLE_STAGES.CAPTURE_DECLINED:
            factualHighlights.push("PayPal capture did not succeed (DECLINED/FAILED); funds were not captured.");
            break;
        case LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL:
            if (refundCounts.completed > 0 && refundCounts.pending > 0) {
                factualHighlights.push(
                    `Verified refund records show ${refundCounts.completed} COMPLETED and ${refundCounts.pending} PENDING refund(s).`
                );
            } else if (refundCounts.pending > 0) {
                factualHighlights.push(
                    `Verified refund records show ${refundCounts.pending} PENDING refund(s); refund completion is still in progress.`
                );
            } else {
                factualHighlights.push(
                    `Verified refund records show ${refundCounts.completed} COMPLETED refund(s).`
                );
            }
            break;
        case LIFECYCLE_STAGES.VOIDED:
            if (orderStatus === "VOIDED" && (captureCounts.completed > 0 || captureCounts.pending > 0 || captureCounts.refunded > 0)) {
                factualHighlights.push(
                    "PayPal order status is VOIDED alongside conflicting capture record(s); capture certainty cannot be confirmed without reconciliation."
                );
            } else if (authorizations.length > 0 && authCounts.expired + authCounts.voided === authorizations.length) {
                factualHighlights.push(
                    "PayPal authorization is EXPIRED or VOIDED and can no longer be captured; no funds were captured."
                );
            } else {
                factualHighlights.push("PayPal order or authorization is VOIDED; payment is not completed and no funds can be captured.");
            }
            break;
        default:
            if (orderStatus === "COMPLETED" && captures.length === 0) {
                factualHighlights.push(
                    "Order status is COMPLETED, but no capture record was provided; capture completion and certainty cannot be verified."
                );
            } else if (captures.length === 0 && (authCounts.captured > 0 || authCounts.partiallyCaptured > 0)) {
                factualHighlights.push(
                    "Authorization reports CAPTURED or PARTIALLY_CAPTURED status, but no verified capture record was provided; capture certainty cannot be verified."
                );
            }
            break;
    }

    if (units.length > 1) {
        factualHighlights.push(
            `Multiple purchase units present (${units.length} units); payment records and lifecycle states are tracked per unit.`
        );
        for (const ev of unitEvaluations) {
            factualHighlights.push(formatPurchaseUnitHighlight(ev));
        }
        if (hasUnitConflict) {
            factualHighlights.push(
                "Conflicting or incomplete payment states exist across purchase units; do not assume one completed unit implies full order completion."
            );
        }
    }

    // Report verified authorization records cleanly without inventing missing ones
    if (authorizations.length > 0) {
        const authParts = formatAuthCountsParts(authCounts);
        const unitLocations = Array.from(new Set(authorizations.map(a => a.unitLabel).filter(Boolean)));
        const locationSuffix = units.length > 1 && unitLocations.length > 0
            ? ` (in ${unitLocations.join(", ")})`
            : "";

        const authNote = authCounts.denied > 0 && captures.length === 0
            ? "Authorization was DENIED and no capture occurred; this is not a completed capture."
            : "Authorizations are distinct from captures and never prove completed capture by themselves.";
        factualHighlights.push(
            `Authorization status: ${authorizations.length} record(s)${locationSuffix} (${authParts.join(", ")}). ${authNote}`
        );
    }

    // Report capture record statuses separately from refunds
    if (captures.length > 1) {
        const parts = formatCaptureCountsParts(captureCounts);
        factualHighlights.push(
            `Multiple capture records present (${captures.length} total: ${parts.join(", ")}); do not assume one capture represents the entire order.`
        );

        if (completedCaptures.length > 0 && completedCaptureSum) {
            if (completedCaptureSum.ok) {
                factualHighlights.push(
                    `Capture status total across ${completedCaptureSum.count} COMPLETED capture(s): ${completedCaptureSum.value} ${completedCaptureSum.currency}.`
                );
                if (orderAmount && captures.every(c => c.status === "COMPLETED") && !hasUnitMissingCapture) {
                    const orderCompare = compareVerifiedAmounts(completedCaptureAmount, orderAmount);
                    if (!orderCompare.comparable) {
                        factualHighlights.push(
                            `Completed capture currency (${completedCaptureAmount.currency}) does not match order currency (${orderAmount.currency}).`
                        );
                    } else if (orderCompare.cmp < 0) {
                        factualHighlights.push(
                            `Verified completed capture total (${completedCaptureAmount.value} ${completedCaptureAmount.currency}) is less than order amount (${formatVerifiedAmount(orderAmount)}); do not assume the full order was captured.`
                        );
                    }
                }
            } else if (completedCaptureSum.reason === "currency_mismatch") {
                factualHighlights.push(
                    `Completed captures use differing currencies (${completedCaptureSum.currencies.join(", ")}); capture amounts were not summed across currencies.`
                );
            } else {
                factualHighlights.push(
                    "Completed capture amounts could not be summed safely because one or more capture amounts are missing or malformed."
                );
            }
        }
    } else if (captures.length === 1) {
        const singleCap = captures[0];
        const capAmtText = singleCap.amount ? formatVerifiedAmount(singleCap.amount) : "amount not provided";
        const capUnitPrefix = units.length > 1 && singleCap.unitLabel ? ` in ${singleCap.unitLabel}` : "";
        factualHighlights.push(
            `Capture status${capUnitPrefix}: ${singleCap.status || "UNKNOWN"} (${capAmtText}).`
        );

        if (
            singleCap.status === "COMPLETED" &&
            singleCap.amount &&
            orderAmount
        ) {
            const singleCompare = compareVerifiedAmounts(singleCap.amount, orderAmount);
            if (!singleCompare.comparable) {
                factualHighlights.push(
                    `Capture currency (${singleCap.amount.currency}) does not match order currency (${orderAmount.currency}).`
                );
            } else if (singleCompare.cmp < 0) {
                factualHighlights.push(
                    `Captured amount (${formatVerifiedAmount(singleCap.amount)}) is less than order amount (${formatVerifiedAmount(orderAmount)}).`
                );
            }
        }
    }

    if (orderStatus === "COMPLETED" && captures.some(c => c.status !== "COMPLETED") && captureCounts.refunded === 0) {
        factualHighlights.push(
            "Order-level COMPLETED status is accompanied by non-completed capture record(s); treat capture completion conservatively."
        );
    }

    if (captureCounts.refunded > 0 && refunds.length === 0) {
        factualHighlights.push(
            "Capture status reports REFUNDED/PARTIALLY_REFUNDED without explicit verified refund records; refund amount and status cannot be confirmed."
        );
    }

    // Keep explicit refund record status strictly separate from capture status
    if (refunds.length > 0) {
        const refundParts = formatRefundCountsParts(refundCounts);
        factualHighlights.push(
            `Refund record status: ${refunds.length} record(s) (${refundParts.join(", ")}).`
        );
        if (refundCounts.failedOrCancelled > 0 && activeRefunds.length === 0) {
            factualHighlights.push(
                "Only FAILED/CANCELLED refund records were reported; no active or completed refund succeeded."
            );
        }
        if (comparisonHighlight) {
            factualHighlights.push(comparisonHighlight);
        }
    }

    if (effectiveBreakdowns.length > 0) {
        const bd = effectiveBreakdowns[0];
        const feeText = bd.paypalFee ? formatVerifiedAmount(bd.paypalFee) : "Not provided by PayPal";
        const netText = bd.netAmount ? formatVerifiedAmount(bd.netAmount) : "Not provided by PayPal";
        if (hasBreakdown && effectiveBreakdowns.length === 1) {
            factualHighlights.push(`Seller receivable breakdown: PayPal fee ${feeText}, net receivable ${netText}.`);
        } else if (hasBreakdown) {
            factualHighlights.push(
                `Seller receivable breakdown provided across ${effectiveBreakdowns.length} captures (first capture: PayPal fee ${feeText}, net receivable ${netText}).`
            );
        } else {
            factualHighlights.push(
                `Partial seller receivable breakdown available (first available: PayPal fee ${feeText}, net receivable ${netText}); complete fee breakdown across all captures is not available.`
            );
        }
    } else {
        factualHighlights.push("PayPal seller fee and net receivable breakdown were not provided.");
    }

    factualHighlights.push("Bank settlement and card/bank account debit are not verified by PayPal Orders v2 lookup.");

    return {
        lifecycleStage,
        fundsCaptured,
        bankSettlementVerified,
        actionRequiredBy,
        hasBreakdown,
        missingFields,
        factualHighlights,
        questionIntent,
        captureSummary: {
            ...captureCounts,
            completedAmount: completedCaptureAmount
        },
        authorizationSummary: authCounts,
        refundSummary: {
            ...refundCounts,
            completedAmount: completedRefundAmount,
            refundScope
        },
        purchaseUnitSummary
    };
}

module.exports = {
    LIFECYCLE_STAGES,
    PROMPT_INTENTS,
    analyzeTransactionIntelligence,
    detectPromptIntent
};
