const test = require("node:test");
const assert = require("node:assert/strict");

const { extractVerifiedPayPalFacts } = require("../lib/paypalFacts");
const {
    LIFECYCLE_STAGES,
    analyzeTransactionIntelligence
} = require("../lib/transactionIntelligence");

test("1. Normal completed CAPTURE order extracts exact facts and integrates with intelligence analysis", () => {
    const paypalResponse = {
        id: "SYNTH-PP-ORDER-01",
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-10T10:00:00Z",
        update_time: "2026-04-10T10:01:00Z",
        purchase_units: [
            {
                reference_id: "default",
                amount: {
                    currency_code: "USD",
                    value: "49.99"
                },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-PP-CAP-01",
                            status: "COMPLETED",
                            final_capture: true,
                            amount: {
                                currency_code: "USD",
                                value: "49.99"
                            },
                            seller_receivable_breakdown: {
                                gross_amount: { currency_code: "USD", value: "49.99" },
                                paypal_fee: { currency_code: "USD", value: "2.24" },
                                net_amount: { currency_code: "USD", value: "47.75" }
                            },
                            create_time: "2026-04-10T10:00:55Z",
                            update_time: "2026-04-10T10:01:00Z"
                        }
                    ]
                }
            }
        ]
    };

    const facts = extractVerifiedPayPalFacts(paypalResponse);
    assert.equal(facts.id, "SYNTH-PP-ORDER-01");
    assert.equal(facts.status, "COMPLETED");
    assert.equal(facts.intent, "CAPTURE");
    assert.deepEqual(facts.amount, { value: "49.99", currency: "USD" });
    assert.equal(facts.createTime, "2026-04-10T10:00:00Z");
    assert.equal(facts.updateTime, "2026-04-10T10:01:00Z");
    assert.equal(facts.purchaseUnits.length, 1);
    assert.equal(facts.purchaseUnits[0].referenceId, "default");
    assert.equal(facts.purchaseUnits[0].payments.captures.length, 1);
    assert.equal(facts.purchaseUnits[0].payments.captures[0].finalCapture, true);

    const analysis = analyzeTransactionIntelligence(facts);
    assert.equal(analysis.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_COMPLETED);
    assert.equal(analysis.fundsCaptured, true);
    assert.equal(analysis.bankSettlementVerified, false);
    assert.equal(analysis.hasBreakdown, true);
});

test("2. APPROVED order with no captures preserves APPROVED state and classifies as not captured", () => {
    const approvedOrder = {
        id: "SYNTH-PP-ORDER-02",
        status: "APPROVED",
        intent: "CAPTURE",
        create_time: "2026-04-10T11:00:00Z",
        update_time: "2026-04-10T11:02:00Z",
        purchase_units: [
            {
                reference_id: "PU-APPROVED-02",
                amount: { currency_code: "USD", value: "75.00" }
            }
        ]
    };

    const facts = extractVerifiedPayPalFacts(approvedOrder);
    assert.equal(facts.status, "APPROVED");
    assert.deepEqual(facts.amount, { value: "75.00", currency: "USD" });
    assert.deepEqual(facts.purchaseUnits[0].payments, {
        authorizations: [],
        captures: [],
        refunds: []
    });

    const analysis = analyzeTransactionIntelligence(facts);
    assert.equal(analysis.lifecycleStage, LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED);
    assert.equal(analysis.fundsCaptured, false);
    assert.equal(analysis.actionRequiredBy, "merchant");
});

