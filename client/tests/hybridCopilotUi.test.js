import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

import { apiService } from '../src/services/apiService.js';
import {
  getExplanationProvenance,
  buildIntelligenceViewModel,
  sanitizeAiErrorMessage,
  resolveNextLastSubmittedRequest
} from '../src/utils/paypalFormatting.js';

const clientRoot = fileURLToPath(new URL('..', import.meta.url));

function createJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      }
    },
    async json() {
      return body;
    }
  };
}

function createSampleVerifiedFacts(orderId = 'ORD1234567890') {
  return {
    id: orderId,
    orderId,
    status: 'COMPLETED',
    intent: 'CAPTURE',
    amount: { value: '49.99', currency: 'USD' },
    createTime: '2026-04-01T10:00:00Z',
    updateTime: '2026-04-01T10:02:00Z',
    purchaseUnits: [],
    capture: {
      id: 'CAP1234567890',
      status: 'COMPLETED',
      amount: { value: '49.99', currency: 'USD' },
      createTime: '2026-04-01T10:01:30Z',
      updateTime: '2026-04-01T10:02:00Z'
    }
  };
}

function createSampleExplanation(overrides = {}) {
  return {
    headline: 'PayPal capture completed for 49.99 USD.',
    summary: 'PayPal confirmed capture completion for order ORD1234567890.',
    financialImpact: '49.99 USD captured on PayPal; final bank settlement is not verified.',
    safeNextSteps: ['Verify bank settlement separately in PayPal payout reporting.'],
    limitations: ['PayPal Orders v2 does not confirm final bank settlement.'],
    ...overrides
  };
}

function createSampleIntelligence(overrides = {}) {
  return {
    lifecycleStage: 'CAPTURED_COMPLETED',
    fundsCaptured: true,
    bankSettlementVerified: false,
    actionRequiredBy: 'none',
    hasBreakdown: false,
    missingFields: ['sellerReceivableBreakdown'],
    factualHighlights: [],
    questionIntent: 'general',
    captureSummary: {
      total: 1,
      completed: 1,
      pending: 0,
      declined: 0,
      refunded: 0,
      unknown: 0,
      completedAmount: { value: '49.99', currency: 'USD' }
    },
    authorizationSummary: {
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
    },
    refundSummary: {
      total: 0,
      completed: 0,
      pending: 0,
      failedOrCancelled: 0,
      unknown: 0,
      completedAmount: null,
      refundScope: 'none'
    },
    purchaseUnitSummary: [],
    ...overrides
  };
}

