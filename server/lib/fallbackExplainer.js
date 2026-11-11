/**
 * Deterministic Fallback Transaction Explainer
 *
 * Generates schema-valid, plain-language PayPal transaction explanations
 * directly from verified PayPal facts and deterministic transaction intelligence
 * without calling Gemini, Express, PayPal APIs, or environment variables.
 */

const {
    LIFECYCLE_STAGES,
    PROMPT_INTENTS,
    analyzeTransactionIntelligence,
    detectPromptIntent
} = require("./transactionIntelligence");

const MAX_HEADLINE_LEN = 150;
const MAX_SUMMARY_LEN = 1500;
const MAX_FINANCIAL_IMPACT_LEN = 1000;
const MAX_LIST_ITEMS = 6;
const MAX_LIST_ITEM_LEN = 300;

const VALID_DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
const VALID_CURRENCY_PATTERN = /^[A-Z]{3}$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const VALID_INTENTS = new Set(Object.values(PROMPT_INTENTS));
const VALID_STAGES = new Set(Object.values(LIFECYCLE_STAGES));

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeUpper(value) {
    const str = normalizeString(value);
    return str ? str.toUpperCase() : null;
}

function normalizeSafeIdentifier(value) {
    const str = normalizeString(value);
    if (!str || !SAFE_IDENTIFIER_PATTERN.test(str)) return null;
    return str;
}

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
    if (!VALID_DECIMAL_PATTERN.test(valueStr) || !Number.isFinite(Number(valueStr))) {
        return null;
    }

    const currency = normalizeUpper(rawCurrency);
    if (!currency || !VALID_CURRENCY_PATTERN.test(currency)) {
        return null;
    }

    return { value: valueStr, currency };
}

function formatAmount(amount) {
    return amount ? `${amount.value} ${amount.currency}` : null;
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

function sumAmountsIfUniform(amounts) {
    if (!Array.isArray(amounts) || amounts.length === 0 || amounts.some(a => !a)) {
        return null;
    }
    const currencies = Array.from(new Set(amounts.map(a => a.currency)));
    if (currencies.length !== 1) return null;

    const maxScale = amounts.reduce((max, a) => Math.max(max, getDecimalPlaces(a.value)), 0);
    const totalScaled = amounts.reduce((acc, a) => acc + toScaledBigInt(a.value, maxScale), 0n);
    return {
        value: formatScaledBigInt(totalScaled, maxScale),
        currency: currencies[0]
    };
}

function compareAmounts(left, right) {
    if (!left || !right || left.currency !== right.currency) return null;
    const scale = Math.max(getDecimalPlaces(left.value), getDecimalPlaces(right.value));
    const leftScaled = toScaledBigInt(left.value, scale);
    const rightScaled = toScaledBigInt(right.value, scale);
    return leftScaled < rightScaled ? -1 : (leftScaled > rightScaled ? 1 : 0);
}

function truncateText(text, maxLength) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    if (cleaned.length <= maxLength) return cleaned;
    if (maxLength <= 3) return cleaned.slice(0, maxLength);

    const sliced = cleaned.slice(0, maxLength - 3);
    const lastSpace = sliced.lastIndexOf(" ");
    const base = lastSpace > Math.floor((maxLength - 3) * 0.6)
        ? sliced.slice(0, lastSpace)
        : sliced;
    return `${base.trimEnd()}...`;
}

function normalizeStringList(items, fallbackText) {
    const result = [];
    const seen = new Set();

    for (const rawItem of Array.isArray(items) ? items : []) {
        const capped = truncateText(rawItem, MAX_LIST_ITEM_LEN);
        if (!capped) continue;
        const key = capped.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(capped);
        if (result.length >= MAX_LIST_ITEMS) break;
    }

    if (result.length === 0) {
        result.push(truncateText(fallbackText, MAX_LIST_ITEM_LEN));
    }

    return result;
}

function extractBreakdown(source) {
    if (!isPlainObject(source)) return null;
    const raw =
        (isPlainObject(source.sellerReceivableBreakdown) && source.sellerReceivableBreakdown) ||
        (isPlainObject(source.seller_receivable_breakdown) && source.seller_receivable_breakdown) ||
        null;
    if (!raw) return null;

    const grossAmount = normalizeAmount(raw.grossAmount ?? raw.gross_amount);
    const paypalFee = normalizeAmount(raw.paypalFee ?? raw.paypal_fee);
    const netAmount = normalizeAmount(raw.netAmount ?? raw.net_amount);

    if (!grossAmount && !paypalFee && !netAmount) return null;
    return { grossAmount, paypalFee, netAmount };
}

