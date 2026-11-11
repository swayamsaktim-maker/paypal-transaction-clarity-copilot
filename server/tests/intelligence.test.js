const test = require("node:test");
const assert = require("node:assert/strict");

const {
    LIFECYCLE_STAGES,
    PROMPT_INTENTS,
    analyzeTransactionIntelligence,
    detectPromptIntent
} = require("../lib/transactionIntelligence");

test("1. CREATED order classifies as CREATED without payment capture or bank debit claims", () => {
    const result = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-CREATED-01",
        status: "CREATED",
        intent: "CAPTURE",
        amount: { value: "45.00", currency: "USD" },
        createTime: "2026-03-01T10:00:00Z",
        updateTime: "2026-03-01T10:00:00Z",
        capture: null
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CREATED);
    assert.equal(result.fundsCaptured, false);
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "buyer");
    assert.equal(result.hasBreakdown, false);
    assert.ok(result.missingFields.includes("capture"));
    assert.ok(result.factualHighlights.some(h => /not occurred/i.test(h)));
    assert.ok(!result.factualHighlights.some(h => /captured successfully|payment received/i.test(h)));
});

test("2. PAYER_ACTION_REQUIRED order classifies as AWAITING_PAYER with buyer action required", () => {
    const result = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-PAYER-02",
        status: "PAYER_ACTION_REQUIRED",
        intent: "CAPTURE",
        amount: { value: "80.00", currency: "USD" },
        createTime: "2026-03-01T11:00:00Z",
        updateTime: "2026-03-01T11:01:00Z",
        capture: null
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.AWAITING_PAYER);
    assert.equal(result.fundsCaptured, false);
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "buyer");
    assert.ok(result.factualHighlights.some(h => /buyer action is still required/i.test(h)));
});

test("3. APPROVED order with no capture is AUTHORIZED_NOT_CAPTURED and never treated as COMPLETED", () => {
    const result = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-APPROVED-03",
        status: "APPROVED",
        intent: "CAPTURE",
        amount: { value: "120.00", currency: "USD" },
        createTime: "2026-03-02T09:00:00Z",
        updateTime: "2026-03-02T09:02:00Z",
        capture: null
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED);
    assert.notEqual(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.fundsCaptured, false);
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "merchant");
    assert.ok(result.missingFields.includes("capture"));
    assert.ok(result.factualHighlights.some(h => /NOT been captured/i.test(h)));
});

test("4. COMPLETED capture sets CAPTURED_COMPLETED and fundsCaptured=true while keeping bankSettlementVerified=false", () => {
    const result = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-COMP-04",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        createTime: "2026-03-03T12:00:00Z",
        updateTime: "2026-03-03T12:01:00Z",
        capture: {
            id: "SYNTH-CAP-COMP-04",
            status: "COMPLETED",
            amount: { value: "50.00", currency: "USD" },
            createTime: "2026-03-03T12:01:00Z",
            updateTime: "2026-03-03T12:01:00Z",
            sellerReceivableBreakdown: {
                grossAmount: { value: "50.00", currency: "USD" },
                paypalFee: { value: "2.24", currency: "USD" },
                netAmount: { value: "47.76", currency: "USD" }
            }
        }
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.fundsCaptured, true);
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "none");
    assert.equal(result.hasBreakdown, true);
    assert.ok(!result.missingFields.includes("sellerReceivableBreakdown"));
    assert.ok(result.factualHighlights.some(h => /does not prove.*bank settlement/i.test(h)));
    assert.ok(result.factualHighlights.some(h => h.includes("2.24 USD") && h.includes("47.76 USD")));
});

test("5. PENDING eCheck capture classifies as CAPTURED_PENDING and fundsCaptured='pending'", () => {
    const result = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-ECHECK-05",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "250.00", currency: "USD" },
        createTime: "2026-03-04T08:00:00Z",
        updateTime: "2026-03-04T08:01:00Z",
        capture: {
            id: "SYNTH-CAP-ECHECK-05",
            status: "PENDING",
            amount: { value: "250.00", currency: "USD" },
            statusDetails: { reason: "ECHECK" },
            createTime: "2026-03-04T08:01:00Z",
            updateTime: "2026-03-04T08:01:00Z"
        }
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
    assert.equal(result.fundsCaptured, "pending");
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "paypal");
    assert.ok(result.factualHighlights.some(h => h.includes("ECHECK") && /not completed/i.test(h)));
});

test("6. DECLINED capture classifies as CAPTURE_DECLINED with fundsCaptured=false", () => {
    const result = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-DECLINED-06",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "75.00", currency: "USD" },
        createTime: "2026-03-05T14:00:00Z",
        updateTime: "2026-03-05T14:02:00Z",
        capture: {
            id: "SYNTH-CAP-DECLINED-06",
            status: "DECLINED",
            amount: { value: "75.00", currency: "USD" },
            createTime: "2026-03-05T14:02:00Z",
            updateTime: "2026-03-05T14:02:00Z"
        }
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURE_DECLINED);
    assert.equal(result.fundsCaptured, false);
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "merchant");
    assert.ok(result.factualHighlights.some(h => /DECLINED\/FAILED/i.test(h)));
});