test("3. AUTHORIZE order extracts authorization records cleanly without inventing captures", () => {
    const authorizeOrder = {
        id: "SYNTH-PP-ORDER-03",
        status: "APPROVED",
        intent: "AUTHORIZE",
        create_time: "2026-04-10T12:00:00Z",
        update_time: "2026-04-10T12:03:00Z",
        purchase_units: [
            {
                reference_id: "PU-AUTH-03",
                amount: { currency_code: "USD", value: "120.00" },
                payments: {
                    authorizations: [
                        {
                            id: "SYNTH-PP-AUTH-03",
                            status: "AUTHORIZED",
                            amount: { currency_code: "USD", value: "120.00" },
                            expiration_time: "2026-05-09T12:03:00Z",
                            status_details: { reason: "PENDING_REVIEW" },
                            create_time: "2026-04-10T12:02:30Z",
                            update_time: "2026-04-10T12:03:00Z"
                        }
                    ]
                }
            }
        ]
    };

    const facts = extractVerifiedPayPalFacts(authorizeOrder);
    assert.equal(facts.intent, "AUTHORIZE");
    assert.equal(facts.purchaseUnits[0].payments.authorizations.length, 1);
    assert.deepEqual(facts.purchaseUnits[0].payments.authorizations[0], {
        id: "SYNTH-PP-AUTH-03",
        status: "AUTHORIZED",
        amount: { value: "120.00", currency: "USD" },
        statusDetailsReason: "PENDING_REVIEW",
        expirationTime: "2026-05-09T12:03:00Z",
        createTime: "2026-04-10T12:02:30Z",
        updateTime: "2026-04-10T12:03:00Z"
    });
    assert.equal(facts.purchaseUnits[0].payments.captures.length, 0);

    const analysis = analyzeTransactionIntelligence(facts);
    assert.equal(analysis.lifecycleStage, LIFECYCLE_STAGES.AUTHORIZED_NOT_CAPTURED);
    assert.equal(analysis.fundsCaptured, false);
    assert.equal(analysis.authorizationSummary.authorized, 1);
});

test("4. Multiple purchase units extract all units and refuse cross-currency order total summing", () => {
    const sameCurrencyMultiUnit = {
        id: "SYNTH-PP-MULTI-04A",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
            {
                reference_id: "PU-1",
                amount: { currency_code: "USD", value: "19.99" },
                payments: {
                    captures: [
                        { id: "SYNTH-CAP-04A-1", status: "COMPLETED", amount: { currency_code: "USD", value: "19.99" } }
                    ]
                }
            },
            {
                reference_id: "PU-2",
                amount: { currency_code: "USD", value: "0.01" },
                payments: {
                    captures: [
                        { id: "SYNTH-CAP-04A-2", status: "PENDING", amount: { currency_code: "USD", value: "0.01" } }
                    ]
                }
            }
        ]
    };

    const sameFacts = extractVerifiedPayPalFacts(sameCurrencyMultiUnit);
    assert.equal(sameFacts.purchaseUnits.length, 2);
    assert.equal(sameFacts.purchaseUnits[0].referenceId, "PU-1");
    assert.equal(sameFacts.purchaseUnits[1].referenceId, "PU-2");
    assert.equal(sameFacts.purchaseUnits[1].payments.captures[0].status, "PENDING");
    assert.deepEqual(sameFacts.amount, { value: "20.00", currency: "USD" });

    const mixedCurrencyMultiUnit = {
        id: "SYNTH-PP-MULTI-04B",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
            { reference_id: "PU-USD", amount: { currency_code: "USD", value: "10.00" } },
            { reference_id: "PU-EUR", amount: { currency_code: "EUR", value: "15.00" } }
        ]
    };

    const mixedFacts = extractVerifiedPayPalFacts(mixedCurrencyMultiUnit);
    assert.equal(mixedFacts.purchaseUnits.length, 2);
    assert.equal(mixedFacts.amount, null);
    assert.deepEqual(mixedFacts.purchaseUnits[0].amount, { value: "10.00", currency: "USD" });
    assert.deepEqual(mixedFacts.purchaseUnits[1].amount, { value: "15.00", currency: "EUR" });
});