function collectSafeContext(verifiedFacts, rawIntelligence, prompt) {
    const safeFacts = isPlainObject(verifiedFacts) ? verifiedFacts : null;
    const computedIntel = analyzeTransactionIntelligence(safeFacts, prompt);
    const intel = isPlainObject(rawIntelligence) ? rawIntelligence : computedIntel;

    const lifecycleStage = VALID_STAGES.has(intel.lifecycleStage)
        ? intel.lifecycleStage
        : computedIntel.lifecycleStage;

    const fundsCaptured = intel.fundsCaptured === true ||
        intel.fundsCaptured === false ||
        intel.fundsCaptured === "pending" ||
        intel.fundsCaptured === null
        ? intel.fundsCaptured
        : computedIntel.fundsCaptured;

    const questionIntent = VALID_INTENTS.has(intel.questionIntent)
        ? intel.questionIntent
        : (typeof prompt === "string" && prompt.trim()
            ? detectPromptIntent(prompt)
            : computedIntel.questionIntent);

    const hasBreakdown = typeof intel.hasBreakdown === "boolean"
        ? intel.hasBreakdown
        : computedIntel.hasBreakdown;

    const captureSummary = isPlainObject(intel.captureSummary)
        ? intel.captureSummary
        : computedIntel.captureSummary;
    const authorizationSummary = isPlainObject(intel.authorizationSummary)
        ? intel.authorizationSummary
        : computedIntel.authorizationSummary;
    const refundSummary = isPlainObject(intel.refundSummary)
        ? intel.refundSummary
        : computedIntel.refundSummary;
    const purchaseUnitSummary = Array.isArray(intel.purchaseUnitSummary)
        ? intel.purchaseUnitSummary
        : computedIntel.purchaseUnitSummary;
    const factualHighlights = Array.isArray(intel.factualHighlights)
        ? intel.factualHighlights.filter(h => typeof h === "string" && h.trim())
        : computedIntel.factualHighlights;
    const missingFields = Array.isArray(intel.missingFields)
        ? intel.missingFields.filter(f => typeof f === "string" && f.trim())
        : computedIntel.missingFields;

    const rawOrderStatus = safeFacts ? normalizeUpper(safeFacts.status) : null;
    const rawIntent = safeFacts ? normalizeUpper(safeFacts.intent) : null;
    const orderStatus = rawOrderStatus && SAFE_IDENTIFIER_PATTERN.test(rawOrderStatus) ? rawOrderStatus : null;
    const intent = rawIntent && SAFE_IDENTIFIER_PATTERN.test(rawIntent) ? rawIntent : null;
    const orderId = safeFacts ? normalizeSafeIdentifier(safeFacts.orderId ?? safeFacts.id) : null;
    const orderLabel = orderId ? `order ${orderId}` : "this PayPal order";

    const rawUnits = safeFacts
        ? (Array.isArray(safeFacts.purchaseUnits)
            ? safeFacts.purchaseUnits
            : (Array.isArray(safeFacts.purchase_units) ? safeFacts.purchase_units : []))
        : [];
    const normalizedUnits = rawUnits.filter(isPlainObject);

    const unitAmounts = normalizedUnits.map(u => normalizeAmount(u.amount)).filter(Boolean);
    const unitCurrencies = Array.from(new Set(unitAmounts.map(a => a.currency)));

    let orderAmount = safeFacts ? normalizeAmount(safeFacts.amount) : null;
    if (!orderAmount && normalizedUnits.length === 1) {
        orderAmount = normalizeAmount(normalizedUnits[0].amount);
    } else if (!orderAmount && normalizedUnits.length > 1) {
        orderAmount = sumAmountsIfUniform(normalizedUnits.map(u => normalizeAmount(u.amount)));
    }

    // Gather verified captures & breakdowns strictly from verified facts
    const rawCaptures = [];
    for (const unit of normalizedUnits) {
        const payments = isPlainObject(unit.payments) ? unit.payments : unit;
        if (Array.isArray(payments.captures)) {
            for (const cap of payments.captures) {
                if (isPlainObject(cap)) rawCaptures.push(cap);
            }
        }
    }
    if (rawCaptures.length === 0 && safeFacts) {
        if (Array.isArray(safeFacts.captures)) {
            rawCaptures.push(...safeFacts.captures.filter(isPlainObject));
        } else if (isPlainObject(safeFacts.capture)) {
            rawCaptures.push(safeFacts.capture);
        }
    }

    const activeCaptures = rawCaptures.filter(c => {
        const st = normalizeUpper(c.status);
        return st !== "DECLINED" && st !== "FAILED";
    });
    const captureBreakdowns = activeCaptures.map(extractBreakdown).filter(Boolean);
    const topBreakdown = extractBreakdown(safeFacts);
    if (captureBreakdowns.length === 0 && topBreakdown) {
        captureBreakdowns.push(topBreakdown);
    }

    const pendingReasons = rawCaptures
        .filter(c => normalizeUpper(c.status) === "PENDING")
        .map(c => {
            const details = (isPlainObject(c.statusDetails) && c.statusDetails) ||
                (isPlainObject(c.status_details) && c.status_details) ||
                null;
            const reason = normalizeUpper(details?.reason ?? c.statusDetailsReason ?? c.status_details_reason);
            return reason && SAFE_IDENTIFIER_PATTERN.test(reason) ? reason : null;
        })
        .filter(Boolean);

    const isApprovedCaptureIntentWithoutCaptures =
        orderStatus === "APPROVED" &&
        intent === "CAPTURE" &&
        (captureSummary.total || 0) === 0;

    return {
        safeFacts,
        lifecycleStage,
        fundsCaptured,
        questionIntent,
        hasBreakdown,
        captureSummary,
        authorizationSummary,
        refundSummary,
        purchaseUnitSummary,
        factualHighlights,
        missingFields,
        orderStatus,
        intent,
        orderLabel,
        orderAmount,
        unitCount: normalizedUnits.length || purchaseUnitSummary.length,
        unitCurrencies,
        captureBreakdowns,
        pendingReasons,
        isApprovedCaptureIntentWithoutCaptures
    };
}

