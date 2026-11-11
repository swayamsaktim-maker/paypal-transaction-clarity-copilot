const test = require("node:test");
const assert = require("node:assert/strict");

const {
    LIFECYCLE_STAGES,
    PROMPT_INTENTS,
    analyzeTransactionIntelligence
} = require("../lib/transactionIntelligence");
const { buildFallbackExplanation } = require("../lib/fallbackExplainer");
const { extractVerifiedPayPalFacts } = require("../lib/paypalFacts");

function assertValidSchema(explanation, contextLabel = "explanation") {
    assert.ok(explanation && typeof explanation === "object" && !Array.isArray(explanation), `${contextLabel}: must be plain object`);

    assert.equal(typeof explanation.headline, "string", `${contextLabel}: headline must be string`);
    assert.ok(explanation.headline.trim().length > 0 && explanation.headline.length <= 150, `${contextLabel}: headline length ${explanation.headline.length}`);

    assert.equal(typeof explanation.summary, "string", `${contextLabel}: summary must be string`);
    assert.ok(explanation.summary.trim().length > 0 && explanation.summary.length <= 1500, `${contextLabel}: summary length ${explanation.summary.length}`);

    assert.equal(typeof explanation.financialImpact, "string", `${contextLabel}: financialImpact must be string`);
    assert.ok(explanation.financialImpact.trim().length > 0 && explanation.financialImpact.length <= 1000, `${contextLabel}: financialImpact length ${explanation.financialImpact.length}`);

    assert.ok(Array.isArray(explanation.safeNextSteps), `${contextLabel}: safeNextSteps must be array`);
    assert.ok(explanation.safeNextSteps.length >= 1 && explanation.safeNextSteps.length <= 6, `${contextLabel}: safeNextSteps count ${explanation.safeNextSteps.length}`);
    for (const step of explanation.safeNextSteps) {
        assert.equal(typeof step, "string");
        assert.ok(step.trim().length > 0 && step.length <= 300, `${contextLabel}: step length ${step.length}`);
    }

    assert.ok(Array.isArray(explanation.limitations), `${contextLabel}: limitations must be array`);
    assert.ok(explanation.limitations.length >= 1 && explanation.limitations.length <= 6, `${contextLabel}: limitations count ${explanation.limitations.length}`);
    for (const lim of explanation.limitations) {
        assert.equal(typeof lim, "string");
        assert.ok(lim.trim().length > 0 && lim.length <= 300, `${contextLabel}: limitation length ${lim.length}`);
    }
}

function assertDoesNotAdviseCapture(explanation, label) {
    const joinedSteps = explanation.safeNextSteps.join(" ");
    assert.ok(
        !/\bconsider capturing\b|\bcapture payment\b/i.test(joinedSteps),
        `${label}: must NOT suggest capturing (${joinedSteps})`
    );
}