test("7. VOIDED order classifies as VOIDED and is never classified as completed", () => {
    const baseVoided = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-VOID-07",
        status: "VOIDED",
        intent: "AUTHORIZE",
        amount: { value: "99.00", currency: "USD" },
        createTime: "2026-03-06T10:00:00Z",
        updateTime: "2026-03-06T10:30:00Z",
        capture: null
    });

    assert.equal(baseVoided.lifecycleStage, LIFECYCLE_STAGES.VOIDED);
    assert.equal(baseVoided.fundsCaptured, false);
    assert.equal(baseVoided.bankSettlementVerified, false);
    assert.equal(baseVoided.actionRequiredBy, "none");
    assert.ok(baseVoided.factualHighlights.some(h => /VOIDED/i.test(h)));

    // Even if malformed/contradictory capture is present alongside VOIDED, never treat VOIDED as completed
    const contradictoryVoided = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-VOID-07B",
        status: "VOIDED",
        intent: "CAPTURE",
        amount: { value: "99.00", currency: "USD" },
        createTime: "2026-03-06T10:00:00Z",
        updateTime: "2026-03-06T10:30:00Z",
        capture: {
            id: "SYNTH-CAP-VOID-CONFLICT",
            status: "COMPLETED",
            amount: { value: "99.00", currency: "USD" }
        }
    });
    assert.equal(contradictoryVoided.lifecycleStage, LIFECYCLE_STAGES.VOIDED);
    assert.equal(contradictoryVoided.fundsCaptured, null);
});

test("8. Refunded or partially refunded classification relies solely on verified refund records", () => {
    const withRefundArray = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-REF-08A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "60.00", currency: "USD" },
        createTime: "2026-03-07T09:00:00Z",
        updateTime: "2026-03-07T12:00:00Z",
        captures: [
            {
                id: "SYNTH-CAP-REF-08A",
                status: "PARTIALLY_REFUNDED",
                amount: { value: "60.00", currency: "USD" }
            }
        ],
        refunds: [
            {
                id: "SYNTH-REFUND-08A",
                status: "COMPLETED",
                amount: { value: "20.00", currency: "USD" }
            }
        ]
    });

    assert.equal(withRefundArray.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(withRefundArray.fundsCaptured, true);
    assert.equal(withRefundArray.bankSettlementVerified, false);
    assert.equal(withRefundArray.actionRequiredBy, "none");

    const pendingRefund = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-REF-08B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "40.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-REF-08B", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }],
        refunds: [{ id: "SYNTH-REFUND-08B", status: "PENDING", amount: { value: "40.00", currency: "USD" } }]
    });
    assert.equal(pendingRefund.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(pendingRefund.actionRequiredBy, "paypal");

    // Failed/cancelled refund attempt + refund question must NOT classify normal completed capture as REFUNDED_OR_PARTIAL
    const noActiveRefund = analyzeTransactionIntelligence(
        {
            orderId: "SYNTH-ORD-NOREF-08C",
            status: "COMPLETED",
            intent: "CAPTURE",
            amount: { value: "40.00", currency: "USD" },
            captures: [{ id: "SYNTH-CAP-NOREF-08C", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }],
            refunds: [{ id: "SYNTH-REFUND-FAILED", status: "FAILED", amount: { value: "40.00", currency: "USD" } }]
        },
        "Was this order refunded?"
    );
    assert.equal(noActiveRefund.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(noActiveRefund.questionIntent, PROMPT_INTENTS.REFUND);
});

test("9. Missing or empty seller receivable breakdown sets hasBreakdown=false and avoids invented fees", () => {
    const missingBreakdown = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-NOBD-09A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "10.00", currency: "USD" },
        createTime: "2026-03-08T10:00:00Z",
        updateTime: "2026-03-08T10:01:00Z",
        capture: {
            id: "SYNTH-CAP-NOBD-09A",
            status: "COMPLETED",
            amount: { value: "10.00", currency: "USD" },
            sellerReceivableBreakdown: null
        }
    });

    assert.equal(missingBreakdown.hasBreakdown, false);
    assert.ok(missingBreakdown.missingFields.includes("sellerReceivableBreakdown"));
    assert.ok(
        missingBreakdown.factualHighlights.some(h => /fee and net receivable breakdown were not provided/i.test(h))
    );

    const shellBreakdown = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-NOBD-09B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "10.00", currency: "USD" },
        capture: {
            id: "SYNTH-CAP-NOBD-09B",
            status: "COMPLETED",
            amount: { value: "10.00", currency: "USD" },
            sellerReceivableBreakdown: {
                grossAmount: { value: "10.00", currency: "USD" },
                paypalFee: null,
                netAmount: null
            }
        }
    });

    assert.equal(shellBreakdown.hasBreakdown, false);
    assert.ok(shellBreakdown.missingFields.includes("sellerReceivableBreakdown"));
});

test("10. EUR and JPY amounts preserve verified values and currencies without USD fallback", () => {
    const eurResult = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-EUR-10A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "24.50", currency: "EUR" },
        createTime: "2026-03-09T10:00:00Z",
        updateTime: "2026-03-09T10:01:00Z",
        capture: {
            id: "SYNTH-CAP-EUR-10A",
            status: "COMPLETED",
            amount: { value: "24.50", currency: "EUR" },
            seller_receivable_breakdown: {
                gross_amount: { value: "24.50", currency_code: "EUR" },
                paypal_fee: { value: "1.08", currency_code: "EUR" },
                net_amount: { value: "23.42", currency_code: "EUR" }
            }
        }
    });

    assert.equal(eurResult.hasBreakdown, true);
    assert.ok(eurResult.factualHighlights.some(h => h.includes("24.50 EUR")));
    assert.ok(eurResult.factualHighlights.some(h => h.includes("1.08 EUR") && h.includes("23.42 EUR")));
    assert.ok(!eurResult.factualHighlights.some(h => h.includes("USD") || h.includes("$")));

    const jpyResult = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-JPY-10B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "13000", currency: "JPY" },
        createTime: "2026-03-09T11:00:00Z",
        updateTime: "2026-03-09T11:01:00Z",
        capture: {
            id: "SYNTH-CAP-JPY-10B",
            status: "COMPLETED",
            amount: { value: "13000", currency: "JPY" }
        }
    });

    assert.equal(jpyResult.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(jpyResult.hasBreakdown, false);
    assert.ok(jpyResult.factualHighlights.some(h => h.includes("13000 JPY")));
    assert.ok(!jpyResult.factualHighlights.some(h => h.includes("13000.00") || h.includes("$")));
});