function buildFeeSummaryText(ctx) {
    const { hasBreakdown, captureBreakdowns } = ctx;
    if (captureBreakdowns.length === 0) {
        return "PayPal seller fee and net receivable breakdown were not provided.";
    }

    if (hasBreakdown && captureBreakdowns.length > 1) {
        const feeSum = sumAmountsIfUniform(captureBreakdowns.map(b => b.paypalFee));
        const netSum = sumAmountsIfUniform(captureBreakdowns.map(b => b.netAmount));
        const grossSum = sumAmountsIfUniform(captureBreakdowns.map(b => b.grossAmount));
        if (feeSum || netSum) {
            const parts = [];
            if (grossSum) parts.push(`gross ${formatAmount(grossSum)}`);
            parts.push(`PayPal fee ${feeSum ? formatAmount(feeSum) : "Not provided by PayPal"}`);
            parts.push(`net receivable ${netSum ? formatAmount(netSum) : "Not provided by PayPal"}`);
            return `Verified seller receivable totals across ${captureBreakdowns.length} captures: ${parts.join(", ")}.`;
        }
        return `Seller receivable breakdown spans ${captureBreakdowns.length} captures with differing or incomplete currencies; totals were not combined across captures.`;
    }

    const bd = captureBreakdowns[0];
    const parts = [];
    if (bd.grossAmount) parts.push(`gross ${formatAmount(bd.grossAmount)}`);
    parts.push(`PayPal fee ${bd.paypalFee ? formatAmount(bd.paypalFee) : "Not provided by PayPal"}`);
    parts.push(`net receivable ${bd.netAmount ? formatAmount(bd.netAmount) : "Not provided by PayPal"}`);

    if (!hasBreakdown) {
        return `Partial seller receivable breakdown available (${parts.join(", ")}); complete breakdown across all captures was not provided.`;
    }
    return `Verified seller receivable breakdown: ${parts.join(", ")}.`;
}