test("1. All nine lifecycle stages produce accurate explanations and honor capture-suggestion guardrails", () => {
    // 1. CREATED
    const createdFacts = {
        id: "SYNTH-ORD-CR-01",
        status: "CREATED",
        intent: "CAPTURE",
        amount: { value: "25.00", currency: "USD" }
    };
    const createdExp = buildFallbackExplanation(createdFacts, analyzeTransactionIntelligence(createdFacts), "What happened?");
    assertValidSchema(createdExp, "CREATED");
    assert.ok(/not necessarily approved or paid|not occurred/i.test(`${createdExp.headline} ${createdExp.summary}`));
    assertDoesNotAdviseCapture(createdExp, "CREATED");

    // 2. AWAITING_PAYER
    const awaitingFacts = {
        id: "SYNTH-ORD-AW-01",
        status: "PAYER_ACTION_REQUIRED",
        intent: "CAPTURE",
        amount: { value: "25.00", currency: "USD" }
    };
    const awaitingExp = buildFallbackExplanation(awaitingFacts, analyzeTransactionIntelligence(awaitingFacts), "Status?");
    assertValidSchema(awaitingExp, "AWAITING_PAYER");
    assert.ok(/buyer action/i.test(`${awaitingExp.headline} ${awaitingExp.summary}`));
    assertDoesNotAdviseCapture(awaitingExp, "AWAITING_PAYER");

    // 3a. AUTHORIZED_NOT_CAPTURED with intent CAPTURE -> optional review mention allowed
    const approvedCaptureFacts = {
        id: "SYNTH-ORD-AP-01A",
        status: "APPROVED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" }
    };
    const approvedCaptureExp = buildFallbackExplanation(approvedCaptureFacts, analyzeTransactionIntelligence(approvedCaptureFacts), "What should I do next?");
    assertValidSchema(approvedCaptureExp, "APPROVED_CAPTURE");
    assert.ok(/not.*captured|authorization is not/i.test(`${approvedCaptureExp.headline} ${approvedCaptureExp.summary}`));
    assert.ok(approvedCaptureExp.safeNextSteps.some(s => /optional merchant review/i.test(s)));

    // 3b. AUTHORIZED_NOT_CAPTURED with intent AUTHORIZE -> MUST NOT suggest capturing
    const approvedAuthFacts = {
        id: "SYNTH-ORD-AP-01B",
        status: "APPROVED",
        intent: "AUTHORIZE",
        amount: { value: "50.00", currency: "USD" },
        authorizations: [{ id: "SYNTH-AUTH-01", status: "AUTHORIZED", amount: { value: "50.00", currency: "USD" } }]
    };
    const approvedAuthExp = buildFallbackExplanation(approvedAuthFacts, analyzeTransactionIntelligence(approvedAuthFacts), "What should I do next?");
    assertValidSchema(approvedAuthExp, "AUTHORIZED_NOT_CAPTURED_AUTHORIZE");
    assert.ok(/authorization is not capture|not confirmed as captured/i.test(approvedAuthExp.summary));
    assertDoesNotAdviseCapture(approvedAuthExp, "AUTHORIZED_NOT_CAPTURED_AUTHORIZE");

    // 4. CAPTURED_PENDING
    const pendingFacts = {
        id: "SYNTH-ORD-PE-01",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "30.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-PE-01", status: "PENDING", statusDetailsReason: "ECHECK", amount: { value: "30.00", currency: "USD" } }]
    };
    const pendingExp = buildFallbackExplanation(pendingFacts, analyzeTransactionIntelligence(pendingFacts), "Did payment complete?");
    assertValidSchema(pendingExp, "CAPTURED_PENDING");
    assert.ok(/PENDING/i.test(pendingExp.summary));
    assert.ok(!/\bcapture completed\b/i.test(pendingExp.headline));
    assertDoesNotAdviseCapture(pendingExp, "CAPTURED_PENDING");

    // 5. CAPTURED_COMPLETED
    const completedFacts = {
        id: "SYNTH-ORD-CO-01",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "40.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-CO-01", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }]
    };
    const completedExp = buildFallbackExplanation(completedFacts, analyzeTransactionIntelligence(completedFacts), "Explain payment.");
    assertValidSchema(completedExp, "CAPTURED_COMPLETED");
    assert.ok(/COMPLETED/i.test(completedExp.summary));
    assert.ok(/bank settlement/i.test(`${completedExp.summary} ${completedExp.financialImpact}`));
    assertDoesNotAdviseCapture(completedExp, "CAPTURED_COMPLETED");

    // 6. CAPTURE_DECLINED
    const declinedFacts = {
        id: "SYNTH-ORD-DE-01",
        status: "APPROVED",
        intent: "CAPTURE",
        amount: { value: "40.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-DE-01", status: "DECLINED", amount: { value: "40.00", currency: "USD" } }]
    };
    const declinedExp = buildFallbackExplanation(declinedFacts, analyzeTransactionIntelligence(declinedFacts), "Was payment received?");
    assertValidSchema(declinedExp, "CAPTURE_DECLINED");
    assert.ok(/declined|not received/i.test(`${declinedExp.headline} ${declinedExp.summary}`));
    assert.ok(
        /capture attempt was declined\/failed/i.test(declinedExp.financialImpact) &&
        /did not occur from this failed capture/i.test(declinedExp.financialImpact),
        `CAPTURE_DECLINED financialImpact should use capture-declined branch: ${declinedExp.financialImpact}`
    );
    assertDoesNotAdviseCapture(declinedExp, "CAPTURE_DECLINED");

    // 7. REFUNDED_OR_PARTIAL
    const refundedFacts = {
        id: "SYNTH-ORD-RE-01",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "40.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-RE-01", status: "REFUNDED", amount: { value: "40.00", currency: "USD" } }],
        refunds: [{ id: "SYNTH-REF-RE-01", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } }]
    };
    const refundedExp = buildFallbackExplanation(refundedFacts, analyzeTransactionIntelligence(refundedFacts), "Was it refunded?");
    assertValidSchema(refundedExp, "REFUNDED_OR_PARTIAL");
    assert.ok(/refund/i.test(`${refundedExp.headline} ${refundedExp.summary}`));
    assertDoesNotAdviseCapture(refundedExp, "REFUNDED_OR_PARTIAL");

    // 8. VOIDED
    const voidedFacts = {
        id: "SYNTH-ORD-VO-01",
        status: "VOIDED",
        intent: "CAPTURE",
        amount: { value: "40.00", currency: "USD" }
    };
    const voidedExp = buildFallbackExplanation(voidedFacts, analyzeTransactionIntelligence(voidedFacts), "Status?");
    assertValidSchema(voidedExp, "VOIDED");
    assert.ok(/voided/i.test(`${voidedExp.headline} ${voidedExp.summary}`));
    assertDoesNotAdviseCapture(voidedExp, "VOIDED");

    // 9. UNKNOWN
    const unknownFacts = {
        id: "SYNTH-ORD-UN-01",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "40.00", currency: "USD" }
    };
    const unknownExp = buildFallbackExplanation(unknownFacts, analyzeTransactionIntelligence(unknownFacts), "Is it paid?");
    assertValidSchema(unknownExp, "UNKNOWN");
    assert.ok(/reliable conclusion|unknown|cannot be verified/i.test(`${unknownExp.headline} ${unknownExp.summary}`));
    assertDoesNotAdviseCapture(unknownExp, "UNKNOWN");
});