test("5. Multiple captures with mixed statuses and status_details reasons are preserved accurately", () => {
    const mixedCapturesOrder = {
        id: "SYNTH-PP-MIXCAP-05",
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-11T08:00:00Z",
        update_time: "2026-04-11T08:10:00Z",
        purchase_units: [
            {
                reference_id: "PU-MIX",
                amount: { currency_code: "USD", value: "100.00" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-05-1",
                            status: "COMPLETED",
                            final_capture: false,
                            amount: { currency_code: "USD", value: "60.00" }
                        },
                        {
                            id: "SYNTH-CAP-05-2",
                            status: "PENDING",
                            status_details: { reason: "ECHECK" },
                            final_capture: true,
                            amount: { currency_code: "USD", value: "40.00" }
                        }
                    ]
                }
            }
        ]
    };

    const facts = extractVerifiedPayPalFacts(mixedCapturesOrder);
    const extractedCaptures = facts.purchaseUnits[0].payments.captures;
    assert.equal(extractedCaptures.length, 2);
    assert.equal(extractedCaptures[0].status, "COMPLETED");
    assert.equal(extractedCaptures[1].status, "PENDING");
    assert.equal(extractedCaptures[1].statusDetailsReason, "ECHECK");

    const analysis = analyzeTransactionIntelligence(facts);
    assert.equal(analysis.lifecycleStage, LIFECYCLE_STAGES.CAPTURED_PENDING);
    assert.equal(analysis.fundsCaptured, "pending");
    assert.equal(analysis.captureSummary.completed, 1);
    assert.equal(analysis.captureSummary.pending, 1);
});

test("6. Explicit completed, pending, and failed refunds are extracted cleanly", () => {
    const orderWithRefunds = {
        id: "SYNTH-PP-REF-06",
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-12T09:00:00Z",
        update_time: "2026-04-12T10:00:00Z",
        purchase_units: [
            {
                amount: { currency_code: "USD", value: "100.00" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-06",
                            status: "PARTIALLY_REFUNDED",
                            amount: { currency_code: "USD", value: "100.00" }
                        }
                    ],
                    refunds: [
                        {
                            id: "SYNTH-REF-06-DONE",
                            status: "COMPLETED",
                            amount: { currency_code: "USD", value: "30.00" },
                            create_time: "2026-04-12T09:15:00Z",
                            update_time: "2026-04-12T09:20:00Z"
                        },
                        {
                            id: "SYNTH-REF-06-PEND",
                            status: "PENDING",
                            status_details: { reason: "ECHECK" },
                            amount: { currency_code: "USD", value: "20.00" }
                        },
                        {
                            id: "SYNTH-REF-06-FAIL",
                            status: "FAILED",
                            amount: { currency_code: "USD", value: "50.00" }
                        }
                    ]
                }
            }
        ]
    };

    const facts = extractVerifiedPayPalFacts(orderWithRefunds);
    const extractedRefunds = facts.purchaseUnits[0].payments.refunds;
    assert.equal(extractedRefunds.length, 3);
    assert.equal(extractedRefunds[0].status, "COMPLETED");
    assert.equal(extractedRefunds[1].statusDetailsReason, "ECHECK");
    assert.equal(extractedRefunds[2].status, "FAILED");

    const analysis = analyzeTransactionIntelligence(facts);
    assert.equal(analysis.lifecycleStage, LIFECYCLE_STAGES.REFUNDED_OR_PARTIAL);
    assert.equal(analysis.refundSummary.completed, 1);
    assert.equal(analysis.refundSummary.pending, 1);
    assert.equal(analysis.refundSummary.failedOrCancelled, 1);
    assert.equal(analysis.refundSummary.refundScope, "pending");
});

test("7. Seller receivable breakdown preserves present figures and stays null when missing", () => {
    const withBreakdown = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-BD-07A",
        status: "COMPLETED",
        purchase_units: [
            {
                amount: { currency_code: "USD", value: "25.00" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-07A",
                            status: "COMPLETED",
                            amount: { currency_code: "USD", value: "25.00" },
                            seller_receivable_breakdown: {
                                gross_amount: { currency_code: "USD", value: "25.00" },
                                paypal_fee: { currency_code: "USD", value: "1.37" },
                                net_amount: { currency_code: "USD", value: "23.63" }
                            }
                        }
                    ]
                }
            }
        ]
    });

    assert.deepEqual(withBreakdown.purchaseUnits[0].payments.captures[0].sellerReceivableBreakdown, {
        grossAmount: { value: "25.00", currency: "USD" },
        paypalFee: { value: "1.37", currency: "USD" },
        netAmount: { value: "23.63", currency: "USD" }
    });

    const withoutBreakdown = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-BD-07B",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
            {
                amount: { currency_code: "USD", value: "10.00" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-07B",
                            status: "COMPLETED",
                            amount: { currency_code: "USD", value: "10.00" }
                        }
                    ]
                }
            }
        ]
    });

    assert.equal(withoutBreakdown.purchaseUnits[0].payments.captures[0].sellerReceivableBreakdown, null);
    const analysis = analyzeTransactionIntelligence(withoutBreakdown);
    assert.equal(analysis.hasBreakdown, false);
    assert.equal(analysis.bankSettlementVerified, false);
});