function buildHeadline(ctx) {
    const {
        lifecycleStage,
        questionIntent,
        captureSummary,
        refundSummary,
        fundsCaptured,
        unitCount
    } = ctx;

    if (questionIntent === PROMPT_INTENTS.BANK_DEBIT) {
        if (lifecycleStage === LIFECYCLE_STAGES.CAPTURED_COMPLETED || lifecycleStage === LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL) {
            return truncateText(
                "PayPal records cannot verify buyer bank/card debit or final merchant bank settlement.",
                MAX_HEADLINE_LEN
            );
        }
        return truncateText(
            "Payment is not confirmed captured on PayPal; buyer bank debit is not verified.",
            MAX_HEADLINE_LEN
        );
    }

    if (questionIntent === PROMPT_INTENTS.FEES && lifecycleStage === LIFECYCLE_STAGES.CAPTURED_COMPLETED) {
        if (ctx.captureBreakdowns.length > 0 && ctx.hasBreakdown) {
            return truncateText("Capture completed with verified PayPal seller fee breakdown.", MAX_HEADLINE_LEN);
        }
        return truncateText("Capture completed, but PayPal seller fee breakdown was not provided.", MAX_HEADLINE_LEN);
    }

    switch (lifecycleStage) {
        case LIFECYCLE_STAGES.CREATED:
            return truncateText("Order created on PayPal; buyer approval and payment have not occurred.", MAX_HEADLINE_LEN);
        case LIFECYCLE_STAGES.AWAITING_PAYER:
            return truncateText("Buyer action is still required on PayPal; payment is not confirmed.", MAX_HEADLINE_LEN);
        case LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED:
            return truncateText("Order is approved or authorized, not captured; funds are not transferred yet.", MAX_HEADLINE_LEN);
        case LIFECYCLE_STAGES.CAPTURED_PENDING:
            return truncateText(
                captureSummary.completed > 0
                    ? "Order has both completed and pending PayPal captures; payment is not fully completed."
                    : "PayPal capture is still pending and has not completed yet.",
                MAX_HEADLINE_LEN
            );
        case LIFECYCLE_STAGES.CAPTURED_COMPLETED: {
            const multiSuffix = captureSummary.total > 1 || unitCount > 1
                ? " across multiple records"
                : "";
            return truncateText(
                `PayPal capture completed${multiSuffix}; final bank settlement is not verified.`,
                MAX_HEADLINE_LEN
            );
        }
        case LIFECYCLE_STAGES.CAPTURE_DECLINED:
            return truncateText("PayPal capture attempt was declined; no funds were received.", MAX_HEADLINE_LEN);
        case LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL:
            if (refundSummary.refundScope === "pending") {
                return truncateText("Verified PayPal refund activity is pending completion.", MAX_HEADLINE_LEN);
            }
            if (refundSummary.refundScope === "full") {
                return truncateText("PayPal capture has verified completed refund records matching captured amount.", MAX_HEADLINE_LEN);
            }
            if (refundSummary.refundScope === "partial") {
                return truncateText("PayPal capture has verified partial refund activity.", MAX_HEADLINE_LEN);
            }
            return truncateText("Verified PayPal refund records exist, with unverified refund scope.", MAX_HEADLINE_LEN);
        case LIFECYCLE_STAGES.VOIDED:
            return truncateText(
                fundsCaptured === null
                    ? "Order is marked VOIDED with conflicting capture records requiring review."
                    : "PayPal order or authorization is voided or expired; no funds were captured.",
                MAX_HEADLINE_LEN
            );
        default:
            return truncateText(
                "Available PayPal records do not establish a reliable transaction conclusion.",
                MAX_HEADLINE_LEN
            );
    }
}

