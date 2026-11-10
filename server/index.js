const path = require("path");
require("dotenv").config();
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: "http://localhost:5173"
}));

app.use(express.json());

const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

// Validate PayPal Order ID format (alphanumeric string, 10-40 chars)
function isValidPayPalOrderId(orderId) {
    if (!orderId || typeof orderId !== "string") return false;
    const trimmed = orderId.trim();
    return /^[A-Za-z0-9_-]{10,40}$/.test(trimmed);
}

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "PayPal Clarity backend is running!",
        environment: "Sandbox"
    });
});

// Get PayPal OAuth access token
async function getPayPalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("PayPal credentials are missing.");
    }

    const credentials = Buffer
        .from(`${clientId}:${clientSecret}`)
        .toString("base64");

    const response = await fetch(
        `${PAYPAL_BASE_URL}/v1/oauth2/token`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "grant_type=client_credentials"
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("PayPal OAuth failed:", response.status);
        throw new Error("PayPal authentication failed.");
    }

    return data.access_token;
}

// Test PayPal authentication
app.get("/api/paypal/test", async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();

        res.json({
            success: true,
            message: "Successfully authenticated with PayPal Sandbox!",
            authenticated: Boolean(accessToken),
            environment: "Sandbox"
        });
    } catch (error) {
        console.error("PayPal connection error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create PayPal Sandbox order
app.post("/api/paypal/orders", async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();
        const requestId = crypto.randomUUID();

        const amountValue = req.body?.amount
            ? Number(req.body.amount).toFixed(2)
            : "10.00";

        const orderPayload = {
            intent: "CAPTURE",
            purchase_units: [
                {
                    description: "PayPal Clarity Hackathon Demo",
                    amount: {
                        currency_code: "USD",
                        value: amountValue
                    }
                }
            ],
            payment_source: {
                paypal: {
                    experience_context: {
                        brand_name: "PayPal Clarity Copilot",
                        landing_page: "LOGIN",
                        user_action: "PAY_NOW",
                        return_url: "http://localhost:5173/?paypal_status=returned",
                        cancel_url: "http://localhost:5173/?paypal_status=cancelled"
                    }
                }
            }
        };

        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "PayPal-Request-Id": requestId
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("PayPal order creation failed:", response.status, data.name || data.message || "");
            return res.status(response.status).json({
                success: false,
                message: data.message || "Failed to create PayPal order."
            });
        }

        // Extract checkout approval URL from PayPal HATEOAS links.
        // Prefer 'payer-action' (used with payment_source), then 'approve', and 'approval_url' as fallback.
        let approvalLink = null;
        if (Array.isArray(data.links)) {
            approvalLink = data.links.find(link => link.rel === "payer-action")
                || data.links.find(link => link.rel === "approve")
                || data.links.find(link => link.rel === "approval_url")
                || null;
        }

        let validatedApprovalUrl = null;
        if (approvalLink && typeof approvalLink.href === "string") {
            try {
                const parsedUrl = new URL(approvalLink.href);
                const allowedHosts = ["www.sandbox.paypal.com", "sandbox.paypal.com"];
                if (parsedUrl.protocol === "https:" && allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
                    validatedApprovalUrl = parsedUrl.href;
                }
            } catch {
                validatedApprovalUrl = null;
            }
        }

        if (!validatedApprovalUrl) {
            console.error("PayPal order creation did not return a valid checkout URL:", data.id);
            return res.status(502).json({
                success: false,
                message: "PayPal did not return a valid checkout approval URL."
            });
        }

        res.status(201).json({
            success: true,
            orderId: data.id,
            status: data.status,
            approvalUrl: validatedApprovalUrl
        });
    } catch (error) {
        console.error("Order creation error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while creating the order."
        });
    }
});