test("8. Missing optional PayPal fields stay null or empty without invention", () => {
    const minimalOrder = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-MIN-08",
        status: "CREATED",
        purchase_units: [{}]
    });

    assert.equal(minimalOrder.id, "SYNTH-PP-MIN-08");
    assert.equal(minimalOrder.status, "CREATED");
    assert.equal(minimalOrder.intent, null);
    assert.equal(minimalOrder.amount, null);
    assert.equal(minimalOrder.createTime, null);
    assert.equal(minimalOrder.updateTime, null);
    assert.deepEqual(minimalOrder.purchaseUnits, [
        {
            referenceId: null,
            amount: null,
            payments: {
                authorizations: [],
                captures: [],
                refunds: []
            }
        }
    ]);
});

test("9. Buyer/merchant PII, tokens, shipping addresses, and raw HATEOAS links are excluded", () => {
    const orderWithSensitiveData = {
        id: "SYNTH-PP-PII-09",
        status: "COMPLETED",
        intent: "CAPTURE",
        access_token: "SYNTH_SECRET_TOKEN_DO_NOT_LEAK",
        payer: {
            email_address: "synthetic-buyer@example.invalid",
            payer_id: "SYNTHPAYER99",
            name: { given_name: "Secret", surname: "Buyer" },
            address: { address_line_1: "123 Hidden Ave", postal_code: "90210" }
        },
        payment_source: {
            paypal: {
                email_address: "synthetic-wallet@example.invalid",
                account_id: "SYNTHACCT99"
            }
        },
        purchase_units: [
            {
                reference_id: "PU-SAFE-09",
                description: "Contains buyer@example.invalid free text",
                amount: { currency_code: "USD", value: "30.00" },
                payee: {
                    email_address: "synthetic-merchant@example.invalid",
                    merchant_id: "SYNTHMERCH99"
                },
                shipping: {
                    name: { full_name: "Private Recipient" },
                    address: { address_line_1: "456 Private Blvd" }
                },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-09",
                            status: "COMPLETED",
                            amount: { currency_code: "USD", value: "30.00" },
                            links: [
                                {
                                    href: "https://api-m.sandbox.paypal.com/v2/payments/captures/SYNTH-CAP-09/refund",
                                    rel: "refund",
                                    method: "POST"
                                }
                            ]
                        }
                    ]
                }
            }
        ],
        links: [
            {
                href: "https://www.sandbox.paypal.com/checkoutnow?token=SYNTH-PP-PII-09",
                rel: "approve",
                method: "GET"
            }
        ]
    };

    const facts = extractVerifiedPayPalFacts(orderWithSensitiveData);
    const serialized = JSON.stringify(facts);

    for (const forbidden of [
        "synthetic-buyer@example.invalid",
        "SYNTHPAYER99",
        "123 Hidden Ave",
        "synthetic-wallet@example.invalid",
        "SYNTHACCT99",
        "synthetic-merchant@example.invalid",
        "SYNTHMERCH99",
        "Private Recipient",
        "456 Private Blvd",
        "buyer@example.invalid",
        "SYNTH_SECRET_TOKEN_DO_NOT_LEAK",
        "sandbox.paypal.com",
        "links",
        "payee",
        "payer",
        "shipping"
    ]) {
        assert.ok(!serialized.includes(forbidden), `Extracted facts must exclude ${forbidden}`);
    }
});