function buildLifecycleCoreSummary(ctx) {
    const {
        lifecycleStage,
        orderLabel,
        orderStatus,
        intent,
        orderAmount,
        unitCount,
        unitCurrencies,
        captureSummary,
        authorizationSummary,
        refundSummary,
        fundsCaptured,
        pendingReasons
    } = ctx;

    const amountPhrase = orderAmount
        ? ` for ${formatAmount(orderAmount)}`
        : (unitCurrencies.length > 1
            ? ` spanning ${unitCurrencies.join(", ")} across ${unitCount} purchase units (not summed across currencies)`
            : "");
    const statusPhrase = orderStatus
        ? `PayPal reports status ${orderStatus}${intent ? ` (intent: ${intent})` : ""} on ${orderLabel}${amountPhrase}.`
        : `Verified PayPal status is missing on ${orderLabel}${amountPhrase}.`;

    let stageDetail = "";
    switch (lifecycleStage) {
        case LIFECYCLE_STAGES.CREATED:
            stageDetail = "The checkout order was created, so the buyer has not necessarily approved or paid yet, and no capture record exists.";
            break;
        case LIFECYCLE_STAGES.AWAITING_PAYER:
            stageDetail = "Buyer action is still required on PayPal before checkout approval or payment capture can be confirmed.";
            break;
        case LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED:
            stageDetail = authorizationSummary.authorized > 0
                ? "Verified authorization records exist without any capture record. Authorization is not capture and funds are not confirmed as captured."
                : "Buyer approval on PayPal is not a capture; no capture record exists and funds have not been captured.";
            break;
        case LIFECYCLE_STAGES.CAPTURED_PENDING: {
            const reasonText = pendingReasons.length > 0 ? ` (${pendingReasons.join(", ")})` : "";
            stageDetail = captureSummary.completed > 0
                ? `${captureSummary.completed} capture(s) completed and ${captureSummary.pending} capture(s) remain PENDING${reasonText}; do not treat the order as fully completed.`
                : `Capture status is PENDING${reasonText}, so payment capture has not completed yet.`;
            break;
        }
        case LIFECYCLE_STAGES.CAPTURED_COMPLETED: {
            const capturedAmt = formatAmount(captureSummary.completedAmount);
            const partialCapCmp = compareAmounts(captureSummary.completedAmount, orderAmount);
            if (partialCapCmp === -1 && capturedAmt && orderAmount) {
                stageDetail = `PayPal confirms ${captureSummary.completed} COMPLETED capture(s) totaling ${capturedAmt}, which is less than the verified order amount (${formatAmount(orderAmount)}); do not assume full order payment.`;
            } else if (captureSummary.total > 1 || unitCount > 1) {
                stageDetail = `PayPal confirms ${captureSummary.completed} COMPLETED capture(s)${capturedAmt ? ` totaling ${capturedAmt}` : ""} across ${unitCount || 1} unit(s); this confirms PayPal capture activity only and does not verify final bank settlement.`;
            } else {
                stageDetail = `PayPal confirms capture completion (COMPLETED)${capturedAmt ? ` for ${capturedAmt}` : ""}; this does not verify buyer bank/card debit or final merchant bank settlement.`;
            }
            if (refundSummary.failedOrCancelled > 0) {
                stageDetail += ` Note: ${refundSummary.failedOrCancelled} FAILED/CANCELLED refund attempt(s) were recorded without an active refund.`;
            }
            break;
        }
        case LIFECYCLE_STAGES.CAPTURE_DECLINED:
            stageDetail = `Capture attempt(s) did not succeed (${captureSummary.declined} DECLINED/FAILED); money was not received.`;
            break;
        case LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL: {
            const refundedAmt = formatAmount(refundSummary.completedAmount);
            const parts = [];
            if (captureSummary.total > 0) {
                parts.push(`Capture records: ${captureSummary.total} total (${captureSummary.completed} COMPLETED, ${captureSummary.refunded} REFUNDED/PARTIAL, ${captureSummary.pending} PENDING).`);
            }
            if (refundSummary.refundScope === "full") {
                parts.push(`Explicit refund records (${refundSummary.completed} COMPLETED${refundedAmt ? `, totaling ${refundedAmt}` : ""}) match verified captured totals.`);
            } else if (refundSummary.refundScope === "partial") {
                parts.push(`Explicit refund records show partial refund coverage (${refundSummary.completed} COMPLETED${refundedAmt ? `, totaling ${refundedAmt}` : ""}) against verified captures.`);
            } else if (refundSummary.refundScope === "pending") {
                parts.push(`Explicit refund records include ${refundSummary.pending} PENDING refund(s)${refundSummary.completed > 0 ? ` alongside ${refundSummary.completed} COMPLETED refund(s)` : ""}; refund completion is still in progress.`);
            } else {
                parts.push("Explicit refund records exist, but full vs partial refund scope cannot be verified due to missing, conflicting, or non-comparable amounts/currencies.");
            }
            if (refundSummary.failedOrCancelled > 0) {
                parts.push(`${refundSummary.failedOrCancelled} FAILED/CANCELLED refund record(s) did not succeed.`);
            }
            stageDetail = parts.join(" ");
            break;
        }
        case LIFECYCLE_STAGES.VOIDED:
            if (fundsCaptured === null) {
                stageDetail = "The order is marked VOIDED, yet conflicting capture or refund records are also present; capture state cannot be confirmed without reconciliation.";
            } else if (authorizationSummary.expired > 0) {
                stageDetail = "The authorization has EXPIRED or been VOIDED; no capture occurred and funds cannot be captured.";
            } else {
                stageDetail = "The order or authorization is VOIDED; no funds were captured and further capture cannot occur.";
            }
            break;
        default:
            stageDetail = "The available PayPal records are incomplete, conflicting, or unrecognized and do not establish a reliable conclusion.";
            if (captureSummary.completed > 0 && (captureSummary.declined > 0 || ctx.purchaseUnitSummary.some(u => u.lifecycleStage === LIFECYCLE_STAGES.UNKNOWN))) {
                stageDetail += " Do not let partial or single-unit completion imply the entire order succeeded.";
            } else if (orderStatus === "COMPLETED" && captureSummary.total === 0) {
                stageDetail += " Although order status is COMPLETED, no verified capture record is present, so capture certainty remains unknown.";
            } else if (authorizationSummary.denied > 0) {
                stageDetail += " Verified authorization record(s) were DENIED and no capture occurred.";
            }
            break;
    }

    return `${statusPhrase} ${stageDetail}`.trim();
}

