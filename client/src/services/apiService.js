/**
 * PayPal Transaction Clarity Copilot - API Service Adapter
 * 
 * Provides an abstraction layer between the React UI and the PayPal Sandbox
 * Express backend running on http://localhost:5000.
 * 
 * Never hardcodes PayPal secrets in the frontend.
 */

import { MOCK_TRANSACTIONS, MOCK_STATISTICS, COPILOT_SAMPLE_QUESTIONS } from '../data/mockTransactions.js';

export const BACKEND_URL = (import.meta.env?.VITE_BACKEND_URL || 'http://localhost:5000').trim().replace(/\/+$/, '');
const USE_MOCK = import.meta.env?.VITE_USE_MOCK_API !== 'false';

/**
 * Validate PayPal Order ID format consistently with backend validator.
 * Matches alphanumeric, hyphen, and underscore strings between 10 and 40 characters.
 */
export function isValidPayPalOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') return false;
  return /^[A-Za-z0-9_-]{10,40}$/.test(orderId.trim());
}

export const apiService = {
  /**
   * Create a real PayPal Sandbox order via backend API
   * POST http://localhost:5000/api/paypal/orders
   * 
   * Returns: { success: true, orderId: string, status: string, approvalUrl: string }
   */
  async createSandboxOrder(amount = "10.00") {
    const response = await fetch(`${BACKEND_URL}/api/paypal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount: String(amount) })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Failed to create PayPal order (Status: ${response.status})`);
    }

    return data;
  },

  /**
   * Retrieve and verify a PayPal order by ID from backend
   * GET http://localhost:5000/api/paypal/orders/:orderId
   */
  async getOrder(orderId) {
    if (!orderId) {
      throw new Error("Order ID is required to verify an order.");
    }

    const response = await fetch(`${BACKEND_URL}/api/paypal/orders/${encodeURIComponent(orderId)}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Failed to verify PayPal order (Status: ${response.status})`);
    }

    return data;
  },

  /**
   * Explicitly capture an authorized PayPal order
   * POST http://localhost:5000/api/paypal/orders/:orderId/capture
   */
  async captureOrder(orderId) {
    if (!orderId) {
      throw new Error("Order ID is required to capture an order.");
    }

    const response = await fetch(`${BACKEND_URL}/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || `Failed to capture PayPal order (Status: ${response.status})`);
    }

    return data;
  },

  /**
   * Request an AI explanation for a real PayPal Sandbox order directly from backend
   * POST http://localhost:5000/api/copilot/explain
   *
   * This function always calls the real backend endpoint directly. It never uses
   * USE_MOCK, mock transactions, or synthetic fallback data.
   *
   * @param {string} orderId - PayPal Order ID (alphanumeric string)
   * @param {string} prompt - User inquiry or clarification question
   * @param {object} [options] - Optional fetch controls (e.g. { signal })
   * @returns {Promise<{ success: boolean, model: string|null, verifiedFacts: object, explanation: object }>}
   */
  async explainOrder(orderId, prompt = "Explain the current payment status in simple language.", options = {}) {
    if (!orderId || typeof orderId !== "string" || orderId.trim() === "") {
      throw new Error("A valid PayPal order ID is required.");
    }

    const trimmedOrderId = orderId.trim();
    if (!isValidPayPalOrderId(trimmedOrderId)) {
      throw new Error("Invalid PayPal order ID format. Use 10 to 40 alphanumeric, hyphen, or underscore characters.");
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error("A prompt question is required.");
    }

    const trimmedPrompt = prompt.trim();

    if (trimmedPrompt.length > 500) {
      throw new Error("Prompt exceeds maximum allowed length of 500 characters.");
    }

    let response;
    try {
      response = await fetch(`${BACKEND_URL}/api/copilot/explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId: trimmedOrderId,
          prompt: trimmedPrompt
        }),
        signal: options?.signal
      });
    } catch (netError) {
      if (netError?.name === "AbortError") {
        throw netError;
      }
      const networkError = new Error(
        `Unable to connect to the backend server. Please verify that the server is running at ${BACKEND_URL}. (${netError.message})`,
        { cause: netError }
      );
      networkError.isNetworkError = true;
      throw networkError;
    }

    let data;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        const text = await response.text();
        data = text ? { message: text } : null;
      } catch {
        data = null;
      }
    }

    if (!response.ok || !data || !data.success) {
      const serverMessage = data?.error || data?.message;
      let safeMessage;

      switch (response.status) {
        case 400:
          safeMessage = serverMessage || "Invalid request. Please check the order ID and prompt.";
          break;
        case 404:
          safeMessage = serverMessage || "PayPal order not found. Please verify the order ID in PayPal Sandbox.";
          break;
        case 429:
          safeMessage = serverMessage || "Gemini rate limit or quota exceeded. Please try again later or check your API quota.";
          break;
        case 502:
          safeMessage = serverMessage || "AI explanation failed response schema validation or returned a malformed response.";
          break;
        case 503:
          safeMessage = serverMessage || "The AI service is temporarily unavailable due to high demand. Please try again shortly.";
          break;
        case 504:
          safeMessage = serverMessage || "The AI explanation request timed out. Please try again.";
          break;
        default:
          safeMessage = serverMessage || `Server returned error (${response.status}: ${response.statusText || "Unknown"}).`;
          break;
      }

      const error = new Error(safeMessage);
      error.status = response.status;
      error.code = typeof data?.code === "string" ? data.code : null;
      error.model = typeof data?.model === "string" && data.model.trim() ? data.model.trim() : null;
      error.verifiedFacts =
        data?.verifiedFacts && typeof data.verifiedFacts === "object" && !Array.isArray(data.verifiedFacts)
          ? data.verifiedFacts
          : null;
      error.details = data;
      throw error;
    }

    if (!data.verifiedFacts || typeof data.verifiedFacts !== "object") {
      throw new Error("Invalid backend response: verifiedFacts is missing.");
    }

    if (!data.explanation || typeof data.explanation !== "object") {
      throw new Error("Invalid backend response: explanation is missing.");
    }

    return {
      success: data.success,
      model: typeof data.model === "string" && data.model.trim() ? data.model.trim() : null,
      verifiedFacts: data.verifiedFacts,
      explanation: data.explanation
    };
  },

  /**
   * Fetch all transactions for the current account/sandbox profile
   */
  async getTransactions() {
    if (USE_MOCK) {
      return new Promise((resolve) => {
        setTimeout(() => resolve([...MOCK_TRANSACTIONS]), 150);
      });
    }

    const response = await fetch(`${BACKEND_URL}/api/paypal/transactions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Fetch aggregate metrics and dispute prevention statistics
   */
  async getStatistics() {
    if (USE_MOCK) {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ ...MOCK_STATISTICS }), 100);
      });
    }

    const response = await fetch(`${BACKEND_URL}/api/analytics/statistics`);
    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Request an AI explanation for a specific transaction
   */
  async requestClarity(transactionId, userPrompt = '') {
    if (USE_MOCK) {
      const match = MOCK_TRANSACTIONS.find(t => t.id === transactionId);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            transactionId,
            explanation: match?.aiExplanation || null,
            safeNextSteps: match?.safeNextSteps || [],
            status: match?.status || 'Unknown',
            promptProcessed: userPrompt
          });
        }, 400);
      });
    }

    const response = await fetch(`${BACKEND_URL}/api/copilot/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, prompt: userPrompt })
    });

    if (!response.ok) {
      throw new Error(`AI Clarity service error: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get sample prompts for the Copilot conversational assistant
   */
  getSamplePrompts() {
    return COPILOT_SAMPLE_QUESTIONS;
  }
};

export const explainOrder = (...args) => apiService.explainOrder(...args);

export default apiService;
