"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { PassThrough } = require("node:stream");

const { app, isValidCopilotExplanation } = require("../index");

function createMockFetchResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    };
}

function invokeApp(method, routePath, body = null) {
    return new Promise((resolve, reject) => {
        const socket = new PassThrough();
        socket.remoteAddress = "127.0.0.1";
        socket.encrypted = false;

        const req = new http.IncomingMessage(socket);
        req.method = method.toUpperCase();
        req.url = routePath;

        const payload = body !== null ? Buffer.from(JSON.stringify(body), "utf8") : null;
        req.headers = { host: "localhost:5000" };
        if (payload !== null) {
            req.headers["content-type"] = "application/json";
            req.headers["content-length"] = String(payload.length);
        }

        const res = new http.ServerResponse(req);
        const chunks = [];
        let settled = false;
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);

        res.write = function (chunk, encoding, cb) {
            if (chunk) {
                chunks.push(
                    Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8")
                );
            }
            return origWrite(chunk, encoding, cb);
        };

        res.end = function (chunk, encoding, cb) {
            if (chunk) {
                chunks.push(
                    Buffer.isBuffer(chunk)
                        ? chunk
                        : Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8")
                );
            }
            const out = origEnd(chunk, encoding, cb);
            if (!settled) {
                settled = true;
                const text = Buffer.concat(chunks).toString("utf8");
                let parsed = null;
                try {
                    parsed = text ? JSON.parse(text) : null;
                } catch {
                    parsed = text;
                }
                resolve({ status: res.statusCode, body: parsed });
            }
            return out;
        };

        res.on("error", (err) => {
            if (!settled) {
                settled = true;
                reject(err);
            }
        });

        try {
            app(req, res);
            process.nextTick(() => {
                if (payload !== null) {
                    req.push(payload);
                }
                req.push(null);
            });
        } catch (err) {
            if (!settled) {
                settled = true;
                reject(err);
            }
        }
    });
}

function createCompletedOrderPayload(orderId = "ORDER9001TEST") {
    return {
        id: orderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        create_time: "2026-04-01T10:00:00Z",
        update_time: "2026-04-01T10:02:00Z",
        purchase_units: [
            {
                reference_id: "default",
                description: "Clarity Copilot Unit",
                amount: {
                    currency_code: "USD",
                    value: "49.99"
                },
                payments: {
                    captures: [
                        {
                            id: "CAP9001TEST",
                            status: "COMPLETED",
                            final_capture: true,
                            amount: {
                                currency_code: "USD",
                                value: "49.99"
                            },
                            seller_receivable_breakdown: {
                                gross_amount: { currency_code: "USD", value: "49.99" },
                                paypal_fee: { currency_code: "USD", value: "1.75" },
                                net_amount: { currency_code: "USD", value: "48.24" }
                            },
                            create_time: "2026-04-01T10:01:30Z",
                            update_time: "2026-04-01T10:02:00Z"
                        }
                    ]
                }
            }
        ]
    };
}

function createValidGeminiJson(overrides = {}) {
    return JSON.stringify({
        headline: "PayPal order ORDER9001TEST capture is COMPLETED for 49.99 USD.",
        summary: "PayPal confirmed capture completion for order ORDER9001TEST. Deterministic records show 49.99 USD gross with 1.75 USD fee and 48.24 USD net.",
        financialImpact: "Funds were captured inside PayPal for 49.99 USD, while final buyer bank debit or bank settlement timing cannot be confirmed from Orders v2 alone.",
        safeNextSteps: [
            "Confirm whether matching settlement details appear in PayPal Merchant Payout reports.",
            "Keep capture ID CAP9001TEST for accounting reconciliation."
        ],
        limitations: [
            "PayPal capture COMPLETED does not independently prove final bank settlement.",
            "Buyer card or bank debit timing cannot be verified solely through Orders v2."
        ],
        ...overrides
    });
}