function buildSummary(ctx) {
    const core = buildLifecycleCoreSummary(ctx);
    const { questionIntent } = ctx;

    let intentFocus = "";
    switch (questionIntent) {
        case PROMPT_INTENTS.BANK_DEBIT:
            intentFocus = "Regarding bank or card debit: PayPal Orders v2 responses only describe PayPal-level order, authorization, capture, and refund state and never prove whether a buyer's bank/card was debited or when final merchant bank settlement occurs.";
            break;
        case PROMPT_INTENTS.FEES:
            intentFocus = `Fee breakdown: ${buildFeeSummaryText(ctx)}`;
            break;
        case PROMPT_INTENTS.CAPTURE:
            intentFocus = ctx.fundsCaptured === true
                ? `Capture verification: ${ctx.captureSummary.completed} completed capture record(s) confirmed on PayPal (${ctx.captureSummary.completedAmount ? formatAmount(ctx.captureSummary.completedAmount) : "multi-currency or amount unverified"}).`
                : (ctx.fundsCaptured === "pending"
                    ? "Capture verification: capture activity is pending and not completed yet."
                    : (ctx.fundsCaptured === false
                        ? "Capture verification: no funds have been captured."
                        : "Capture verification: capture certainty is unknown due to missing, mixed, or conflicting PayPal records."));
            break;
        case PROMPT_INTENTS.REFUND:
            if (ctx.refundSummary.total === 0) {
                intentFocus = "Refund verification: no explicit refund records were returned by PayPal for this order.";
            } else {
                intentFocus = `Refund verification: scope is ${ctx.refundSummary.refundScope} (${ctx.refundSummary.completed} COMPLETED, ${ctx.refundSummary.pending} PENDING, ${ctx.refundSummary.failedOrCancelled} FAILED/CANCELLED).`;
            }
            break;
        case PROMPT_INTENTS.NEXT_STEPS:
            intentFocus = "Recommended next steps below are informational verification checks based strictly on the verified PayPal records.";
            break;
        default:
            break;
    }

    const combined = intentFocus ? `${core} ${intentFocus}` : core;
    return truncateText(combined, MAX_SUMMARY_LEN);
}

