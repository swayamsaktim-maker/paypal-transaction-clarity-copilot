/**
 * PayPal Transaction Clarity Copilot - API Service Adapter
 * 
 * Provides an abstraction layer between the React UI and the PayPal Sandbox
 * Express backend running on http://localhost:5000.
 * 
 * Never hardcodes PayPal secrets in the frontend.
 */

import { MOCK_TRANSACTIONS, MOCK_STATISTICS, COPILOT_SAMPLE_QUESTIONS } from '../data/mockTransactions';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

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

export default apiService;