test("11. Multiple captures with mixed statuses and missing capture on COMPLETED order are handled conservatively", () => {
    const mixedCompletedPending = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MIX-11A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        createTime: "2026-03-10T10:00:00Z",
        updateTime: "2026-03-10T10:05:00Z",
        captures: [
            { id: "SYNTH-CAP-1", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } },
            { id: "SYNTH-CAP-2", status: "PENDING", amount: { value: "40.00", currency: "USD" } }
        ]
    });

    assert.equal(mixedCompletedPending.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
    assert.notEqual(mixedCompletedPending.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(mixedCompletedPending.fundsCaptured, "pending");
    assert.equal(mixedCompletedPending.actionRequiredBy, "paypal");
    assert.ok(mixedCompletedPending.factualHighlights.some(h => /2 total: 1 COMPLETED, 1 PENDING/i.test(h)));

    const mixedCompletedDeclined = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MIX-11B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-1", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } },
            { id: "SYNTH-CAP-2", status: "DECLINED", amount: { value: "50.00", currency: "USD" } }
        ]
    });

    assert.equal(mixedCompletedDeclined.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.notEqual(mixedCompletedDeclined.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(mixedCompletedDeclined.fundsCaptured, null);
    assert.equal(mixedCompletedDeclined.actionRequiredBy, "merchant");
    assert.ok(mixedCompletedDeclined.factualHighlights.some(h => /1 COMPLETED, 1 DECLINED\/FAILED/i.test(h)));

    const completedOrderWithoutCapture = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-NOCAP-11C",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "30.00", currency: "USD" },
        capture: null
    });

    assert.equal(completedOrderWithoutCapture.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(completedOrderWithoutCapture.fundsCaptured, null);
    assert.ok(completedOrderWithoutCapture.missingFields.includes("capture"));

    const multipleCompletedCaptures = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MULTI-11D",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-A", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } },
            { id: "SYNTH-CAP-B", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } }
        ]
    });

    assert.equal(multipleCompletedCaptures.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(multipleCompletedCaptures.fundsCaptured, true);
    assert.ok(multipleCompletedCaptures.factualHighlights.some(h => /do not assume one capture represents the entire order/i.test(h)));
});

test("12. All seven prompt-intent categories classify deterministically including ambiguous/unknown as general", () => {
    assert.equal(
        detectPromptIntent("Explain the current payment status in simple language."),
        PROMPT_INTENTS.STATUS
    );
    assert.equal(
        detectPromptIntent("Why is this still pending?"),
        PROMPT_INTENTS.STATUS
    );

    assert.equal(
        detectPromptIntent("Has this payment been captured or is it still waiting for merchant action?"),
        PROMPT_INTENTS.CAPTURE
    );
    assert.equal(
        detectPromptIntent("Why is this capture pending?"),
        PROMPT_INTENTS.CAPTURE
    );

    assert.equal(
        detectPromptIntent("Did this transaction debit the buyer's bank account?"),
        PROMPT_INTENTS.BANK_DEBIT
    );
    assert.equal(
        detectPromptIntent("Was my card charged twice or has final bank settlement occurred?"),
        PROMPT_INTENTS.BANK_DEBIT
    );

    assert.equal(
        detectPromptIntent("What were the PayPal fees and net receivable amount?"),
        PROMPT_INTENTS.FEES
    );

    assert.equal(
        detectPromptIntent("Was this order refunded or is a refund pending?"),
        PROMPT_INTENTS.REFUND
    );

    assert.equal(
        detectPromptIntent("What safe, non-financial next steps should be taken?"),
        PROMPT_INTENTS.NEXT_STEPS
    );

    // Unknown, empty, malformed, false-substring, and multi-topic ties -> general
    assert.equal(detectPromptIntent(""), PROMPT_INTENTS.GENERAL);
    assert.equal(detectPromptIntent("   "), PROMPT_INTENTS.GENERAL);
    assert.equal(detectPromptIntent(null), PROMPT_INTENTS.GENERAL);
    assert.equal(detectPromptIntent("Tell me something interesting."), PROMPT_INTENTS.GENERAL);
    assert.equal(detectPromptIntent("Each network feel is different."), PROMPT_INTENTS.GENERAL);
    assert.equal(detectPromptIntent("Tell me about fees and refunds."), PROMPT_INTENTS.GENERAL);
    assert.equal(detectPromptIntent("Should I capture this or issue a refund?"), PROMPT_INTENTS.GENERAL);

    // Optional prompt forwarding into analyzeTransactionIntelligence
    const analyzedWithPrompt = analyzeTransactionIntelligence(
        { orderId: "SYNTH-ORD-INTENT", status: "APPROVED", capture: null },
        "What safe next steps apply here?"
    );
    assert.equal(analyzedWithPrompt.questionIntent, PROMPT_INTENTS.NEXT_STEPS);
});