test("2. All seven prompt intents tailor explanation focus without weakening safety rules", () => {
    const facts = {
        id: "SYNTH-ORD-INTENTS-02",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [
            {
                id: "SYNTH-CAP-02",
                status: "COMPLETED",
                amount: { value: "100.00", currency: "USD" },
                sellerReceivableBreakdown: {
                    grossAmount: { value: "100.00", currency: "USD" },
                    paypalFee: { value: "3.98", currency: "USD" },
                    netAmount: { value: "96.02", currency: "USD" }
                }
            }
        ],
        refunds: []
    };

    const prompts = {
        [PROMPT_INTENTS.STATUS]: "What is the current status of this order?",
        [PROMPT_INTENTS.CAPTURE]: "Was this payment captured yet?",
        [PROMPT_INTENTS.BANK_DEBIT]: "Was my bank account debited and has final settlement cleared?",
        [PROMPT_INTENTS.FEES]: "What were the PayPal fee and net payout amount?",
        [PROMPT_INTENTS.REFUND]: "Were any refunds processed on this payment?",
        [PROMPT_INTENTS.NEXT_STEPS]: "What safe next steps should we do now?",
        [PROMPT_INTENTS.GENERAL]: "Tell me about this transaction."
    };

    for (const [expectedIntent, promptText] of Object.entries(prompts)) {
        const intel = analyzeTransactionIntelligence(facts, promptText);
        assert.equal(intel.questionIntent, expectedIntent);
        const exp = buildFallbackExplanation(facts, intel, promptText);
        assertValidSchema(exp, expectedIntent);

        if (expectedIntent === PROMPT_INTENTS.BANK_DEBIT) {
            assert.ok(/cannot verify buyer bank\/card debit|never prove/i.test(`${exp.headline} ${exp.summary}`));
        } else if (expectedIntent === PROMPT_INTENTS.FEES) {
            assert.ok(exp.summary.includes("3.98 USD") && exp.summary.includes("96.02 USD"));
        } else if (expectedIntent === PROMPT_INTENTS.REFUND) {
            assert.ok(/no explicit refund records/i.test(exp.summary));
        } else if (expectedIntent === PROMPT_INTENTS.CAPTURE) {
            assert.ok(/completed capture/i.test(exp.summary));
        } else if (expectedIntent === PROMPT_INTENTS.NEXT_STEPS) {
            assert.ok(/next steps/i.test(exp.summary));
        }
    }
});