test.describe("Hybrid Copilot Route Integration (POST /api/copilot/explain & PayPal boundaries)", () => {
    const originalFetch = globalThis.fetch;
    const savedEnv = {};

    const ENV_KEYS = [
        "GEMINI_API_KEY",
        "GEMINI_MODEL",
        "GEMINI_TIMEOUT_MS",
        "PAYPAL_CLIENT_ID",
        "PAYPAL_CLIENT_SECRET"
    ];

    function setBaselineTestEnv() {
        process.env.PAYPAL_CLIENT_ID = "test-paypal-client-id";
        process.env.PAYPAL_CLIENT_SECRET = "test-paypal-client-secret";
        process.env.GEMINI_API_KEY = "test-gemini-api-key";
        process.env.GEMINI_MODEL = "gemini-3.8-flash";
        process.env.GEMINI_TIMEOUT_MS = "5000";
    }

    function installPayPalFetchStub(orderResponder) {
        const calls = [];
        globalThis.fetch = async (url, options = {}) => {
            const href = String(url);
            const method = (options.method || "GET").toUpperCase();
            calls.push({ url: href, method, headers: options.headers || {} });

            if (href.endsWith("/v1/oauth2/token")) {
                return createMockFetchResponse(200, {
                    access_token: "OAUTH_ACCESS_TOKEN_SENTINEL",
                    token_type: "Bearer",
                    expires_in: 3600
                });
            }

            if (href.includes("/v2/checkout/orders/")) {
                return orderResponder(href, options);
            }

            throw new Error(`Unexpected outbound fetch URL during test: ${method} ${href}`);
        };
        return calls;
    }

    test.before(() => {
        for (const key of ENV_KEYS) {
            savedEnv[key] = process.env[key];
        }
        setBaselineTestEnv();
    });

    test.afterEach(() => {
        app.locals.copilotDeps = undefined;
        globalThis.fetch = originalFetch;
        setBaselineTestEnv();
    });

    test.after(() => {
        globalThis.fetch = originalFetch;
        for (const key of ENV_KEYS) {
            if (savedEnv[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = savedEnv[key];
            }
        }
    });

    test("1. Gemini success returns explanationSource 'gemini' with verifiedFacts and intelligence", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDER9001TEST")));

        let receivedModel = null;
        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async (params) => {
                        receivedModel = params.model;
                        return { text: createValidGeminiJson() };
                    }
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDER9001TEST",
            prompt: "Did PayPal capture this payment and what are the fees?"
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.explanationSource, "gemini");
        assert.equal(res.body.isAiGenerated, true);
        assert.equal(res.body.aiFallbackUsed, false);
        assert.equal(res.body.model, "gemini-3.8-flash");
        assert.equal(receivedModel, "gemini-3.8-flash");
        assert.equal("aiError" in res.body, false);

        assert.equal(res.body.verifiedFacts.id, "ORDER9001TEST");
        assert.equal(res.body.verifiedFacts.orderId, "ORDER9001TEST");
        assert.equal(res.body.verifiedFacts.status, "COMPLETED");
        assert.equal(res.body.verifiedFacts.capture.id, "CAP9001TEST");
        assert.equal(res.body.verifiedFacts.purchaseUnits.length, 1);

        assert.equal(res.body.intelligence.lifecycleStage, "CAPTURED_COMPLETED");
        assert.equal(res.body.intelligence.fundsCaptured, true);
        assert.equal(res.body.intelligence.bankSettlementVerified, false);
        assert.equal(res.body.intelligence.hasBreakdown, true);
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });

    test("2. Gemini 429 quota/rate-limit error falls back deterministically with HTTP 200 and sanitized aiError", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDER429TEST")));

        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async () => {
                        const err = new Error("RESOURCE_EXHAUSTED quota exceeded for key AIzaSySecretKey1234567890");
                        err.status = 429;
                        throw err;
                    }
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDER429TEST",
            prompt: "Explain why payment status is completed."
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.isAiGenerated, false);
        assert.equal(res.body.aiFallbackUsed, true);
        assert.equal(res.body.model, null);
        assert.equal(res.body.aiError.code, "GEMINI_RATE_LIMIT");
        assert.match(res.body.aiError.message, /quota|rate limit/i);
        assert.doesNotMatch(JSON.stringify(res.body.aiError), /AIza|RESOURCE_EXHAUSTED/);
        assert.equal(res.body.intelligence.lifecycleStage, "CAPTURED_COMPLETED");
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });

    test("3. Gemini timeout triggers deterministic fallback cleanly", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDERTIMEOUT1")));

        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async () => {
                        const err = new Error("Request aborted due to timeout against https://internal-gemini.example");
                        err.name = "TimeoutError";
                        throw err;
                    }
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERTIMEOUT1",
            prompt: "Was money settled?"
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.isAiGenerated, false);
        assert.equal(res.body.aiFallbackUsed, true);
        assert.equal(res.body.model, null);
        assert.equal(res.body.aiError.code, "GEMINI_TIMEOUT");
        assert.doesNotMatch(JSON.stringify(res.body.aiError), /internal-gemini\.example/);
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });

    test("4a. Gemini malformed JSON triggers deterministic fallback", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDERBADJSON1")));

        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async () => ({ text: "{ not valid json :::" })
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERBADJSON1",
            prompt: "What happened to this order?"
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.isAiGenerated, false);
        assert.equal(res.body.aiFallbackUsed, true);
        assert.equal(res.body.model, null);
        assert.equal(res.body.aiError.code, "AI_INVALID_RESPONSE");
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });

    test("4b. Gemini schema failure triggers deterministic fallback", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDERBADSCHEMA1")));

        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async () => ({
                        text: JSON.stringify({
                            headline: "Missing other arrays",
                            summary: "Ok",
                            financialImpact: "Ok",
                            safeNextSteps: [],
                            limitations: []
                        })
                    })
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERBADSCHEMA1",
            prompt: "What should we do next?"
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.isAiGenerated, false);
        assert.equal(res.body.aiFallbackUsed, true);
        assert.equal(res.body.model, null);
        assert.equal(res.body.aiError.code, "AI_SCHEMA_VALIDATION_FAILED");
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });

    test("5. Gemini unexpected error triggers fallback without leaking raw SDK details, URLs, keys, or stack traces", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDERUNEXP1")));

        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async () => {
                        const err = new Error(
                            "ECONNRESET https://generativelanguage.googleapis.com/v1beta/secret?key=AIzaSyLeakyKey999 Bearer RAW_TOKEN_XYZ\n    at secretFn (/app/server/secret.js:42)"
                        );
                        throw err;
                    }
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERUNEXP1",
            prompt: "Summarize this order."
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.isAiGenerated, false);
        assert.equal(res.body.aiFallbackUsed, true);
        assert.equal(res.body.model, null);
        assert.equal(res.body.aiError.code, "GEMINI_REQUEST_FAILED");

        const serializedError = JSON.stringify(res.body.aiError);
        assert.doesNotMatch(serializedError, /ECONNRESET|generativelanguage|AIza|RAW_TOKEN_XYZ|secretFn|\/app\/server/);
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });

    test("6. PayPal 404 preserves HTTP 404 error and never invokes Gemini or deterministic fallback", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(404, { name: "RESOURCE_NOT_FOUND" }));

        let geminiCalled = false;
        let fallbackCalled = false;
        app.locals.copilotDeps = {
            createGeminiClient: () => {
                geminiCalled = true;
                throw new Error("Should not call Gemini on PayPal 404");
            },
            buildFallback: () => {
                fallbackCalled = true;
                throw new Error("Should not call fallback on PayPal 404");
            }
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "MISSINGORDER404",
            prompt: "Explain this missing order."
        });

        assert.equal(res.status, 404);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, "PAYPAL_ORDER_NOT_FOUND");
        assert.equal(res.body.explanation, undefined);
        assert.equal(geminiCalled, false);
        assert.equal(fallbackCalled, false);
    });

    test("7. PayPal timeout preserves HTTP 504 error and never invokes Gemini or deterministic fallback", async () => {
        installPayPalFetchStub(() => {
            const timeoutErr = new Error("The operation was aborted due to timeout");
            timeoutErr.name = "TimeoutError";
            throw timeoutErr;
        });

        let geminiCalled = false;
        let fallbackCalled = false;
        app.locals.copilotDeps = {
            createGeminiClient: () => {
                geminiCalled = true;
                throw new Error("Should not call Gemini on PayPal timeout");
            },
            buildFallback: () => {
                fallbackCalled = true;
                throw new Error("Should not call fallback on PayPal timeout");
            }
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERTIMEOUT504",
            prompt: "Explain this order."
        });

        assert.equal(res.status, 504);
        assert.equal(res.body.success, false);
        assert.equal(res.body.code, "PAYPAL_TIMEOUT");
        assert.equal(res.body.explanation, undefined);
        assert.equal(geminiCalled, false);
        assert.equal(fallbackCalled, false);
    });

    test("8. Missing GEMINI_API_KEY uses deterministic fallback with HTTP 200 and GEMINI_NOT_CONFIGURED aiError", async () => {
        process.env.GEMINI_API_KEY = "";
        installPayPalFetchStub(() => createMockFetchResponse(200, {
            id: "ORDERAPPROVED1",
            status: "APPROVED",
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: "default",
                    amount: { currency_code: "EUR", value: "25.00" }
                }
            ]
        }));

        let geminiClientCreated = false;
        app.locals.copilotDeps = {
            createGeminiClient: () => {
                geminiClientCreated = true;
                throw new Error("Should not instantiate Gemini client when key is missing");
            }
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERAPPROVED1",
            prompt: "Was this payment already captured?"
        });

        assert.equal(res.status, 200);
        assert.equal(geminiClientCreated, false);
        assert.equal(res.body.success, true);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.isAiGenerated, false);
        assert.equal(res.body.aiFallbackUsed, true);
        assert.equal(res.body.model, null);
        assert.equal(res.body.aiError.code, "GEMINI_NOT_CONFIGURED");
        assert.equal(res.body.intelligence.lifecycleStage, "AUTHORIZED_NOT_CAPTURED");
        assert.equal(res.body.intelligence.fundsCaptured, false);
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
        assert.match(res.body.explanation.headline, /not captured/i);
    });

    test("9. Fallback failure (throw or invalid fallback schema) returns safe HTTP 500 without fabricated explanation", async () => {
        process.env.GEMINI_API_KEY = "";
        installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDERFBFAIL1")));

        app.locals.copilotDeps = {
            buildFallback: () => {
                throw new Error("SECRET_INTERNAL_STACK https://private-internal-service.local token_999");
            }
        };

        const thrownRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERFBFAIL1",
            prompt: "Explain status."
        });

        assert.equal(thrownRes.status, 500);
        assert.equal(thrownRes.body.success, false);
        assert.equal(thrownRes.body.code, "FALLBACK_EXPLANATION_FAILED");
        assert.equal(thrownRes.body.explanation, undefined);
        assert.doesNotMatch(JSON.stringify(thrownRes.body), /SECRET_INTERNAL_STACK|private-internal-service|token_999/);

        app.locals.copilotDeps = {
            buildFallback: () => ({
                headline: "",
                summary: "Invalid",
                financialImpact: "Invalid",
                safeNextSteps: [],
                limitations: []
            })
        };

        const invalidRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERFBFAIL1",
            prompt: "Explain status."
        });

        assert.equal(invalidRes.status, 500);
        assert.equal(invalidRes.body.success, false);
        assert.equal(invalidRes.body.code, "FALLBACK_SCHEMA_INVALID");
        assert.equal(invalidRes.body.explanation, undefined);
    });

    test("10. No PII, HATEOAS links, OAuth tokens, merchant IDs, or raw PayPal response enter Gemini prompt", async () => {
        const sensitiveOrderPayload = {
            id: "ORDERPRIVACY1",
            status: "COMPLETED",
            intent: "CAPTURE",
            payer: {
                email_address: "buyer-secret-pii@example.org",
                payer_id: "PAYER_SECRET_ID_777",
                name: { given_name: "Alice", surname: "SecretSurname" }
            },
            payment_source: {
                paypal: {
                    email_address: "wallet-secret@example.org",
                    account_id: "WALLET_ACCT_SECRET"
                }
            },
            links: [
                {
                    href: "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDERPRIVACY1?secret_hateoas=1",
                    rel: "self",
                    method: "GET"
                }
            ],
            raw_internal_marker: "RAW_PAYPAL_RESPONSE_MARKER_987",
            purchase_units: [
                {
                    reference_id: "unit-alpha",
                    payee: {
                        email_address: "merchant-secret@example.org",
                        merchant_id: "MERCHANT_SECRET_ID_555"
                    },
                    shipping: {
                        name: { full_name: "Alice SecretSurname" },
                        address: {
                            address_line_1: "742 Secret Privacy Blvd",
                            postal_code: "94107"
                        }
                    },
                    amount: { currency_code: "USD", value: "75.00" },
                    payments: {
                        captures: [
                            {
                                id: "CAPPRIV1",
                                status: "COMPLETED",
                                amount: { currency_code: "USD", value: "75.00" },
                                links: [
                                    { href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPPRIV1", rel: "self" }
                                ]
                            }
                        ]
                    }
                }
            ]
        };

        installPayPalFetchStub(() => createMockFetchResponse(200, sensitiveOrderPayload));

        let capturedGenerateParams = null;
        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async (params) => {
                        capturedGenerateParams = params;
                        return { text: createValidGeminiJson() };
                    }
                }
            })
        };

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERPRIVACY1",
            prompt: "Verify payment status."
        });

        assert.equal(res.status, 200);
        assert.ok(capturedGenerateParams, "Gemini generateContent should have been invoked");

        const serializedPrompt = JSON.stringify(capturedGenerateParams);
        const serializedResponse = JSON.stringify(res.body);

        const forbiddenPatterns = [
            "buyer-secret-pii@example.org",
            "PAYER_SECRET_ID_777",
            "SecretSurname",
            "wallet-secret@example.org",
            "WALLET_ACCT_SECRET",
            "secret_hateoas",
            "RAW_PAYPAL_RESPONSE_MARKER_987",
            "merchant-secret@example.org",
            "MERCHANT_SECRET_ID_555",
            "742 Secret Privacy Blvd",
            "94107",
            "OAUTH_ACCESS_TOKEN_SENTINEL",
            "v2/payments/captures/CAPPRIV1"
        ];

        for (const token of forbiddenPatterns) {
            assert.equal(serializedPrompt.includes(token), false, `Forbidden token leaked into Gemini prompt: ${token}`);
            assert.equal(serializedResponse.includes(token), false, `Forbidden token leaked into API response: ${token}`);
        }

        assert.match(capturedGenerateParams.contents, /"lifecycleStage":\s*"CAPTURED_COMPLETED"/);
        assert.match(capturedGenerateParams.contents, /"fundsCaptured":\s*true/);
    });

    test("11. No PayPal write operation is called by /api/copilot/explain (and extraction null never fabricates facts)", async () => {
        const outboundCalls = installPayPalFetchStub(() => createMockFetchResponse(200, createCompletedOrderPayload("ORDERREADONLY1")));

        app.locals.copilotDeps = {
            createGeminiClient: () => ({
                models: {
                    generateContent: async () => ({ text: createValidGeminiJson() })
                }
            })
        };

        const okRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERREADONLY1",
            prompt: "Explain order status."
        });
        assert.equal(okRes.status, 200);
        assert.equal(okRes.body.explanationSource, "gemini");

        // Force deterministic fallback on second request too, checking PayPal stays read-only
        process.env.GEMINI_API_KEY = "";
        const fallbackRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERREADONLY1",
            prompt: "Explain again."
        });
        assert.equal(fallbackRes.status, 200);
        assert.equal(fallbackRes.body.explanationSource, "deterministic_rules");

        assert.ok(outboundCalls.length >= 2);
        for (const call of outboundCalls) {
            if (call.url.endsWith("/v1/oauth2/token")) {
                assert.equal(call.method, "POST");
            } else {
                assert.equal(call.method, "GET");
                assert.match(call.url, /\/v2\/checkout\/orders\/ORDERREADONLY1$/);
                assert.doesNotMatch(call.url, /\/(capture|authorize|refund|void)\b/);
            }
        }

        // Verify null extracted facts returns 502 without invoking fallback
        let fallbackCalledOnNullFacts = false;
        app.locals.copilotDeps = {
            extractFacts: () => null,
            buildFallback: () => {
                fallbackCalledOnNullFacts = true;
                throw new Error("Should not call fallback when extracted facts are null");
            }
        };

        const nullFactsRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERREADONLY1",
            prompt: "Explain status."
        });
        assert.equal(nullFactsRes.status, 502);
        assert.equal(nullFactsRes.body.success, false);
        assert.equal(nullFactsRes.body.code, "PAYPAL_INVALID_ORDER_DATA");
        assert.equal(fallbackCalledOnNullFacts, false);

        // Verify input validation remains HTTP 400
        const badIdRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "bad id!",
            prompt: "Explain"
        });
        assert.equal(badIdRes.status, 400);
        assert.equal(badIdRes.body.code, "INVALID_PAYPAL_ORDER_ID");

        const badPromptRes = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERREADONLY1",
            prompt: "   "
        });
        assert.equal(badPromptRes.status, 400);
        assert.equal(badPromptRes.body.code, "INVALID_PROMPT");
    });

    test("12. Existing routes (/api/health, /api/paypal/test, /api/paypal/orders, GET /api/paypal/orders/:id, capture, /api/gemini/test) remain intact", async () => {
        globalThis.fetch = async (url, options = {}) => {
            const href = String(url);
            const method = (options.method || "GET").toUpperCase();

            if (href.endsWith("/v1/oauth2/token") && method === "POST") {
                return createMockFetchResponse(200, {
                    access_token: "OAUTH_TEST_TOKEN",
                    token_type: "Bearer"
                });
            }

            if (href.endsWith("/v2/checkout/orders") && method === "POST") {
                return createMockFetchResponse(201, {
                    id: "CREATEDORD100",
                    status: "CREATED",
                    links: [
                        { rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=CREATEDORD100" }
                    ]
                });
            }

            if (href.endsWith("/v2/checkout/orders/CREATEDORD100") && method === "GET") {
                return createMockFetchResponse(200, createCompletedOrderPayload("CREATEDORD100"));
            }

            if (href.endsWith("/v2/checkout/orders/CREATEDORD100/capture") && method === "POST") {
                return createMockFetchResponse(201, createCompletedOrderPayload("CREATEDORD100"));
            }

            throw new Error(`Unexpected fetch in existing routes test: ${method} ${href}`);
        };

        const healthRes = await invokeApp("GET", "/api/health");
        assert.equal(healthRes.status, 200);
        assert.equal(healthRes.body.success, true);
        assert.equal(healthRes.body.environment, "Sandbox");

        const paypalTestRes = await invokeApp("GET", "/api/paypal/test");
        assert.equal(paypalTestRes.status, 200);
        assert.equal(paypalTestRes.body.success, true);
        assert.equal(paypalTestRes.body.authenticated, true);

        const createRes = await invokeApp("POST", "/api/paypal/orders", { amount: "19.95" });
        assert.equal(createRes.status, 201);
        assert.equal(createRes.body.success, true);
        assert.equal(createRes.body.orderId, "CREATEDORD100");
        assert.match(createRes.body.approvalUrl, /^https:\/\/www\.sandbox\.paypal\.com\//);

        const verifyRes = await invokeApp("GET", "/api/paypal/orders/CREATEDORD100");
        assert.equal(verifyRes.status, 200);
        assert.equal(verifyRes.body.success, true);
        assert.equal(verifyRes.body.orderId, "CREATEDORD100");
        assert.equal(verifyRes.body.isCompleted, true);
        assert.equal(verifyRes.body.capture.id, "CAP9001TEST");

        const captureRes = await invokeApp("POST", "/api/paypal/orders/CREATEDORD100/capture");
        assert.equal(captureRes.status, 200);
        assert.equal(captureRes.body.success, true);
        assert.equal(captureRes.body.orderId, "CREATEDORD100");
        assert.equal(captureRes.body.isCompleted, true);

        process.env.GEMINI_API_KEY = "";
        const geminiTestRes = await invokeApp("GET", "/api/gemini/test");
        assert.equal(geminiTestRes.status, 500);
        assert.equal(geminiTestRes.body.success, false);
    });

    test("13. Multi-purchase-unit order preserves unit facts and conservative intelligence end-to-end", async () => {
        installPayPalFetchStub(() => createMockFetchResponse(200, {
            id: "ORDERMULTI1",
            status: "COMPLETED",
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: "unit-completed",
                    amount: { currency_code: "USD", value: "20.00" },
                    payments: {
                        captures: [
                            {
                                id: "CAPUNIT1",
                                status: "COMPLETED",
                                amount: { currency_code: "USD", value: "20.00" }
                            }
                        ]
                    }
                },
                {
                    reference_id: "unit-pending",
                    amount: { currency_code: "USD", value: "30.00" },
                    payments: {
                        captures: [
                            {
                                id: "CAPUNIT2",
                                status: "PENDING",
                                status_details: { reason: "ECHECK" },
                                amount: { currency_code: "USD", value: "30.00" }
                            }
                        ]
                    }
                }
            ]
        }));

        process.env.GEMINI_API_KEY = "";

        const res = await invokeApp("POST", "/api/copilot/explain", {
            orderId: "ORDERMULTI1",
            prompt: "Are all items paid and settled?"
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.explanationSource, "deterministic_rules");
        assert.equal(res.body.verifiedFacts.purchaseUnits.length, 2);
        assert.equal(res.body.intelligence.lifecycleStage, "CAPTURED_PENDING");
        assert.equal(res.body.intelligence.fundsCaptured, "pending");
        assert.equal(res.body.intelligence.purchaseUnitSummary.length, 2);
        assert.equal(isValidCopilotExplanation(res.body.explanation), true);
    });
});