test.describe('Hybrid Copilot Frontend API & UI Integration', () => {
  let viteServer;
  let RealOrderClaritySectionMod;
  let CopilotViewMod;
  let MockDataMod;
  const originalFetch = globalThis.fetch;

  test.before(async () => {
    viteServer = await createServer({
      root: clientRoot,
      server: { middlewareMode: true, ws: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true }
    });
    RealOrderClaritySectionMod = await viteServer.ssrLoadModule('/src/components/RealOrderClaritySection.jsx');
    CopilotViewMod = await viteServer.ssrLoadModule('/src/views/CopilotView.jsx');
    MockDataMod = await viteServer.ssrLoadModule('/src/data/mockTransactions.js');
  });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test.after(async () => {
    globalThis.fetch = originalFetch;
    if (viteServer) {
      await viteServer.close();
    }
  });

  test('1. Gemini success preserves hybrid fields and renders "AI-Generated Explanation · Gemini [model]"', async () => {
    const payload = {
      success: true,
      explanationSource: 'gemini',
      isAiGenerated: true,
      aiFallbackUsed: false,
      model: 'gemini-3.8-flash',
      verifiedFacts: createSampleVerifiedFacts('ORD_GEMINI_01'),
      intelligence: createSampleIntelligence(),
      explanation: createSampleExplanation()
    };

    globalThis.fetch = async () => createJsonResponse(200, payload);
    const result = await apiService.explainOrder('ORD_GEMINI_01', 'Did this order capture?');

    assert.equal(result.explanationSource, 'gemini');
    assert.equal(result.isAiGenerated, true);
    assert.equal(result.aiFallbackUsed, false);
    assert.equal(result.model, 'gemini-3.8-flash');
    assert.equal(result.aiError, null);
    assert.equal(result.intelligence.lifecycleStage, 'CAPTURED_COMPLETED');

    const { ExplanationResultsSection } = RealOrderClaritySectionMod;
    const html = renderToStaticMarkup(
      React.createElement(ExplanationResultsSection, {
        result,
        error: null,
        errorHint: '',
        isLoading: false,
        activeRequestMeta: null,
        retryTargetOrderId: 'ORD_GEMINI_01',
        onRetry: () => {},
        onDismissError: () => {}
      })
    );

    assert.match(html, /AI-Generated Explanation · Gemini gemini-3\.8-flash/);
    assert.match(html, /Gemini AI Explanation/);
    assert.match(html, /Structured Output Validated/);
    assert.doesNotMatch(html, /Rule-Based Explanation/);
  });

  test('2. Deterministic fallback preserves non-AI provenance, never promotes to Gemini, and omits Gemini heading', async () => {
    const fallbackPayload = {
      success: true,
      explanationSource: 'deterministic_rules',
      isAiGenerated: false,
      aiFallbackUsed: true,
      model: null,
      aiError: {
        code: 'GEMINI_RATE_LIMIT',
        message: 'AI explanation quota or rate limit was exceeded. Showing deterministic rule-based explanation based on verified PayPal facts.'
      },
      verifiedFacts: createSampleVerifiedFacts('ORD_FALLBACK_01'),
      intelligence: createSampleIntelligence(),
      explanation: createSampleExplanation()
    };

    globalThis.fetch = async () => createJsonResponse(200, fallbackPayload);
    const result = await apiService.explainOrder('ORD_FALLBACK_01', 'What happened?');

    assert.equal(result.explanationSource, 'deterministic_rules');
    assert.equal(result.isAiGenerated, false);
    assert.equal(result.aiFallbackUsed, true);
    assert.equal(result.model, null);
    assert.equal(result.aiError.code, 'GEMINI_RATE_LIMIT');

    // Inconsistent provenance claiming Gemini with fallback=true must be rejected
    globalThis.fetch = async () => createJsonResponse(200, {
      ...fallbackPayload,
      explanationSource: 'gemini',
      isAiGenerated: true,
      aiFallbackUsed: true
    });
    await assert.rejects(
      () => apiService.explainOrder('ORD_FALLBACK_01', 'Check status'),
      /inconsistent AI provenance flags/i
    );

    const { ExplanationResultsSection } = RealOrderClaritySectionMod;
    const html = renderToStaticMarkup(
      React.createElement(ExplanationResultsSection, {
        result,
        error: null,
        errorHint: '',
        isLoading: false,
        activeRequestMeta: null,
        retryTargetOrderId: 'ORD_FALLBACK_01',
        onRetry: () => {},
        onDismissError: () => {}
      })
    );

    assert.match(html, /Rule-Based Explanation · Verified PayPal Facts/);
    assert.match(html, /Rule-Based Transaction Explanation/);
    assert.doesNotMatch(html, /Gemini AI Explanation/);
    assert.doesNotMatch(html, /generated by Gemini AI/);
  });

  test('3. Sanitized Gemini outage notice displays cleanly and blocks unsafe raw error leakage', () => {
    const { ExplanationResultsSection } = RealOrderClaritySectionMod;

    const cleanFallbackResult = {
      success: true,
      explanationSource: 'deterministic_rules',
      isAiGenerated: false,
      aiFallbackUsed: true,
      model: null,
      aiError: {
        code: 'GEMINI_UNAVAILABLE',
        message: 'The AI explanation service is temporarily unavailable. Showing deterministic rule-based explanation based on verified PayPal facts.'
      },
      verifiedFacts: createSampleVerifiedFacts('ORD_OUTAGE_01'),
      intelligence: createSampleIntelligence(),
      explanation: createSampleExplanation()
    };

    const cleanHtml = renderToStaticMarkup(
      React.createElement(ExplanationResultsSection, {
        result: cleanFallbackResult,
        error: null,
        errorHint: '',
        isLoading: false,
        retryTargetOrderId: 'ORD_OUTAGE_01',
        onRetry: () => {},
        onDismissError: () => {}
      })
    );

    assert.match(cleanHtml, /role="status"/);
    assert.match(cleanHtml, /The AI explanation service is temporarily unavailable\./);
    assert.match(cleanHtml, /Try Gemini Again/);

    // Unsafe SDK / API key / internal URL in aiError.message must be sanitized away in UI
    const leakyFallbackResult = {
      ...cleanFallbackResult,
      aiError: {
        code: 'GEMINI_REQUEST_FAILED',
        message: 'ECONNRESET https://secret.internal.local?key=AIzaSyLeakyKey123456 at stack.js:99'
      }
    };

    const sanitizedHtml = renderToStaticMarkup(
      React.createElement(ExplanationResultsSection, {
        result: leakyFallbackResult,
        error: null,
        errorHint: '',
        isLoading: false,
        retryTargetOrderId: 'ORD_OUTAGE_01',
        onRetry: () => {},
        onDismissError: () => {}
      })
    );

    assert.doesNotMatch(sanitizedHtml, /secret\.internal\.local|AIzaSy|ECONNRESET/);
    assert.match(
      sanitizedHtml,
      /Gemini is temporarily unavailable\. This explanation was generated using verified PayPal transaction facts and deterministic rules\./
    );
    assert.equal(
      sanitizeAiErrorMessage({ message: 'https://internal.api/v1' }),
      'Gemini is temporarily unavailable. This explanation was generated using verified PayPal transaction facts and deterministic rules.'
    );
  });

  test('4. fundsCaptured: null renders as Unknown (not Not Captured), distinct from fundsCaptured: false', () => {
    const { VerifiedIntelligenceSection } = RealOrderClaritySectionMod;

    const unknownHtml = renderToStaticMarkup(
      React.createElement(VerifiedIntelligenceSection, {
        intelligence: createSampleIntelligence({
          lifecycleStage: 'UNKNOWN',
          fundsCaptured: null,
          captureSummary: {
            total: 0,
            completed: 0,
            pending: 0,
            declined: 0,
            refunded: 0,
            unknown: 0,
            completedAmount: null
          }
        })
      })
    );

    assert.match(unknownHtml, /capture-state-unknown/);
    assert.match(unknownHtml, />Unknown</);
    assert.match(unknownHtml, /Capture certainty cannot be confirmed/);
    assert.doesNotMatch(unknownHtml, />Not Captured</);
    assert.match(unknownHtml, />Not verified</);

    const notCapturedHtml = renderToStaticMarkup(
      React.createElement(VerifiedIntelligenceSection, {
        intelligence: createSampleIntelligence({
          lifecycleStage: 'AUTHORIZED_NOT_CAPTURED',
          fundsCaptured: false
        })
      })
    );

    assert.match(notCapturedHtml, /capture-state-not_captured/);
    assert.match(notCapturedHtml, />Not Captured</);
  });

  test('5. Pending capture displays clearly as Pending with accurate capture counts', () => {
    const { VerifiedIntelligenceSection } = RealOrderClaritySectionMod;

    const pendingHtml = renderToStaticMarkup(
      React.createElement(VerifiedIntelligenceSection, {
        intelligence: createSampleIntelligence({
          lifecycleStage: 'CAPTURED_PENDING',
          fundsCaptured: 'pending',
          captureSummary: {
            total: 2,
            completed: 1,
            pending: 1,
            declined: 0,
            refunded: 0,
            unknown: 0,
            completedAmount: { value: '20.00', currency: 'USD' }
          }
        })
      })
    );

    assert.match(pendingHtml, /Capture Pending/);
    assert.match(pendingHtml, /capture-state-pending/);
    assert.match(pendingHtml, />Pending</);
    assert.match(pendingHtml, /2 total \(1 completed, 1 pending\)/);
  });

  test('6. Refund scope, refund counts, authorization counts, bank settlement "Not verified", and no raw JSON/IDs', () => {
    const { VerifiedIntelligenceSection } = RealOrderClaritySectionMod;

    const html = renderToStaticMarkup(
      React.createElement(VerifiedIntelligenceSection, {
        intelligence: createSampleIntelligence({
          lifecycleStage: 'REFUNDED_OR_PARTIAL',
          fundsCaptured: true,
          bankSettlementVerified: false,
          authorizationSummary: {
            total: 2,
            created: 0,
            pending: 0,
            authorized: 1,
            captured: 0,
            partiallyCaptured: 0,
            denied: 0,
            expired: 1,
            voided: 0,
            unknown: 0
          },
          refundSummary: {
            total: 2,
            completed: 1,
            pending: 1,
            failedOrCancelled: 0,
            unknown: 0,
            completedAmount: { value: '10.00', currency: 'EUR' },
            refundScope: 'partial'
          },
          purchaseUnitSummary: [
            { index: 0, referenceId: 'INTERNAL_SECRET_UNIT_REF_1' },
            { index: 1, referenceId: 'INTERNAL_SECRET_UNIT_REF_2' }
          ]
        })
      })
    );

    assert.match(html, /Refunded or Partially Refunded/);
    assert.match(html, /2 total \(1 authorized, 1 expired\)/);
    assert.match(html, />Partial Refund</);
    assert.match(html, /2 total \(1 completed, 1 pending\)/);
    assert.match(html, /€10\.00/);
    assert.match(html, />Not verified</);
    assert.match(html, /2 purchase units aggregated conservatively/);
    assert.doesNotMatch(html, /INTERNAL_SECRET_UNIT_REF_1|INTERNAL_SECRET_UNIT_REF_2|"lifecycleStage"/);

    // Check remaining refund scopes map cleanly too
    assert.equal(buildIntelligenceViewModel(createSampleIntelligence({ refundSummary: { total: 1, completed: 1, refundScope: 'full' } })).refundScopeLabel, 'Full Refund');
    assert.equal(buildIntelligenceViewModel(createSampleIntelligence({ refundSummary: { total: 1, pending: 1, refundScope: 'pending' } })).refundScopeLabel, 'Refund Pending');
    assert.equal(buildIntelligenceViewModel(createSampleIntelligence({ refundSummary: { total: 1, completed: 1, refundScope: 'unknown' } })).refundScopeLabel, 'Unverified Scope');
  });

  test('7. Missing or partial intelligence metadata is handled safely without errors or fake claims', async () => {
    globalThis.fetch = async () => createJsonResponse(200, {
      success: true,
      explanationSource: 'deterministic_rules',
      isAiGenerated: false,
      aiFallbackUsed: true,
      model: null,
      verifiedFacts: createSampleVerifiedFacts('ORD_NO_INTEL_1'),
      explanation: createSampleExplanation()
    });

    const res = await apiService.explainOrder('ORD_NO_INTEL_1', 'Explain status');
    assert.equal(res.intelligence, null);

    const { VerifiedIntelligenceSection } = RealOrderClaritySectionMod;
    const nullHtml = renderToStaticMarkup(
      React.createElement(VerifiedIntelligenceSection, { intelligence: null })
    );

    assert.match(nullHtml, /Intelligence Metadata Not Provided/);
    assert.match(nullHtml, /Detailed transaction intelligence metadata was not returned/);
    assert.match(nullHtml, />Unknown</);
    assert.match(nullHtml, />Not provided</);
    assert.match(nullHtml, />Not verified</);

    const emptyHtml = renderToStaticMarkup(
      React.createElement(VerifiedIntelligenceSection, { intelligence: {} })
    );
    assert.match(emptyHtml, /Unknown \/ Conflicting Records/);
    assert.match(emptyHtml, />Unknown</);
    assert.match(emptyHtml, />Not verified</);
  });

  test('8. Retry continues using the last submitted request and AbortError cancellation is preserved', async () => {
    // Verify retry preserves lastSubmittedRequest even if caller has edited inputs before clicking Retry
    const initialSubmitted = resolveNextLastSubmittedRequest(null, {
      orderId: 'ORD_ORIGINAL_99',
      prompt: 'Original submitted question?',
      isRetry: false
    });
    assert.deepEqual(initialSubmitted, {
      orderId: 'ORD_ORIGINAL_99',
      prompt: 'Original submitted question?'
    });

    const afterRetry = resolveNextLastSubmittedRequest(initialSubmitted, {
      orderId: 'ORD_EDITED_IN_FORM',
      prompt: 'Different edited question',
      isRetry: true
    });
    assert.deepEqual(afterRetry, {
      orderId: 'ORD_ORIGINAL_99',
      prompt: 'Original submitted question?'
    });

    // Verify rendered Retry UI preserves target order ID and Retry controls in both AI-error & fallback states
    const { ExplanationResultsSection } = RealOrderClaritySectionMod;
    const retryErrorHtml = renderToStaticMarkup(
      React.createElement(ExplanationResultsSection, {
        result: {
          success: false,
          verifiedFacts: createSampleVerifiedFacts('ORD_ORIGINAL_99'),
          explanation: null
        },
        error: { message: 'Temporary AI outage' },
        errorHint: 'Click Retry Explanation.',
        isLoading: false,
        retryTargetOrderId: 'ORD_ORIGINAL_99',
        onRetry: () => {},
        onDismissError: () => {}
      })
    );

    assert.match(retryErrorHtml, /Retry target \(last submitted order\)/);
    assert.match(retryErrorHtml, /ORD_ORIGINAL_99/);
    assert.match(retryErrorHtml, /aria-label="Retry explanation for order ORD_ORIGINAL_99"/);

    // Verify error response attaches verifiedFacts & intelligence and AbortController aborts propagate
    globalThis.fetch = async () => createJsonResponse(500, {
      success: false,
      code: 'FALLBACK_EXPLANATION_FAILED',
      message: 'Unable to generate explanation safely.',
      verifiedFacts: createSampleVerifiedFacts('ORD_ERR_PRESERVE'),
      intelligence: createSampleIntelligence(),
      aiError: { code: 'GEMINI_UNAVAILABLE', message: 'Unavailable' }
    });

    await assert.rejects(
      () => apiService.explainOrder('ORD_ERR_PRESERVE', 'Explain'),
      (err) => {
        assert.equal(err.status, 500);
        assert.equal(err.verifiedFacts.id, 'ORD_ERR_PRESERVE');
        assert.equal(err.intelligence.lifecycleStage, 'CAPTURED_COMPLETED');
        return true;
      }
    );

    globalThis.fetch = async (_url, init) => {
      assert.ok(init.signal);
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };
    const controller = new AbortController();
    await assert.rejects(
      () => apiService.explainOrder('ORD_ABORT_TEST', 'Explain', { signal: controller.signal }),
      (err) => err?.name === 'AbortError'
    );
  });

  test('9. Existing demo mode and Real vs Demo mode separation remain unaffected', () => {
    const { CopilotView } = CopilotViewMod;
    const { MOCK_TRANSACTIONS } = MockDataMod;

    // Demo mode rendered when initialTransaction / initialPrompt are provided
    const demoHtml = renderToStaticMarkup(
      React.createElement(CopilotView, {
        transactions: MOCK_TRANSACTIONS,
        initialTransaction: MOCK_TRANSACTIONS[0],
        initialPrompt: 'Why is this marked Pending?'
      })
    );

    assert.match(demoHtml, /DEMO DATA/);
    assert.match(demoHtml, /Ask Demo Copilot/);
    assert.match(demoHtml, /Inspecting Mock Transaction/);
    assert.doesNotMatch(demoHtml, /PayPal Sandbox Order ID/);

    // Real mode default still mounts RealOrderClaritySection alongside separate Demo switcher
    const realHtml = renderToStaticMarkup(
      React.createElement(CopilotView, {
        transactions: MOCK_TRANSACTIONS
      })
    );

    assert.match(realHtml, /Real PayPal Sandbox Order Clarity/);
    assert.match(realHtml, /PayPal Sandbox Order ID/);
    assert.match(realHtml, /Interactive Demo Chat/);

    // Explicit provenance guard sanity check when explanationSource is omitted
    const unknownSource = getExplanationProvenance({ explanation: createSampleExplanation() });
    assert.equal(unknownSource.isGemini, false);
    assert.equal(unknownSource.isDeterministic, true);
    assert.equal(unknownSource.heading, 'Rule-Based Transaction Explanation');
  });
});