test("10. Malformed inputs return safe results and valid input objects are never mutated", () => {
    for (const badInput of [null, undefined, [], "SYNTH", 42, true]) {
        assert.equal(extractVerifiedPayPalFacts(badInput), null);
    }

    const malformedFields = extractVerifiedPayPalFacts({
        id: "  SYNTH-PP-MAL-10  ",
        status: "",
        purchase_units: [
            null,
            "bad-unit",
            {
                reference_id: "PU-MAL",
                amount: { currency_code: "USD", value: "-5.00" },
                payments: {
                    captures: [
                        null,
                        { id: "SYNTH-CAP-NAN", status: "COMPLETED", amount: { currency_code: "USD", value: "1e5" } }
                    ],
                    refunds: "not-an-array"
                }
            }
        ]
    });

    assert.equal(malformedFields.id, "SYNTH-PP-MAL-10");
    assert.equal(malformedFields.status, null);
    assert.equal(malformedFields.amount, null);
    assert.equal(malformedFields.purchaseUnits.length, 1);
    assert.equal(malformedFields.purchaseUnits[0].amount, null);
    assert.equal(malformedFields.purchaseUnits[0].payments.captures[0].amount, null);
    assert.deepEqual(malformedFields.purchaseUnits[0].payments.refunds, []);

    function deepFreeze(obj) {
        if (obj && typeof obj === "object") {
            Object.freeze(obj);
            for (const val of Object.values(obj)) {
                deepFreeze(val);
            }
        }
        return obj;
    }

    const frozenOrder = deepFreeze({
        id: "SYNTH-PP-FREEZE-10",
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-12T11:00:00Z",
        update_time: "2026-04-12T11:05:00Z",
        purchase_units: [
            {
                reference_id: "PU-FREEZE",
                amount: { currency_code: "USD", value: "15.00" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-FREEZE",
                            status: "COMPLETED",
                            amount: { currency_code: "USD", value: "15.00" }
                        }
                    ]
                }
            }
        ]
    });

    const beforeSnapshot = JSON.stringify(frozenOrder);
    const extracted = (() => {
        "use strict";
        return extractVerifiedPayPalFacts(frozenOrder);
    })();

    assert.equal(JSON.stringify(frozenOrder), beforeSnapshot);
    assert.equal(extracted.id, "SYNTH-PP-FREEZE-10");
});

test("11. EUR and JPY amounts preserve exact currency codes and values without USD fallback or conversion", () => {
    const eurFacts = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-EUR-11",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
            {
                amount: { currency_code: "EUR", value: "42.50" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-EUR-11",
                            status: "COMPLETED",
                            amount: { currency_code: "EUR", value: "42.50" },
                            seller_receivable_breakdown: {
                                gross_amount: { currency_code: "EUR", value: "42.50" },
                                paypal_fee: { currency_code: "EUR", value: "1.80" },
                                net_amount: { currency_code: "EUR", value: "40.70" }
                            }
                        }
                    ]
                }
            }
        ]
    });

    assert.deepEqual(eurFacts.amount, { value: "42.50", currency: "EUR" });
    assert.deepEqual(eurFacts.purchaseUnits[0].payments.captures[0].sellerReceivableBreakdown.netAmount, {
        value: "40.70",
        currency: "EUR"
    });
    const eurIntel = analyzeTransactionIntelligence(eurFacts);
    assert.ok(eurIntel.factualHighlights.some(h => h.includes("42.50 EUR")));
    assert.ok(!eurIntel.factualHighlights.some(h => h.includes("USD")));

    const jpyFacts = extractVerifiedPayPalFacts({
        id: "SYNTH-PP-JPY-11",
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
            {
                amount: { currency_code: "JPY", value: "13000" },
                payments: {
                    captures: [
                        {
                            id: "SYNTH-CAP-JPY-11",
                            status: "COMPLETED",
                            amount: { currency_code: "JPY", value: "13000" }
                        }
                    ]
                }
            }
        ]
    });

    assert.deepEqual(jpyFacts.amount, { value: "13000", currency: "JPY" });
    const jpyIntel = analyzeTransactionIntelligence(jpyFacts);
    assert.ok(jpyIntel.factualHighlights.some(h => h.includes("13000 JPY")));
    assert.ok(!jpyIntel.factualHighlights.some(h => h.includes("USD")));
});