function buildFinancialImpact(ctx) {
    const {
        lifecycleStage,
        fundsCaptured,
        captureSummary,
        refundSummary,
        orderAmount,
        unitCurrencies,
        questionIntent
    } = ctx;

    const feeNote = (questionIntent === PROMPT_INTENTS.FEES || ctx.captureBreakdowns.length > 0)
        ? ` ${buildFeeSummaryText(ctx)}`
        : "";

    let statement = "";
    if (lifecycleStage === LIFECYCLE_STAGES.CAPTURE_DECLINED) {
        statement = `No funds were captured or received because the capture attempt was declined/failed. Buyer bank debit and bank settlement did not occur from this failed capture.${feeNote}`;
    } else if (fundsCaptured === false) {
        statement = `No funds have been captured or moved on PayPal. Buyer bank/card debit and merchant bank settlement are not confirmed.${feeNote}`;
    } else if (fundsCaptured === "pending") {
        const completedPart = captureSummary.completedAmount
            ? ` ${captureSummary.completed} completed capture(s) total ${formatAmount(captureSummary.completedAmount)}, while`
            : "";
        statement = `Payment capture is pending (${captureSummary.pending} PENDING capture(s));${completedPart || ""} funds are not fully completed or settled, and buyer bank debit or final bank settlement is not verified.${feeNote}`;
    } else if (lifecycleStage === LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL) {
        const capText = captureSummary.completedAmount ? formatAmount(captureSummary.completedAmount) : null;
        const refText = refundSummary.completedAmount ? formatAmount(refundSummary.completedAmount) : null;
        if (fundsCaptured === null) {
            statement = `Explicit refund records exist${refText ? ` (${refText})` : ""}, while overall capture certainty across records/units cannot be confirmed. Final bank/card posting is not verified by Orders v2.${feeNote}`;
        } else {
            statement = `Verified capture activity occurred${capText ? ` (${capText})` : ""} alongside explicit refund records (scope: ${refundSummary.refundScope}${refText ? `, completed refunds: ${refText}` : ""}). Orders v2 does not verify final card/bank posting or bank settlement.${feeNote}`;
        }
    } else if (fundsCaptured === true) {
        const capText = formatAmount(captureSummary.completedAmount);
        const cmp = compareAmounts(captureSummary.completedAmount, orderAmount);
        const partialNote = cmp === -1 && capText && orderAmount
            ? ` This confirmed capture (${capText}) is less than the verified order total (${formatAmount(orderAmount)}), so full order payment cannot be assumed.`
            : (unitCurrencies.length > 1 ? " Captures span multiple currencies and were not summed into one figure." : "");
        statement = `PayPal verified ${captureSummary.completed} completed capture record(s)${capText ? ` totaling ${capText}` : ""}.${partialNote} PayPal capture completion does not prove buyer bank/card debit or final merchant bank settlement.${feeNote}`;
    } else {
        statement = `Capture certainty is unknown because verified PayPal records are incomplete or conflicting.${captureSummary.completed > 0 ? ` (${captureSummary.completed} COMPLETED capture(s) were reported alongside non-completed, declined, voided, or missing records.)` : ""} Do not assume funds were received, debited from the buyer's bank/card, or settled.${feeNote}`;
    }

    return truncateText(statement, MAX_FINANCIAL_IMPACT_LEN);
}

function buildSafeNextSteps(ctx) {
    const {
        lifecycleStage,
        isApprovedCaptureIntentWithoutCaptures,
        authorizationSummary,
        refundSummary,
        fundsCaptured
    } = ctx;

    const steps = [];
    switch (lifecycleStage) {
        case LIFECYCLE_STAGES.CREATED:
            steps.push("Wait for the buyer to review and approve the checkout order on PayPal before treating it as paid.");
            steps.push("Re-check verified order details via the PayPal dashboard or order lookup after buyer checkout completes.");
            steps.push("Do not fulfill or ship goods solely from an order with CREATED status.");
            break;
        case LIFECYCLE_STAGES.AWAITING_PAYER:
            steps.push("Confirm whether the buyer has completed the required PayPal authentication or funding action.");
            steps.push("Re-verify the order status before taking fulfillment or payment actions.");
            steps.push("Avoid creating duplicate orders while the buyer action remains pending.");
            break;
        case LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED:
            if (isApprovedCaptureIntentWithoutCaptures) {
                steps.push("Review the APPROVED order details; as an optional merchant review step, consider capturing via PayPal only after confirming order validity and avoiding duplicate requests.");
            } else {
                steps.push("Review the authorization status and expiration details in the PayPal dashboard rather than treating authorization as captured funds.");
            }
            if (authorizationSummary.total > 0) {
                steps.push("Confirm whether authorized units remain valid before fulfillment or settlement.");
            }
            steps.push("Do not issue duplicate payment requests or assume funds have settled.");
            break;
        case LIFECYCLE_STAGES.CAPTURED_PENDING:
            steps.push("Wait for PayPal to transition the PENDING capture to COMPLETED or FAILED before finalizing fulfillment.");
            steps.push("Re-inspect the order details later to verify whether pending eCheck or review holds cleared.");
            steps.push("Do not submit a duplicate capture while a capture is already PENDING.");
            break;
        case LIFECYCLE_STAGES.CAPTURED_COMPLETED:
            steps.push("Review the verified capture record and any provided seller receivable breakdown in your PayPal merchant account.");
            if (!ctx.hasBreakdown) {
                steps.push("Check your PayPal payout or transaction reporting if seller fee and net receivable details are required.");
            }
            steps.push("Confirm actual bank settlement separately through your PayPal payout and bank statements.");
            steps.push("Avoid issuing duplicate captures or refunds.");
            break;
        case LIFECYCLE_STAGES.CAPTURE_DECLINED:
            steps.push("Review the capture decline status and reason in the PayPal dashboard before contacting the buyer.");
            steps.push("Do not fulfill the order or retry duplicate captures blindly without investigating why PayPal declined it.");
            steps.push("If resolved externally, re-check verified PayPal status using a fresh order lookup.");
            break;
        case LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL:
            if (refundSummary.refundScope === "pending") {
                steps.push("Wait for the PENDING refund record on PayPal to finish before reconciling final net proceeds.");
            } else {
                steps.push("Reconcile each verified refund record against its corresponding capture in PayPal reporting.");
            }
            steps.push("Avoid initiating another refund until all existing refund records and statuses are reconciled.");
            steps.push("Verify final bank/card credit timing via PayPal settlement reports rather than Orders v2 alone.");
            break;
        case LIFECYCLE_STAGES.VOIDED:
            if (fundsCaptured === null) {
                steps.push("Inspect both the VOIDED order state and conflicting capture records directly in the PayPal dashboard.");
                steps.push("Do not assume funds are captured or uncaptured until PayPal records are reconciled.");
            } else {
                steps.push("Confirm the voided or expired state in PayPal reporting and close out unfulfilled checkout records.");
                steps.push("Do not attempt further capture on a voided or expired order/authorization.");
            }
            break;
        default:
            steps.push("Inspect all purchase units, authorizations, captures, and refunds directly in the PayPal merchant dashboard.");
            steps.push("Verify missing or conflicting transaction records before fulfilling, capturing, or refunding.");
            steps.push("Do not submit duplicate captures, refunds, or charges while transaction certainty is unknown.");
            break;
    }

    return normalizeStringList(
        steps,
        "Verify the PayPal transaction status in your PayPal dashboard before taking any fulfillment or payment action."
    );
}