test("13. Defensive handling of malformed verifiedFacts and exclusion of buyer/merchant identity", () => {
    for (const badInput of [null, undefined, [], "SYNTH", 123]) {
        const res = analyzeTransactionIntelligence(badInput);
        assert.equal(res.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
        assert.equal(res.fundsCaptured, null);
        assert.equal(res.bankSettlementVerified, false);
        assert.equal(res.actionRequiredBy, "none");
        assert.equal(res.hasBreakdown, false);
    }

    const withUntrustedIdentityFields = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-PII-13",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "15.00", currency: "USD" },
        payer: { emailAddress: "synthetic-buyer@example.invalid", payerId: "SYNTHPAYER" },
        payee: { emailAddress: "synthetic-merchant@example.invalid", merchantId: "SYNTHMERCH" },
        capture: { id: "SYNTH-CAP-PII-13", status: "COMPLETED", amount: { value: "15.00", currency: "USD" } }
    });

    const joined = withUntrustedIdentityFields.factualHighlights.join(" ");
    assert.ok(!joined.includes("synthetic-buyer"));
    assert.ok(!joined.includes("synthetic-merchant"));
    assert.ok(!joined.includes("SYNTHPAYER"));
    assert.ok(!joined.includes("SYNTHMERCH"));
});

test("14. AUTHORIZE intent with verified AUTHORIZED record distinguishes authorization from capture", () => {
    const withAuthorized = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-14A",
        status: "COMPLETED",
        intent: "AUTHORIZE",
        amount: { value: "85.00", currency: "USD" },
        createTime: "2026-04-01T10:00:00Z",
        updateTime: "2026-04-01T10:05:00Z",
        authorizations: [
            {
                id: "SYNTH-AUTH-14A",
                status: "AUTHORIZED",
                amount: { value: "85.00", currency: "USD" },
                expirationTime: "2026-04-30T10:00:00Z"
            }
        ]
    });

    // Order-level COMPLETED with no capture record and only an AUTHORIZED authorization is conflicting -> fundsCaptured=null
    assert.equal(withAuthorized.fundsCaptured, null);
    assert.notEqual(withAuthorized.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);

    const approvedAuthorize = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-14B",
        status: "APPROVED",
        intent: "AUTHORIZE",
        amount: { value: "85.00", currency: "USD" },
        createTime: "2026-04-01T10:00:00Z",
        updateTime: "2026-04-01T10:05:00Z",
        purchaseUnits: [
            {
                payments: {
                    authorizations: [
                        {
                            id: "SYNTH-AUTH-14B",
                            status: "AUTHORIZED",
                            amount: { value: "85.00", currency: "USD" }
                        }
                    ]
                }
            }
        ]
    });

    assert.equal(approvedAuthorize.lifecycleStage, LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED);
    assert.equal(approvedAuthorize.fundsCaptured, false);
    assert.equal(approvedAuthorize.actionRequiredBy, "merchant");
    assert.equal(approvedAuthorize.authorizationSummary.authorized, 1);
    assert.ok(approvedAuthorize.factualHighlights.some(h => /AUTHORIZE/i.test(h)));
    assert.ok(approvedAuthorize.factualHighlights.some(h => /not a completed capture/i.test(h)));

    // Absent authorization data on AUTHORIZE intent must NOT be invented
    const missingAuth = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-14C",
        status: "APPROVED",
        intent: "AUTHORIZE",
        amount: { value: "85.00", currency: "USD" }
    });
    assert.equal(missingAuth.lifecycleStage, LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED);
    assert.equal(missingAuth.fundsCaptured, false);
    assert.equal(missingAuth.authorizationSummary.total, 0);
    assert.ok(missingAuth.missingFields.includes("authorization"));
});

test("15. Authorization statuses CREATED, PENDING, CAPTURED without captures, DENIED, and EXPIRED are handled conservatively", () => {
    const createdAuth = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-15A",
        status: "CREATED",
        intent: "AUTHORIZE",
        amount: { value: "40.00", currency: "USD" },
        authorization: { id: "SYNTH-AUTH-15A", status: "CREATED", amount: { value: "40.00", currency: "USD" } }
    });
    assert.equal(createdAuth.lifecycleStage, LIFECYCLE_STAGES.CREATED);
    assert.equal(createdAuth.fundsCaptured, false);
    assert.equal(createdAuth.authorizationSummary.created, 1);

    const pendingAuth = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-15B",
        status: "APPROVED",
        intent: "AUTHORIZE",
        amount: { value: "40.00", currency: "USD" },
        authorizations: [{ id: "SYNTH-AUTH-15B", status: "PENDING", amount: { value: "40.00", currency: "USD" } }]
    });
    assert.equal(pendingAuth.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(pendingAuth.fundsCaptured, false);
    assert.notEqual(pendingAuth.fundsCaptured, "pending");
    assert.equal(pendingAuth.actionRequiredBy, "paypal");

    const capturedAuthMissingCapture = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-15C",
        status: "COMPLETED",
        intent: "AUTHORIZE",
        amount: { value: "40.00", currency: "USD" },
        authorizations: [{ id: "SYNTH-AUTH-15C", status: "CAPTURED", amount: { value: "40.00", currency: "USD" } }]
    });
    assert.equal(capturedAuthMissingCapture.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(capturedAuthMissingCapture.fundsCaptured, null);
    assert.ok(capturedAuthMissingCapture.missingFields.includes("capture"));

    const deniedAuth = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-15D",
        status: "APPROVED",
        intent: "AUTHORIZE",
        amount: { value: "40.00", currency: "USD" },
        authorizations: [{ id: "SYNTH-AUTH-15D", status: "DENIED", amount: { value: "40.00", currency: "USD" } }]
    });
    assert.equal(deniedAuth.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(deniedAuth.fundsCaptured, false);
    assert.equal(deniedAuth.actionRequiredBy, "merchant");
    assert.ok(deniedAuth.factualHighlights.some(h => /DENIED/i.test(h)));

    const expiredAuth = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-AUTH-15E",
        status: "APPROVED",
        intent: "AUTHORIZE",
        amount: { value: "40.00", currency: "USD" },
        authorizations: [{ id: "SYNTH-AUTH-15E", status: "EXPIRED", amount: { value: "40.00", currency: "USD" }, expirationTime: "2026-03-01T00:00:00Z" }]
    });
    assert.equal(expiredAuth.lifecycleStage, LIFECYCLE_STAGES.VOIDED);
    assert.equal(expiredAuth.fundsCaptured, false);
    assert.equal(expiredAuth.actionRequiredBy, "none");
    assert.ok(expiredAuth.factualHighlights.some(h => /EXPIRED/i.test(h)));
});