test("3. Handles fundsCaptured=null and pending authorization/capture states safely", () => {
    const contradictoryFacts = {
        id: "SYNTH-ORD-NULL-03A",
        status: "VOIDED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-03A", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
    };
    const contradictoryIntel = analyzeTransactionIntelligence(contradictoryFacts);
    assert.equal(contradictoryIntel.fundsCaptured, null);
    const contradictoryExp = buildFallbackExplanation(contradictoryFacts, contradictoryIntel, "Status?");
    assertValidSchema(contradictoryExp, "VOIDED_CONFLICT");
    assert.ok(/conflicting/i.test(`${contradictoryExp.headline} ${contradictoryExp.summary}`));
    assert.ok(/unknown|cannot be confirmed/i.test(`${contradictoryExp.financialImpact} ${contradictoryExp.summary}`));

    const pendingMixed = {
        id: "SYNTH-ORD-PEND-03B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "80.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-03B-1", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } },
            { id: "SYNTH-CAP-03B-2", status: "PENDING", statusDetailsReason: "ECHECK", amount: { value: "30.00", currency: "USD" } }
        ]
    };
    const pendingIntel = analyzeTransactionIntelligence(pendingMixed);
    assert.equal(pendingIntel.fundsCaptured, "pending");
    const pendingExp = buildFallbackExplanation(pendingMixed, pendingIntel, "Is this completed?");
    assertValidSchema(pendingExp, "PENDING_MIXED");
    assert.ok(/not.*completed|not fully completed|pending/i.test(pendingExp.headline));
    assert.ok(pendingExp.summary.includes("50.00 USD") || pendingExp.financialImpact.includes("50.00 USD"));
});

test("4. Distinguishes partial captures and multiple captures from full order payment", () => {
    const partialSingle = {
        id: "SYNTH-ORD-PART-04A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [{ id: "SYNTH-CAP-04A", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } }]
    };
    const partialExp = buildFallbackExplanation(partialSingle, analyzeTransactionIntelligence(partialSingle), "Was the full order paid?");
    assertValidSchema(partialExp, "PARTIAL_CAPTURE");
    assert.ok(/less than/i.test(partialExp.summary));
    assert.ok(/full order payment cannot be assumed|do not assume full order payment/i.test(`${partialExp.summary} ${partialExp.financialImpact}`));

    const multiCapture = {
        id: "SYNTH-ORD-MULT-04B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "100.00", currency: "USD" },
        captures: [
            { id: "SYNTH-CAP-04B-1", status: "COMPLETED", amount: { value: "40.00", currency: "USD" } },
            { id: "SYNTH-CAP-04B-2", status: "COMPLETED", amount: { value: "60.00", currency: "USD" } }
        ]
    };
    const multiExp = buildFallbackExplanation(multiCapture, analyzeTransactionIntelligence(multiCapture), "Summary?");
    assertValidSchema(multiExp, "MULTI_CAPTURE");
    assert.ok(multiExp.limitations.some(l => /multiple captures/i.test(l)));
});