// Verify and retrieve PayPal order details
app.get("/api/paypal/orders/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!isValidPayPalOrderId(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid PayPal order ID format."
            });
        }

        const accessToken = await getPayPalAccessToken();

        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("PayPal order retrieval failed:", response.status, data.name || data.message || "");
            const safeErrorMsg = data.details?.[0]?.description || data.message || "Failed to retrieve PayPal order.";
            return res.status(response.status).json({
                success: false,
                message: safeErrorMsg
            });
        }

        const purchaseUnit = data.purchase_units?.[0] || null;
        const captures = purchaseUnit?.payments?.captures || [];
        const primaryCapture = captures[0] || null;

        // Payment is completed only when PayPal confirms a completed capture
        const isCaptureCompleted = primaryCapture?.status === "COMPLETED";

        const rawPayer = data.payer || null;
        const rawPaymentSource = data.payment_source?.paypal || null;
        const resolvedEmail = rawPayer?.email_address || rawPaymentSource?.email_address || null;
        const resolvedPayerId = rawPayer?.payer_id || rawPaymentSource?.account_id || null;
        const payerInfo = (resolvedEmail || resolvedPayerId) ? {
            emailAddress: resolvedEmail,
            payerId: resolvedPayerId
        } : null;

        const rawPayee = purchaseUnit?.payee || null;
        const payeeInfo = (rawPayee?.email_address || rawPayee?.merchant_id) ? {
            emailAddress: rawPayee.email_address || null,
            merchantId: rawPayee.merchant_id || null
        } : null;

        res.status(200).json({
            success: true,
            orderId: data.id,
            status: data.status,
            intent: data.intent || null,
            isCompleted: isCaptureCompleted,
            amount: purchaseUnit?.amount ? {
                currency: purchaseUnit.amount.currency_code,
                value: purchaseUnit.amount.value
            } : null,
            description: purchaseUnit?.description || null,
            createTime: data.create_time || null,
            updateTime: data.update_time || null,
            payee: payeeInfo,
            payer: payerInfo,
            capture: primaryCapture ? {
                id: primaryCapture.id,
                status: primaryCapture.status,
                amount: primaryCapture.amount ? {
                    currency: primaryCapture.amount.currency_code,
                    value: primaryCapture.amount.value
                } : null,
                createTime: primaryCapture.create_time || null,
                updateTime: primaryCapture.update_time || null
            } : null
        });
    } catch (error) {
        console.error("Order verification error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while verifying the order."
        });
    }
});

// Capture an authorized PayPal order
app.post("/api/paypal/orders/:orderId/capture", async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!isValidPayPalOrderId(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid PayPal order ID format."
            });
        }

        // Amount and recipient are fixed by the pre-existing authorized order on PayPal
        // Do not accept arbitrary amounts or recipients from the frontend
        const accessToken = await getPayPalAccessToken();
        const requestId = crypto.randomUUID();

        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "PayPal-Request-Id": requestId
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("PayPal order capture failed:", response.status, data.name || data.message || "");

            const detail = data.details?.[0];
            let userMessage = detail?.description || data.message || "Failed to capture PayPal order.";

            if (detail?.issue === "ORDER_NOT_APPROVED") {
                userMessage = "Order has not yet been approved by the buyer. Please complete buyer authorization before capturing.";
            } else if (detail?.issue === "ORDER_ALREADY_CAPTURED") {
                userMessage = "Order has already been captured.";
            } else if (detail?.issue === "ORDER_COMPLETED_OR_VOIDED") {
                userMessage = "Order has already been completed or voided.";
            }

            return res.status(response.status).json({
                success: false,
                issue: detail?.issue || data.name || "CAPTURE_FAILED",
                message: userMessage
            });
        }

        const purchaseUnit = data.purchase_units?.[0] || null;
        const captures = purchaseUnit?.payments?.captures || [];
        const primaryCapture = captures[0] || null;

        const isCaptureCompleted = primaryCapture?.status === "COMPLETED" || data.status === "COMPLETED";

        const rawCapturePayer = data.payer || null;
        const rawCapturePaymentSource = data.payment_source?.paypal || null;
        const resolvedCaptureEmail = rawCapturePayer?.email_address || rawCapturePaymentSource?.email_address || null;
        const resolvedCapturePayerId = rawCapturePayer?.payer_id || rawCapturePaymentSource?.account_id || null;
        const capturePayerInfo = (resolvedCaptureEmail || resolvedCapturePayerId) ? {
            emailAddress: resolvedCaptureEmail,
            payerId: resolvedCapturePayerId
        } : null;

        res.status(200).json({
            success: true,
            orderId: data.id,
            status: data.status,
            isCompleted: isCaptureCompleted,
            capture: primaryCapture ? {
                id: primaryCapture.id,
                status: primaryCapture.status,
                amount: primaryCapture.amount ? {
                    currency: primaryCapture.amount.currency_code,
                    value: primaryCapture.amount.value
                } : null,
                sellerReceivableBreakdown: primaryCapture.seller_receivable_breakdown ? {
                    grossAmount: primaryCapture.seller_receivable_breakdown.gross_amount || null,
                    paypalFee: primaryCapture.seller_receivable_breakdown.paypal_fee || null,
                    netAmount: primaryCapture.seller_receivable_breakdown.net_amount || null
                } : null,
                createTime: primaryCapture.create_time || null,
                updateTime: primaryCapture.update_time || null
            } : null,
            payer: capturePayerInfo
        });
    } catch (error) {
        console.error("Order capture error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred while capturing the order."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