test("16. Unknown capture certainty returns null and never equates UNKNOWN lifecycle with fundsCaptured=false", () => {
    const unrecognizedOrderStatus = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-UNK-16A",
        status: "UNRECOGNIZED_PAYPAL_STATE",
        intent: "CAPTURE",
        amount: { value: "25.00", currency: "USD" }
    });
    assert.equal(unrecognizedOrderStatus.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(unrecognizedOrderStatus.fundsCaptured, null);

    const unrecognizedCaptureStatus = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-UNK-16B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "25.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-UNK-16B", status: "MYSTERY_STATE", amount: { value: "25.00", currency: "USD" } }]
    });
    assert.equal(unrecognizedCaptureStatus.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(unrecognizedCaptureStatus.fundsCaptured, null);
});

test("17. Multiple captures preserve exact counts, sum safely on matching currency, and refuse mismatched currencies", () => {
    const allCompletedExactDecimal = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MULTI-17A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "20.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-17A-1", status: "COMPLETED", amount: { value: "19.99", currency: "USD" } },
            { id: "SYNTH-CAP-17A-2", status: "COMPLETED", amount: { value: "0.01", currency: "USD" } }
        ]
    });
    assert.equal(allCompletedExactDecimal.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(allCompletedExactDecimal.fundsCaptured, true);
    assert.equal(allCompletedExactDecimal.captureSummary.total, 2);
    assert.equal(allCompletedExactDecimal.captureSummary.completed, 2);
    assert.deepEqual(allCompletedExactDecimal.captureSummary.completedAmount, { value: "20.00", currency: "USD" });
    assert.ok(allCompletedExactDecimal.factualHighlights.some(h => /do not assume one capture represents the entire order/i.test(h)));

    const allPending = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MULTI-17B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-17B-1", status: "PENDING", amount: { value: "25.00", currency: "USD" } },
            { id: "SYNTH-CAP-17B-2", status: "PENDING", amount: { value: "25.00", currency: "USD" } }
        ]
    });
    assert.equal(allPending.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
    assert.equal(allPending.fundsCaptured, "pending");
    assert.equal(allPending.captureSummary.pending, 2);
    assert.equal(allPending.captureSummary.completedAmount, null);

    const mixedCompletedPending = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MULTI-17C",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "60.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-17C-1", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } },
            { id: "SYNTH-CAP-17C-2", status: "PENDING", amount: { value: "20.00", currency: "USD" } }
        ]
    });
    assert.equal(mixedCompletedPending.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
    assert.equal(mixedCompletedPending.fundsCaptured, "pending");
    assert.equal(mixedCompletedPending.captureSummary.completed, 1);
    assert.equal(mixedCompletedPending.captureSummary.pending, 1);

    const currencyMismatchCaptures = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MULTI-17D",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-17D-1", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } },
            { id: "SYNTH-CAP-17D-2", status: "COMPLETED", amount: { value: "50.00", currency: "EUR" } }
        ]
    });
    assert.equal(currencyMismatchCaptures.captureSummary.completedAmount, null);
    assert.ok(currencyMismatchCaptures.factualHighlights.some(h => /not summed across currencies/i.test(h)));
});

test("18. Refund verification relies strictly on explicit refund records and separates capture vs refund highlights", () => {
    const captureRefundedWithoutRecords = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-NOREF-18A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-18A", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }]
    });
    assert.notEqual(captureRefundedWithoutRecords.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(captureRefundedWithoutRecords.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.equal(captureRefundedWithoutRecords.fundsCaptured, null);
    assert.ok(captureRefundedWithoutRecords.missingFields.includes("refunds"));

    const failedAndCompletedSeparated = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-REFSEP-18B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-18B", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }],
        refunds: [{ id: "SYNTH-REF-18B", status: "CANCELLED", amount: { value: "50.00", currency: "USD" } }]
    });
    assert.equal(failedAndCompletedSeparated.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(failedAndCompletedSeparated.refundSummary.failedOrCancelled, 1);
    assert.equal(failedAndCompletedSeparated.refundSummary.refundScope, "none");
    assert.ok(failedAndCompletedSeparated.factualHighlights.some(h => /^Capture status:/i.test(h)));
    assert.ok(failedAndCompletedSeparated.factualHighlights.some(h => /^Refund record status:/i.test(h)));
});