test("5. Full, partial, pending, and unverified refunds are described conservatively", () => {
    const scenarios = [
        {
            label: "FULL_REFUND",
            facts: {
                id: "SYNTH-REF-FULL",
                status: "COMPLETED",
                amount: { value: "50.00", currency: "USD" },
                captures: [{ id: "C1", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }],
                refunds: [{ id: "R1", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
            },
            pattern: /match verified captured totals|50\.00 USD/i
        },
        {
            label: "PARTIAL_REFUND",
            facts: {
                id: "SYNTH-REF-PART",
                status: "COMPLETED",
                amount: { value: "50.00", currency: "USD" },
                captures: [{ id: "C2", status: "PARTIALLY_REFUNDED", amount: { value: "50.00", currency: "USD" } }],
                refunds: [{ id: "R2", status: "COMPLETED", amount: { value: "15.00", currency: "USD" } }]
            },
            pattern: /partial refund/i
        },
        {
            label: "PENDING_REFUND",
            facts: {
                id: "SYNTH-REF-PEND",
                status: "COMPLETED",
                amount: { value: "50.00", currency: "USD" },
                captures: [{ id: "C3", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }],
                refunds: [{ id: "R3", status: "PENDING", amount: { value: "50.00", currency: "USD" } }]
            },
            pattern: /PENDING refund/i
        },
        {
            label: "UNVERIFIED_REFUND",
            facts: {
                id: "SYNTH-REF-UNV",
                status: "COMPLETED",
                amount: { value: "50.00", currency: "USD" },
                captures: [{ id: "C4", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }],
                refunds: [{ id: "R4", status: "COMPLETED", amount: { value: "50.00", currency: "EUR" } }]
            },
            pattern: /cannot be verified/i
        }
    ];

    for (const s of scenarios) {
        const intel = analyzeTransactionIntelligence(s.facts, "Explain refund status");
        const exp = buildFallbackExplanation(s.facts, intel, "Explain refund status");
        assertValidSchema(exp, s.label);
        assert.ok(s.pattern.test(`${exp.summary} ${exp.financialImpact}`), `${s.label}: expected ${s.pattern} in ${exp.summary}`);
    }
});

test("6. Seller fee breakdown present vs missing never invents fees or net amounts", () => {
    const withFeeFacts = {
        id: "SYNTH-FEE-PRESENT",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "20.00", currency: "USD" },
        captures: [
            {
                id: "C-FEE-1",
                status: "COMPLETED",
                amount: { value: "20.00", currency: "USD" },
                sellerReceivableBreakdown: {
                    grossAmount: { value: "20.00", currency: "USD" },
                    paypalFee: { value: "1.19", currency: "USD" },
                    netAmount: { value: "18.81", currency: "USD" }
                }
            }
        ]
    };
    const withFeeExp = buildFallbackExplanation(withFeeFacts, analyzeTransactionIntelligence(withFeeFacts, "What are the fees?"), "What are the fees?");
    assertValidSchema(withFeeExp, "FEES_PRESENT");
    assert.ok(withFeeExp.summary.includes("1.19 USD") && withFeeExp.summary.includes("18.81 USD"));

    const withoutFeeFacts = {
        id: "SYNTH-FEE-MISSING",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "20.00", currency: "USD" },
        captures: [{ id: "C-FEE-2", status: "COMPLETED", amount: { value: "20.00", currency: "USD" } }]
    };
    const withoutFeeExp = buildFallbackExplanation(withoutFeeFacts, analyzeTransactionIntelligence(withoutFeeFacts, "What are the fees?"), "What are the fees?");
    assertValidSchema(withoutFeeExp, "FEES_MISSING");
    assert.ok(/not provided/i.test(withoutFeeExp.summary));
    assert.ok(withoutFeeExp.limitations.some(l => /not provided and are not estimated/i.test(l)));
});