function buildLimitations(ctx) {
    const limitations = [
        "PayPal Orders v2 data does not verify buyer bank/card account debit or final merchant bank settlement."
    ];

    if (ctx.lifecycleStage === LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED || ctx.authorizationSummary.total > 0) {
        limitations.push("Order approval or payment authorization does not confirm captured or transferred funds.");
    }
    if (ctx.lifecycleStage === LIFECYCLE_STAGES.CAPTURED_PENDING) {
        limitations.push("A PENDING capture is not completed and may still clear or fail on PayPal.");
    }
    if (ctx.captureSummary.total > 1 || ctx.unitCount > 1) {
        limitations.push("Multiple captures or purchase units are present; one capture does not necessarily represent the entire order.");
    }
    if (!ctx.hasBreakdown) {
        limitations.push("Complete PayPal seller fee and net receivable breakdown were not provided and are not estimated.");
    }
    if (ctx.unitCurrencies.length > 1) {
        limitations.push(`Amounts across differing currencies (${ctx.unitCurrencies.join(", ")}) are not converted or summed.`);
    }
    if (ctx.fundsCaptured === null || ctx.lifecycleStage === LIFECYCLE_STAGES.UNKNOWN) {
        limitations.push("Missing, unrecognized, or conflicting PayPal records prevent confirming overall capture certainty.");
    }
    if (ctx.lifecycleStage === LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL) {
        limitations.push("Refund completion on PayPal does not confirm card-issuer or buyer bank posting timelines.");
    }

    limitations.push("Generated deterministically from verified PayPal facts without buyer/merchant identity or external ledger data.");

    return normalizeStringList(
        limitations,
        "PayPal Orders v2 facts do not verify buyer bank debit or final bank settlement."
    );
}

/**
 * Deterministically build a schema-valid Copilot explanation from verified
 * PayPal transaction facts and intelligence analysis without calling Gemini.
 *
 * @param {object} verifiedFacts Normalized or sanitized PayPal transaction facts
 * @param {object} [intelligence] Result of `analyzeTransactionIntelligence`
 * @param {string} [prompt] Original user question
 * @returns {{
 *   headline: string,
 *   summary: string,
 *   financialImpact: string,
 *   safeNextSteps: string[],
 *   limitations: string[]
 * }}
 */
function buildFallbackExplanation(verifiedFacts, intelligence, prompt) {
    const ctx = collectSafeContext(verifiedFacts, intelligence, prompt);

    return {
        headline: truncateText(buildHeadline(ctx), MAX_HEADLINE_LEN),
        summary: truncateText(buildSummary(ctx), MAX_SUMMARY_LEN),
        financialImpact: truncateText(buildFinancialImpact(ctx), MAX_FINANCIAL_IMPACT_LEN),
        safeNextSteps: buildSafeNextSteps(ctx),
        limitations: buildLimitations(ctx)
    };
}

module.exports = {
    buildFallbackExplanation
};