test("19. Full vs partial refund determination compares valid currency-consistent totals against captured amount", () => {
    const fullRefundMultiCapture = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-FULLREF-19A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-19A-1", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } },
            { id: "SYNTH-CAP-19A-2", status: "REFUNDED", amount: { value: "40.00", currency: "USD" } }
        ],
        refunds: [
            { id: "SYNTH-REF-19A-1", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } },
            { id: "SYNTH-REF-19A-2", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }
        ]
    });
    assert.equal(fullRefundMultiCapture.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(fullRefundMultiCapture.refundSummary.refundScope, "full");
    assert.deepEqual(fullRefundMultiCapture.refundSummary.completedAmount, { value: "100.00", currency: "USD" });
    assert.ok(fullRefundMultiCapture.factualHighlights.some(h => /full refund/i.test(h)));

    const partialRefund = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-PARTREF-19B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "60.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-19B", status: "PARTIALLY_REFUNDED", amount: { value: "60.00", currency: "USD" } }],
        refunds: [{ id: "SYNTH-REF-19B", status: "COMPLETED", amount: { value: "20.00", currency: "USD" } }]
    });
    assert.equal(partialRefund.refundSummary.refundScope, "partial");
    assert.ok(partialRefund.factualHighlights.some(h => /partial refund/i.test(h)));

    const refundCurrencyMismatch = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-REFMM-19C",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "60.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-19C", status: "REFUNDED", amount: { value: "60.00", currency: "USD" } }],
        refunds: [{ id: "SYNTH-REF-19C", status: "COMPLETED", amount: { value: "60.00", currency: "EUR" } }]
    });
    assert.equal(refundCurrencyMismatch.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(refundCurrencyMismatch.refundSummary.refundScope, "unverified");
    assert.ok(refundCurrencyMismatch.factualHighlights.some(h => /does not match verified captured currency/i.test(h)));

    const mixedCompletedPendingRefund = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-REFPEND-19D",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "60.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-19D", status: "PARTIALLY_REFUNDED", amount: { value: "60.00", currency: "USD" } }],
        refunds: [
            { id: "SYNTH-REF-19D-1", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } },
            { id: "SYNTH-REF-19D-2", status: "PENDING", amount: { value: "20.00", currency: "USD" } }
        ]
    });
    assert.equal(mixedCompletedPendingRefund.refundSummary.refundScope, "pending");
    assert.equal(mixedCompletedPendingRefund.actionRequiredBy, "paypal");
});

test("20. Malformed amounts (negative, scientific notation, NaN, bad currency) are rejected without crashes", () => {
    const malformedAmounts = analyzeTransactionIntelligence({
        orderId: "SYNTH-ORD-MAL-20",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "-10.00", currency: "US" },
        captures: [
            { id: "SYNTH-CAP-20A", status: "COMPLETED", amount: { value: "1e2", currency: "USD" } },
            { id: "SYNTH-CAP-20B", status: "COMPLETED", amount: { value: "NaN", currency: "USD" } }
        ]
    });

    assert.equal(malformedAmounts.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(malformedAmounts.captureSummary.completedAmount, null);
    assert.ok(malformedAmounts.missingFields.includes("amount"));
    assert.ok(malformedAmounts.missingFields.includes("capture.amount"));
    assert.ok(!malformedAmounts.factualHighlights.join(" ").includes("NaN"));
});

test("21. Input verifiedFacts object and nested records are never mutated", () => {
    function deepFreeze(obj) {
        if (obj && typeof obj === "object") {
            Object.freeze(obj);
            for (const value of Object.values(obj)) {
                deepFreeze(value);
            }
        }
        return obj;
    }

    const input = deepFreeze({
        orderId: "SYNTH-ORD-FREEZE-21",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        createTime: "2026-04-02T09:00:00Z",
        updateTime: "2026-04-02T09:05:00Z",
        authorizations: [
            { id: "SYNTH-AUTH-21", status: "CAPTURED", amount: { value: "100.00", currency: "USD" } }
        ],
        captures: [
            {
                id: "SYNTH-CAP-21",
                status: "PARTIALLY_REFUNDED",
                amount: { value: "100.00", currency: "USD" },
                sellerReceivableBreakdown: {
                    grossAmount: { value: "100.00", currency: "USD" },
                    paypalFee: { value: "3.20", currency: "USD" },
                    netAmount: { value: "96.80", currency: "USD" }
                }
            }
        ],
        refunds: [
            { id: "SYNTH-REF-21", status: "COMPLETED", amount: { value: "25.00", currency: "USD" } }
        ]
    });

    const snapshot = JSON.stringify(input);
    const result = (() => {
        "use strict";
        return analyzeTransactionIntelligence(input, "Was this partially refunded?");
    })();

    assert.equal(JSON.stringify(input), snapshot);
    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(result.refundSummary.refundScope, "partial");
});

test("22. Multi-unit: two purchase units both COMPLETED classify as CAPTURED_COMPLETED and sum verified currency", () => {
    const result = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-22",
        status: "COMPLETED",
        intent: "CAPTURE",
        createTime: "2026-04-15T10:00:00Z",
        updateTime: "2026-04-15T10:02:00Z",
        purchaseUnits: [
            {
                referenceId: "PU-A",
                amount: { value: "30.00", currency: "USD" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-22A",
                            status: "COMPLETED",
                            amount: { value: "30.00", currency: "USD" },
                            sellerReceivableBreakdown: {
                                grossAmount: { value: "30.00", currency: "USD" },
                                paypalFee: { value: "1.54", currency: "USD" },
                                netAmount: { value: "28.46", currency: "USD" }
                            }
                        }
                    ]
                }
            },
            {
                referenceId: "PU-B",
                amount: { value: "20.00", currency: "USD" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-22B",
                            status: "COMPLETED",
                            amount: { value: "20.00", currency: "USD" },
                            sellerReceivableBreakdown: {
                                grossAmount: { value: "20.00", currency: "USD" },
                                paypalFee: { value: "1.19", currency: "USD" },
                                netAmount: { value: "18.81", currency: "USD" }
                            }
                        }
                    ]
                }
            }
        ]
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.fundsCaptured, true);
    assert.equal(result.bankSettlementVerified, false);
    assert.equal(result.actionRequiredBy, "none");
    assert.equal(result.hasBreakdown, true);
    assert.equal(result.captureSummary.total, 2);
    assert.equal(result.captureSummary.completed, 2);
    assert.deepEqual(result.captureSummary.completedAmount, { value: "50.00", currency: "USD" });
    assert.equal(result.purchaseUnitSummary.length, 2);
    assert.ok(result.factualHighlights.some(h => /unit "PU-A"/i.test(h)));
    assert.ok(result.factualHighlights.some(h => /unit "PU-B"/i.test(h)));
});