test("7. USD, EUR, and JPY amounts and currencies preserve exact values without USD fallback", () => {
    const eurPayPalOrder = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-EUR-07",
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-10T10:00:00Z",
        update_time: "2026-04-10T10:01:00Z",
        purchase_units: [
            {
                amount: { currency_code: "EUR", value: "42.50" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-EUR-07", status: "COMPLETED", amount: { currency_code: "EUR", value: "42.50" } }]
                }
            }
        ]
    });
    const eurExp = buildFallbackExplanation(eurPayPalOrder, analyzeTransactionIntelligence(eurPayPalOrder), "What happened?");
    assertValidSchema(eurExp, "EUR");
    assert.ok(eurExp.summary.includes("42.50 EUR"));
    assert.ok(!JSON.stringify(eurExp).includes("USD"));

    const jpyPayPalOrder = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-JPY-07",
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-10T10:00:00Z",
        update_time: "2026-04-10T10:01:00Z",
        purchase_units: [
            {
                amount: { currency_code: "JPY", value: "13000" },
                payments: {
                    captures: [{ id: "SYNTH-CAP-JPY-07", status: "COMPLETED", amount: { currency_code: "JPY", value: "13000" } }]
                }
            }
        ]
    });
    const jpyExp = buildFallbackExplanation(jpyPayPalOrder, analyzeTransactionIntelligence(jpyPayPalOrder), "What happened?");
    assertValidSchema(jpyExp, "JPY");
    assert.ok(jpyExp.summary.includes("13000 JPY"));
    assert.ok(!JSON.stringify(jpyExp).includes("USD"));
});

test("8. PII, tokens, links, and injected strings in fields are excluded from all outputs", () => {
    const hostileFacts = {
        id: "buyer@example.invalid",
        status: "COMPLETED",
        intent: "CAPTURE",
        access_token: "SYNTH_SECRET_TOKEN",
        payer: { email_address: "synthetic-payer@example.invalid", payer_id: "SYNTHPAYER88" },
        payee: { email_address: "synthetic-merchant@example.invalid", merchant_id: "SYNTHMERCH88" },
        shipping: { address: { address_line_1: "999 Private Road" } },
        links: [{ href: "https://sandbox.paypal.com/checkoutnow?token=SECRET", rel: "approve" }],
        amount: { value: "50.00", currency: "USD" },
        captures: [
            {
                id: "SYNTH-CAP-8",
                status: "PENDING",
                statusDetailsReason: "leak@example.invalid",
                amount: { value: "50.00", currency: "USD" }
            }
        ]
    };

    const exp = buildFallbackExplanation(hostileFacts, analyzeTransactionIntelligence(hostileFacts), "Check status");
    assertValidSchema(exp, "PII_EXCLUSION");
    const serialized = JSON.stringify(exp);
    for (const secret of [
        "buyer@example.invalid",
        "synthetic-payer@example.invalid",
        "SYNTHPAYER88",
        "synthetic-merchant@example.invalid",
        "SYNTHMERCH88",
        "999 Private Road",
        "SYNTH_SECRET_TOKEN",
        "sandbox.paypal.com",
        "leak@example.invalid"
    ]) {
        assert.ok(!serialized.includes(secret), `Explanation must exclude ${secret}`);
    }
});

test("9. Output schema strictly respects length bounds even under oversized inputs and multi-unit lists", () => {
    const manyUnits = Array.from({ length: 12 }, (_, idx) => ({
        referenceId: `PU_LONG_IDENTIFIER_${idx}_${"X".repeat(30)}`,
        amount: { value: "10.00", currency: idx % 2 === 0 ? "USD" : "EUR" },
        payments: {
            captures: [
                {
                    id: `SYNTH_CAP_${idx}`,
                    status: idx === 0 ? "COMPLETED" : "PENDING",
                    statusDetailsReason: "REGULATORY_REVIEW",
                    amount: { value: "10.00", currency: idx % 2 === 0 ? "USD" : "EUR" },
                    sellerReceivableBreakdown: {
                        grossAmount: { value: "10.00", currency: idx % 2 === 0 ? "USD" : "EUR" },
                        paypalFee: { value: "0.50", currency: idx % 2 === 0 ? "USD" : "EUR" },
                        netAmount: { value: "9.50", currency: idx % 2 === 0 ? "USD" : "EUR" }
                    }
                }
            ]
        }
    }));

    const oversizedFacts = {
        id: "SYNTH_ORDER_999",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchaseUnits: manyUnits
    };

    const longPrompt = `Explain fees capture refund bank settlement next steps ${"detail ".repeat(80)}`;
    const intel = analyzeTransactionIntelligence(oversizedFacts, longPrompt);
    const exp = buildFallbackExplanation(oversizedFacts, intel, longPrompt);
    assertValidSchema(exp, "OVERSIZED_BOUNDED");
});