test("23. Multi-unit: one COMPLETED unit and one PENDING unit classify as CAPTURED_PENDING", () => {
    const result = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-23",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-DONE",
                amount: { value: "40.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-23A", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-WAIT",
                amount: { value: "25.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-23B", status: "PENDING", statusDetailsReason: "ECHECK", amount: { value: "25.00", currency: "USD" } }]
                }
            }
        ]
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
    assert.equal(result.fundsCaptured, "pending");
    assert.equal(result.actionRequiredBy, "paypal");
    assert.equal(result.captureSummary.completed, 1);
    assert.equal(result.captureSummary.pending, 1);
    assert.equal(result.purchaseUnitSummary[0].lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.purchaseUnitSummary[1].lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
});

test("24. Multi-unit: one COMPLETED unit and one DECLINED unit classify conservatively as UNKNOWN with fundsCaptured=null", () => {
    const result = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-24",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-OK",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-24A", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-DECLINED",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-24B", status: "DECLINED", amount: { value: "50.00", currency: "USD" } }]
                }
            }
        ]
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.notEqual(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.fundsCaptured, null);
    assert.equal(result.actionRequiredBy, "merchant");
    assert.equal(result.captureSummary.completed, 1);
    assert.equal(result.captureSummary.declined, 1);
    assert.ok(result.factualHighlights.some(h => /Conflicting or incomplete payment states/i.test(h)));
    assert.ok(result.factualHighlights.some(h => /PU-OK.*COMPLETED/i.test(h)));
    assert.ok(result.factualHighlights.some(h => /PU-DECLINED.*DECLINED/i.test(h)));
});

test("25. Multi-unit: differing currencies across units forbid cross-currency amount summation", () => {
    const result = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-25",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-EUR",
                amount: { value: "42.50", currency: "EUR" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-25A", status: "COMPLETED", amount: { value: "42.50", currency: "EUR" } }]
                }
            },
            {
                referenceId: "PU-JPY",
                amount: { value: "13000", currency: "JPY" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-25B", status: "COMPLETED", amount: { value: "13000", currency: "JPY" } }]
                }
            }
        ]
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.fundsCaptured, true);
    assert.equal(result.captureSummary.completed, 2);
    assert.equal(result.captureSummary.completedAmount, null);
    assert.ok(result.factualHighlights.some(h => /differing currencies/i.test(h)));
    assert.ok(result.factualHighlights.some(h => /not summed across currencies/i.test(h)));
    assert.deepEqual(result.purchaseUnitSummary[0].amount, { value: "42.50", currency: "EUR" });
    assert.deepEqual(result.purchaseUnitSummary[1].amount, { value: "13000", currency: "JPY" });
});

test("26. Multi-unit: explicit refunds across multiple units aggregate totals safely and validate per-unit currencies", () => {
    const sameCurrencyFullRefund = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-26A",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-R1",
                amount: { value: "60.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-26A-1", status: "REFUNDED", amount: { value: "60.00", currency: "USD" } }],
                    refunds: [{ id: "SYNTH-REF-26A-1", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-R2",
                amount: { value: "40.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-26A-2", status: "REFUNDED", amount: { value: "40.00", currency: "USD" } }],
                    refunds: [{ id: "SYNTH-REF-26A-2", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }]
                }
            }
        ]
    });

    assert.equal(sameCurrencyFullRefund.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(sameCurrencyFullRefund.fundsCaptured, true);
    assert.equal(sameCurrencyFullRefund.refundSummary.completed, 2);
    assert.equal(sameCurrencyFullRefund.refundSummary.refundScope, "full");
    assert.deepEqual(sameCurrencyFullRefund.refundSummary.completedAmount, { value: "100.00", currency: "USD" });

    const mismatchedInsideOneUnit = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-26B",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-MISMATCH",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-26B-1", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }],
                    refunds: [{ id: "SYNTH-REF-26B-1", status: "COMPLETED", amount: { value: "50.00", currency: "EUR" } }]
                }
            },
            {
                referenceId: "PU-VALID",
                amount: { value: "30.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-26B-2", status: "REFUNDED", amount: { value: "30.00", currency: "USD" } }],
                    refunds: [{ id: "SYNTH-REF-26B-2", status: "COMPLETED", amount: { value: "30.00", currency: "USD" } }]
                }
            }
        ]
    });

    assert.equal(mismatchedInsideOneUnit.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(mismatchedInsideOneUnit.refundSummary.refundScope, "unverified");
    assert.notEqual(mismatchedInsideOneUnit.refundSummary.refundScope, "full");
});

test("27. Multi-unit: full refund in one unit with no refund in another classifies order refund as partial", () => {
    const sameCurrency = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-27A",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-REFUNDED",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-27A-1", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }],
                    refunds: [{ id: "SYNTH-REF-27A-1", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-KEPT",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-27A-2", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }],
                    refunds: []
                }
            }
        ]
    });

    assert.equal(sameCurrency.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(sameCurrency.fundsCaptured, true);
    assert.equal(sameCurrency.refundSummary.refundScope, "partial");
    assert.notEqual(sameCurrency.refundSummary.refundScope, "full");
    assert.equal(sameCurrency.purchaseUnitSummary[0].refundScope, "full");
    assert.equal(sameCurrency.purchaseUnitSummary[1].refundScope, "none");

    const crossCurrency = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-27B",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-USD-REFUNDED",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-27B-1", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }],
                    refunds: [{ id: "SYNTH-REF-27B-1", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-EUR-KEPT",
                amount: { value: "40.00", currency: "EUR" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-27B-2", status: "COMPLETED", amount: { value: "40.00", currency: "EUR" } }],
                    refunds: []
                }
            }
        ]
    });

    assert.equal(crossCurrency.refundSummary.refundScope, "partial");
    assert.ok(crossCurrency.factualHighlights.some(h => /PU-EUR-KEPT/i.test(h)));
    assert.ok(crossCurrency.factualHighlights.some(h => /not summed/i.test(h)));
});