test("10. Contradictory, missing, and malformed inputs degrade safely without throwing", () => {
    for (const badFacts of [null, undefined, [], "invalid", 123, {}]) {
        for (const badIntel of [null, undefined, [], "bad", {}]) {
            const exp = buildFallbackExplanation(badFacts, badIntel, null);
            assertValidSchema(exp, `MALFORMED_${String(badFacts)}`);
            assert.ok(/do not establish|unknown|incomplete/i.test(`${exp.headline} ${exp.summary}`));
            assertDoesNotAdviseCapture(exp, "MALFORMED");
        }
    }
});

test("11. Input verifiedFacts and intelligence objects are never mutated", () => {
    function deepFreeze(obj) {
        if (obj && typeof obj === "object") {
            Object.freeze(obj);
            for (const value of Object.values(obj)) {
                deepFreeze(value);
            }
        }
        return obj;
    }

    const facts = deepFreeze({
        id: "SYNTH-FREEZE-11",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "35.00", currency: "USD" },
        purchaseUnits: [
            {
                referenceId: "PU-11",
                amount: { value: "35.00", currency: "USD" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-11",
                            status: "COMPLETED",
                            amount: { value: "35.00", currency: "USD" }
                        }
                    ]
                }
            }
        ]
    });

    const intelligence = deepFreeze(analyzeTransactionIntelligence(facts, "What happened?"));
    const factsSnapshot = JSON.stringify(facts);
    const intelSnapshot = JSON.stringify(intelligence);

    const exp = (() => {
        "use strict";
        return buildFallbackExplanation(facts, intelligence, "What happened?");
    })();

    assert.equal(JSON.stringify(facts), factsSnapshot);
    assert.equal(JSON.stringify(intelligence), intelSnapshot);
    assertValidSchema(exp, "FREEZE_IMMUTABLE");
});

test("12. Explicit no-bank-debit and no-final-settlement language is present across completed, pending, and refunded outcomes", () => {
    const completedFacts = {
        id: "SYNTH-SETTLE-12A",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [{ id: "C-12A", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
    };
    const pendingFacts = {
        id: "SYNTH-SETTLE-12B",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [{ id: "C-12B", status: "PENDING", amount: { value: "50.00", currency: "USD" } }]
    };
    const refundedFacts = {
        id: "SYNTH-SETTLE-12C",
        status: "COMPLETED",
        intent: "CAPTURE",
        amount: { value: "50.00", currency: "USD" },
        captures: [{ id: "C-12C", status: "REFUNDED", amount: { value: "50.00", currency: "USD" } }],
        refunds: [{ id: "R-12C", status: "COMPLETED", amount: { value: "50.00", currency: "USD" } }]
    };

    for (const [label, facts] of [
        ["COMPLETED", completedFacts],
        ["PENDING", pendingFacts],
        ["REFUNDED", refundedFacts]
    ]) {
        const exp = buildFallbackExplanation(facts, analyzeTransactionIntelligence(facts, "Did money leave the bank?"), "Did money leave the bank?");
        assertValidSchema(exp, label);
        const allText = `${exp.headline} ${exp.summary} ${exp.financialImpact} ${exp.limitations.join(" ")}`;
        assert.ok(/not verified|never prove|cannot verify/i.test(allText), `${label}: must explicitly disclaim bank debit/settlement verification`);
        assert.ok(/bank.*settlement|bank\/card/i.test(allText), `${label}: must explicitly mention bank debit or final bank settlement`);
    }
});