test("28. Multi-unit: authorization records in second unit are aggregated and mixed capture+auth unit stays conservative", () => {
    const authOnlyInSecondUnit = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-28A",
        status: "APPROVED",
        intent: "AUTHORIZE",
        createTime: "2026-04-16T09:00:00Z",
        updateTime: "2026-04-16T09:05:00Z",
        purchaseUnits: [
            {
                referenceId: "PU-1-NO-AUTH",
                amount: { value: "25.00", currency: "USD" },
                payments: { authorizations: [], captures: [], refunds: [] }
            },
            {
                referenceId: "PU-2-AUTH",
                amount: { value: "75.00", currency: "USD" },
                payments: {
                    authorizations: [
                        { id: "SYNTH-AUTH-28A", status: "AUTHORIZED", amount: { value: "75.00", currency: "USD" } }
                    ],
                    captures: [],
                    refunds: []
                }
            }
        ]
    });

    assert.equal(authOnlyInSecondUnit.lifecycleStage, LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED);
    assert.equal(authOnlyInSecondUnit.fundsCaptured, false);
    assert.equal(authOnlyInSecondUnit.actionRequiredBy, "merchant");
    assert.equal(authOnlyInSecondUnit.authorizationSummary.authorized, 1);
    assert.ok(authOnlyInSecondUnit.factualHighlights.some(h => /unit "PU-2-AUTH"/i.test(h)));

    const capturedFirstAuthSecond = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-28B",
        status: "COMPLETED",
        intent: "AUTHORIZE",
        purchaseUnits: [
            {
                referenceId: "PU-CAPTURED",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-28B", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-STILL-AUTH",
                amount: { value: "50.00", currency: "USD" },
                payments: {
                    authorizations: [{ id: "SYNTH-AUTH-28B", status: "AUTHORIZED", amount: { value: "50.00", currency: "USD" } }],
                    captures: []
                }
            }
        ]
    });

    assert.equal(capturedFirstAuthSecond.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.notEqual(capturedFirstAuthSecond.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(capturedFirstAuthSecond.fundsCaptured, null);
    assert.equal(capturedFirstAuthSecond.actionRequiredBy, "merchant");
});

test("29. Multi-unit: missing payment records in one unit prevent completed order classification", () => {
    const result = analyzeTransactionIntelligence({
        id: "SYNTH-MULTI-ORD-29",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: [
            {
                referenceId: "PU-CAPTURED",
                amount: { value: "40.00", currency: "USD" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-29A",
                            status: "COMPLETED",
                            amount: { value: "40.00", currency: "USD" },
                            sellerReceivableBreakdown: {
                                grossAmount: { value: "40.00", currency: "USD" },
                                paypalFee: { value: "1.80", currency: "USD" },
                                netAmount: { value: "38.20", currency: "USD" }
                            }
                        }
                    ]
                }
            },
            {
                referenceId: "PU-MISSING-PAYMENTS",
                amount: { value: "60.00", currency: "USD" },
                payments: { authorizations: [], captures: [], refunds: [] }
            }
        ]
    });

    assert.equal(result.lifecycleStage, LIFECYCLE_STAGES.UNKNOWN);
    assert.notEqual(result.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(result.fundsCaptured, null);
    assert.equal(result.hasBreakdown, false);
    assert.ok(result.missingFields.includes("purchaseUnits[1].capture"));
    assert.ok(result.factualHighlights.some(h => /PU-MISSING-PAYMENTS.*no capture, authorization, or refund records/i.test(h)));
});

test("30. Multi-unit frozen input is never mutated and legacy single-unit shape remains supported", () => {
    function deepFreeze(obj) {
        if (obj && typeof obj === "object") {
            Object.freeze(obj);
            for (const value of Object.values(obj)) {
                deepFreeze(value);
            }
        }
        return obj;
    }

    const frozenMultiUnit = deepFreeze({
        id: "SYNTH-MULTI-FREEZE-30",
        status: "COMPLETED",
        intent: "CAPTURE",
        createTime: "2026-04-16T12:00:00Z",
        updateTime: "2026-04-16T12:05:00Z",
        purchaseUnits: [
            {
                referenceId: "PU-1",
                amount: { value: "10.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-30A", status: "COMPLETED", amount: { value: "10.00", currency: "USD" } }]
                }
            },
            {
                referenceId: "PU-2",
                amount: { value: "15.00", currency: "USD" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-30B", status: "COMPLETED", amount: { value: "15.00", currency: "USD" } }]
                }
            }
        ]
    });

    const snapshot = JSON.stringify(frozenMultiUnit);
    const multiRes = (() => {
        "use strict";
        return analyzeTransactionIntelligence(frozenMultiUnit, "Did both units capture?");
    })();

    assert.equal(JSON.stringify(frozenMultiUnit), snapshot);
    assert.equal(multiRes.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.deepEqual(multiRes.captureSummary.completedAmount, { value: "25.00", currency: "USD" });

    // Legacy single-unit flat fixture continues working seamlessly
    const legacyRes = analyzeTransactionIntelligence({
        orderId: "SYNTH-LEGACY-30",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "12.00", currency: "USD" },
        capture: { id: "SYNTH-CAP-LEG-30", status: "COMPLETED", amount: { value: "12.00", currency: "USD" } }
    });
    assert.equal(legacyRes.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(legacyRes.fundsCaptured, true);
    assert.deepEqual(legacyRes.purchaseUnitSummary, []);
});
