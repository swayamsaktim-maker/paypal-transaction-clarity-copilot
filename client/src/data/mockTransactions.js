/**
 * PayPal Transaction Clarity Copilot - Mock Sandbox Data
 * 
 * NOTICE: All transactions below are simulated demo data designed for the
 * PayPal AI Hackathon to demonstrate AI-powered transaction decoding,
 * plain-English status explanations, and dispute mitigation workflows.
 * No real PayPal accounts, money movement, or credentials are used.
 */

export const MOCK_TRANSACTIONS = [
  {
    id: "9PX2849102481",
    invoiceId: "INV-2026-SP-9821",
    date: "2026-11-06T08:14:00Z",
    dateFormatted: "Nov 6, 2026, 08:14 AM",
    rawDescriptor: "PAYPAL *SPOTIFY-SE 800-922-0204 CA",
    resolvedMerchant: "Spotify USA Inc.",
    merchantCategory: "Digital Entertainment & Audio Streaming",
    merchantLogo: "spotify",
    type: "subscription",
    direction: "debit",
    amount: 16.99,
    currency: "USD",
    fee: 0.00,
    net: 16.99,
    status: "Completed",
    paymentMethod: {
      type: "Credit Card",
      brand: "Chase Sapphire Visa",
      last4: "4291",
      backup: "PayPal Balance"
    },
    protection: {
      eligible: true,
      program: "PayPal Purchase Protection",
      details: "Full coverage for unauthorized charges or service delivery issues."
    },
    aiExplanation: {
      headline: "Regular monthly subscription renewal for Spotify Family Plan",
      confidence: 99.4,
      descriptorMeaning: "The cryptic code 'SPOTIFY-SE' represents Spotify Services Europe, the billing entity used by Spotify for recurring PayPal authorizations. The phone number 800-922-0204 connects to Spotify's verified merchant billing desk.",
      statusReason: "This charge completed successfully as scheduled in your PayPal recurring pre-approved billing agreements. Your bank authorized the charge instantly.",
      riskAssessment: "Low Risk. Matches your normal billing cadence (billed on the 6th of each month for the last 14 months).",
      claritySummary: "You were billed $16.99 for your monthly Spotify Family subscription. This is a legitimate scheduled charge, not an unexpected debit.",
      timeline: [
        { title: "Pre-approved agreement triggered", time: "08:13:58 AM", status: "done" },
        { title: "Bank card authorized", time: "08:14:00 AM", status: "done" },
        { title: "Settlement completed & receipt issued", time: "08:14:01 AM", status: "done" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "No urgent action required",
        description: "Your subscription renewal is active and your streaming services will continue uninterrupted.",
        severity: "info",
        actionText: "View Spotify Receipt"
      },
      {
        id: "step-2",
        title: "Manage recurring billing safely",
        description: "If you wish to change or cancel this subscription, use PayPal's Pre-Approved Payments settings or visit spotify.com/account.",
        severity: "safe",
        actionText: "Manage Recurring Payments"
      },
      {
        id: "step-3",
        title: "Do not file a premature bank dispute",
        description: "Filing a chargeback for a legitimate subscription may result in account suspension with Spotify. Always contact merchant support first.",
        severity: "warning",
        actionText: "Contact Spotify Billing"
      }
    ]
  },
  {
    id: "4TR9182301948",
    invoiceId: "INV-2026-ACH-552",
    date: "2026-11-05T15:42:00Z",
    dateFormatted: "Nov 5, 2026, 03:42 PM",
    rawDescriptor: "PAYPAL *ECHECK-CLEARING AMZN-SUPPLIER",
    resolvedMerchant: "Artisan Woodcraft Supply (via Wholesale Connect)",
    merchantCategory: "Commercial Raw Materials & Tools",
    merchantLogo: "box",
    type: "echeck",
    direction: "debit",
    amount: 145.20,
    currency: "USD",
    fee: 0.00,
    net: 145.20,
    status: "Pending",
    paymentMethod: {
      type: "Bank Transfer",
      brand: "Wells Fargo Business Checking",
      last4: "9012",
      backup: "None"
    },
    protection: {
      eligible: true,
      program: "PayPal Buyer Protection",
      details: "Protected once ACH transfer clears and order fulfills."
    },
    aiExplanation: {
      headline: "Payment is clearing through electronic bank transfer (eCheck)",
      confidence: 98.7,
      descriptorMeaning: "'ECHECK-CLEARING' indicates you authorized payment directly from your linked checking account without using instant bank debit or a card backup.",
      statusReason: "Electronic checks require clearing through the Automated Clearing House (ACH) network, which typically takes 3 to 5 business days. Your money has not been lost; it is in transit between your bank and PayPal.",
      riskAssessment: "Normal Processing Delay. The merchant is instructed not to fulfill or ship goods until the eCheck clears, protecting both parties.",
      claritySummary: "Your payment of $145.20 is currently in progress. Funds are expected to clear on or before Monday, Nov 9, 2026. Do NOT initiate a duplicate payment.",
      timeline: [
        { title: "eCheck initiated by buyer", time: "Nov 5, 03:42 PM", status: "done" },
        { title: "ACH clearance request sent to Federal Reserve", time: "Nov 5, 05:00 PM", status: "done" },
        { title: "Bank debit processing", time: "Nov 6, 09:00 AM", status: "in-progress" },
        { title: "Estimated clearance & merchant payout", time: "Nov 9, 2026", status: "pending" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Wait 3-5 business days for ACH clearance",
        description: "Expected clearing date is Nov 9, 2026. PayPal will email both you and the merchant as soon as funds clear.",
        severity: "info",
        actionText: "Track ACH Status"
      },
      {
        id: "step-2",
        title: "Do not resubmit a second payment",
        description: "Resubmitting will cause your bank to debit your account twice once the original eCheck settles.",
        severity: "warning",
        actionText: "Verify Bank Balance"
      },
      {
        id: "step-3",
        title: "Inform supplier that payment is in transit",
        description: "You can send an automated PayPal transaction status verification to Artisan Woodcraft Supply so they hold your inventory.",
        severity: "safe",
        actionText: "Send Status Note to Merchant"
      }
    ]
  },
  {
    id: "7UB3104928172",
    invoiceId: "UBR-TRIP-9912048",
    date: "2026-11-06T22:22:00Z",
    dateFormatted: "Nov 6, 2026, 10:22 PM",
    rawDescriptor: "PAYPAL *UBER TRIP TEMP-AUTH SF CA",
    resolvedMerchant: "Uber Technologies Inc.",
    merchantCategory: "Rideshare & Urban Transportation",
    merchantLogo: "car",
    type: "authorization",
    direction: "debit",
    amount: 32.50,
    currency: "USD",
    fee: 0.00,
    net: 32.50,
    status: "Pending",
    paymentMethod: {
      type: "Credit Card",
      brand: "Apple Card Mastercard",
      last4: "8821",
      backup: "PayPal Balance"
    },
    protection: {
      eligible: true,
      program: "PayPal Purchase Protection",
      details: "Eligible for disputed ride totals and fare corrections."
    },
    aiExplanation: {
      headline: "Temporary pre-authorization hold for rideshare trip",
      confidence: 99.8,
      descriptorMeaning: "'TEMP-AUTH' confirms this is an authorization hold placed when you hailed the ride to ensure sufficient funds, including an estimated gratuity or route variance.",
      statusReason: "Your ride fare was $26.40 plus an optional tip. Uber placed a $32.50 temporary hold. Once Uber finalizes the ride ledger (usually within 24 hours), the actual amount ($26.40) will settle, and the remaining $6.10 hold will vanish.",
      riskAssessment: "Zero Risk of Double Billing. This is standard banking protocol for rideshares, gas pumps, and hotel check-ins.",
      claritySummary: "You have NOT been charged twice. The pending $32.50 hold will adjust to your final trip receipt of $26.40 within 24-48 hours.",
      timeline: [
        { title: "Ride requested & temporary hold placed", time: "10:22 PM", status: "done" },
        { title: "Ride completed safely", time: "10:48 PM", status: "done" },
        { title: "Final ride receipt calculated ($26.40)", time: "10:50 PM", status: "done" },
        { title: "Pending hold adjustment & final capture", time: "Awaiting bank cycle", status: "pending" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Wait 24 hours for hold adjustment",
        description: "The pending $32.50 line item on your card statement will automatically reduce to $26.40.",
        severity: "info",
        actionText: "View Trip Breakdown"
      },
      {
        id: "step-2",
        title: "Check Uber App trip activity",
        description: "Confirm your final fare in the Uber receipt matches your drop-off and route.",
        severity: "safe",
        actionText: "Open Uber Receipt"
      },
      {
        id: "step-3",
        title: "Avoid filing a duplicate charge claim",
        description: "Banks often display holds as pending debits; premature claims will be rejected once the hold adjusts.",
        severity: "warning",
        actionText: "Read Hold FAQs"
      }
    ]
  },
  {
    id: "2FL5591029481",
    invoiceId: "INV-TG-8092",
    date: "2026-11-04T13:15:00Z",
    dateFormatted: "Nov 4, 2026, 01:15 PM",
    rawDescriptor: "PAYPAL *TECHGEAR-ONLINE 408-536-6000",
    resolvedMerchant: "Apex Techgear Direct (Online Store)",
    merchantCategory: "Consumer Electronics & Accessories",
    merchantLogo: "laptop",
    type: "purchase",
    direction: "debit",
    amount: 420.00,
    currency: "USD",
    fee: 0.00,
    net: 0.00,
    status: "Failed",
    paymentMethod: {
      type: "Debit Card",
      brand: "Bank of America Debit Visa",
      last4: "3104",
      backup: "None"
    },
    protection: {
      eligible: false,
      program: "Not Applicable",
      details: "Transaction was declined before any funds transferred."
    },
    aiExplanation: {
      headline: "Card issuer declined payment due to bank security velocity rule",
      confidence: 97.9,
      descriptorMeaning: "'TECHGEAR-ONLINE' is the verified online storefront for Apex Techgear. The transaction was stopped at the bank gateway stage.",
      statusReason: "Your bank (Bank of America ending in 3104) declined the $420.00 authorization. This occurred because of a bank automated fraud-prevention check (unfamiliar merchant location or online spending limit). PayPal did not decline this charge; your card issuer did.",
      riskAssessment: "Safe. No funds were deducted from your bank account or PayPal balance.",
      claritySummary: "Zero dollars were taken from your account. Your order at Apex Techgear has not been placed. You can safely retry after verifying with your bank.",
      timeline: [
        { title: "Checkout attempted via PayPal", time: "01:14:55 PM", status: "done" },
        { title: "Authorization sent to card issuer", time: "01:14:58 PM", status: "done" },
        { title: "Bank returned Decline Code 05: Do Not Honor", time: "01:15:00 PM", status: "failed" },
        { title: "Transaction halted & cart preserved", time: "01:15:02 PM", status: "done" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Check for SMS or bank security prompt",
        description: "Check your phone for a fraud verification SMS from Bank of America asking 'Did you attempt a $420.00 purchase?'. Reply YES.",
        severity: "warning",
        actionText: "Verify with Bank"
      },
      {
        id: "step-2",
        title: "Retry with an alternative payment method",
        description: "You can pay using your PayPal Balance, linked checking account, or a different credit card without re-entering shipping info.",
        severity: "safe",
        actionText: "Select Another Payment Card"
      },
      {
        id: "step-3",
        title: "Confirm merchant cart state",
        description: "Apex Techgear has saved your cart for 24 hours so you won't lose your discount code or items.",
        severity: "info",
        actionText: "Resume Checkout Safely"
      }
    ]
  },
  {
    id: "8CS1850192841",
    invoiceId: "INV-2026-CLOUD-041",
    date: "2026-11-03T11:30:00Z",
    dateFormatted: "Nov 3, 2026, 11:30 AM",
    rawDescriptor: "PAYPAL *INVOICE #INV-2026-041 CLOUDDEV",
    resolvedMerchant: "CloudScale Dev Studio LLC",
    merchantCategory: "Software Consulting & Cloud Engineering",
    merchantLogo: "cloud",
    type: "invoice",
    direction: "credit",
    amount: 1850.00,
    currency: "USD",
    fee: 53.95,
    net: 1796.05,
    status: "Completed",
    paymentMethod: {
      type: "PayPal Business Checkout",
      brand: "Direct Client Transfer",
      last4: "N/A",
      backup: "N/A"
    },
    protection: {
      eligible: true,
      program: "PayPal Seller Protection",
      details: "Full seller protection for intangible digital services with signed scope documentation."
    },
    aiExplanation: {
      headline: "Client invoice payment received & deposited into balance",
      confidence: 99.9,
      descriptorMeaning: "'INV-2026-041 CLOUDDEV' links directly to your generated PayPal Business Invoice for milestone #2 of the Cloud Migration Contract.",
      statusReason: "Payment of $1,850.00 was successfully remitted by CloudScale Dev Studio LLC. Standard PayPal merchant processing fee of 2.99% + $0.49 ($53.95) was deducted, resulting in a net deposit of $1,796.05.",
      riskAssessment: "Verified Client. Verified business account with established payment track record.",
      claritySummary: "Funds are fully cleared and immediately available in your PayPal balance. You can withdraw to your bank account with standard or instant transfer.",
      timeline: [
        { title: "Invoice sent to client", time: "Nov 1, 10:00 AM", status: "done" },
        { title: "Client authorized payment", time: "Nov 3, 11:29 AM", status: "done" },
        { title: "Funds settled into PayPal Balance ($1,796.05 net)", time: "Nov 3, 11:30 AM", status: "done" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Download tax & accounting statement",
        description: "Save invoice #INV-2026-041 PDF for your Schedule C / 1099-K bookkeeping.",
        severity: "safe",
        actionText: "Download Invoice PDF"
      },
      {
        id: "step-2",
        title: "Transfer funds to bank account",
        description: "Initiate standard free ACH transfer (1-2 business days) or 1.5% instant debit card transfer.",
        severity: "info",
        actionText: "Transfer Funds Now"
      },
      {
        id: "step-3",
        title: "Send milestone completion confirmation",
        description: "Acknowledge client receipt through PayPal messaging to maintain a verifiable audit trail.",
        severity: "safe",
        actionText: "Send Client Receipt"
      }
    ]
  },
  {
    id: "3WH5801928472",
    invoiceId: "EBAY-WATCH-COLLECT-77",
    date: "2026-11-05T16:10:00Z",
    dateFormatted: "Nov 5, 2026, 04:10 PM",
    rawDescriptor: "PAYPAL *EBAY-COLLECTIBLE VINTAGE-WATCH",
    resolvedMerchant: "Vintage Horology Group (Buyer: @collector99)",
    merchantCategory: "Collectibles, Jewelry & Vintage Watches",
    merchantLogo: "watch",
    type: "sale",
    direction: "credit",
    amount: 580.00,
    currency: "USD",
    fee: 17.65,
    net: 562.35,
    status: "Pending",
    paymentMethod: {
      type: "Marketplace Checkout",
      brand: "Buyer PayPal Account",
      last4: "N/A",
      backup: "N/A"
    },
    protection: {
      eligible: true,
      program: "PayPal Seller Protection (Conditional)",
      details: "Protected once valid tracking number is uploaded and marked delivered."
    },
    aiExplanation: {
      headline: "Funds held temporarily under PayPal New Seller Protection Policy",
      confidence: 99.1,
      descriptorMeaning: "The transaction is a marketplace sale for high-value merchandise. The buyer's payment succeeded, but funds are placed in a 21-day security hold.",
      statusReason: "To protect buyers and sellers from fulfillment disputes in categories with elevated fraud rates, PayPal holds payments for up to 21 days or until shipping delivery is confirmed by the carrier.",
      riskAssessment: "Standard Safety Hold. Not a dispute or chargeback. Funds will release automatically 24 hours after carrier confirms delivery.",
      claritySummary: "Your buyer has paid $580.00 in full. The money is securely held by PayPal. Upload tracking to expedite fund release in 1 day instead of 21 days.",
      timeline: [
        { title: "Buyer completed checkout", time: "Nov 5, 04:10 PM", status: "done" },
        { title: "PayPal placed standard security hold", time: "Nov 5, 04:10 PM", status: "done" },
        { title: "Awaiting shipment & tracking number", time: "Current Step", status: "in-progress" },
        { title: "Automatic fund release (24h after delivery)", time: "Pending Tracking", status: "pending" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Ship with signature confirmation",
        description: "Use USPS Priority, UPS, or FedEx with signature required upon delivery to qualify for 100% Seller Protection.",
        severity: "warning",
        actionText: "Purchase Discounted Shipping Label"
      },
      {
        id: "step-2",
        title: "Upload tracking number directly to PayPal",
        description: "Once tracking is entered, PayPal monitors carrier API and releases funds 1 business day after delivery confirmation.",
        severity: "safe",
        actionText: "Upload Carrier Tracking"
      },
      {
        id: "step-3",
        title: "Do not issue a refund to expedite funds",
        description: "Refunding will not release money faster and cancels transaction seller protection.",
        severity: "info",
        actionText: "Learn About Hold Policies"
      }
    ]
  },
  {
    id: "6GH3900192841",
    invoiceId: "GH-ORG-OCT26",
    date: "2026-11-02T09:00:00Z",
    dateFormatted: "Nov 2, 2026, 09:00 AM",
    rawDescriptor: "PAYPAL *GITHUB COPILOT/ENT MICROSOFT",
    resolvedMerchant: "GitHub Inc. / Microsoft Corporation",
    merchantCategory: "Developer Tools, Cloud & Artificial Intelligence",
    merchantLogo: "code",
    type: "subscription",
    direction: "debit",
    amount: 39.00,
    currency: "USD",
    fee: 0.00,
    net: 39.00,
    status: "Completed",
    paymentMethod: {
      type: "Credit Card",
      brand: "Chase Sapphire Visa",
      last4: "4291",
      backup: "PayPal Balance"
    },
    protection: {
      eligible: true,
      program: "PayPal Purchase Protection",
      details: "Standard digital goods subscription protection."
    },
    aiExplanation: {
      headline: "GitHub Copilot Enterprise recurring monthly user seat license",
      confidence: 99.6,
      descriptorMeaning: "'GITHUB COPILOT/ENT MICROSOFT' is the official merchant descriptor for GitHub organization billing handled through Microsoft's global payment aggregator.",
      statusReason: "Your monthly renewal for developer AI seats processed according to your organization seat allocation. The invoice matches exactly 1 seat of Copilot Enterprise at $39.00/mo.",
      riskAssessment: "Very Low Risk. Established merchant with recurring monthly billing on file.",
      claritySummary: "Legitimate $39.00 charge for GitHub Copilot Enterprise. Billed to your Chase card via PayPal auto-pay.",
      timeline: [
        { title: "Monthly license invoice issued", time: "08:59:50 AM", status: "done" },
        { title: "PayPal automated debit executed", time: "09:00:00 AM", status: "done" },
        { title: "License active for next 30 days", time: "09:00:01 AM", status: "done" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Review active seat allocations",
        description: "Ensure inactive team members do not occupy paid enterprise seats at github.com/orgs/billing.",
        severity: "info",
        actionText: "View GitHub Billing"
      },
      {
        id: "step-2",
        title: "Export VAT / Tax Invoice",
        description: "Download Microsoft Corporation tax receipt for software business expense deduction.",
        severity: "safe",
        actionText: "Export Tax Receipt"
      }
    ]
  },
  {
    id: "5FX8840192843",
    invoiceId: "FX-TYO-9912",
    date: "2026-11-01T14:45:00Z",
    dateFormatted: "Nov 1, 2026, 02:45 PM",
    rawDescriptor: "PAYPAL *TOKYO-ANIME-HOBBY JPY-CONV",
    resolvedMerchant: "Akihabara Direct Collectibles (Tokyo, JP)",
    merchantCategory: "International Retail & Cross-Border Merchandise",
    merchantLogo: "globe",
    type: "cross-border",
    direction: "debit",
    amount: 88.40,
    currency: "USD",
    fee: 3.10,
    net: 88.40,
    status: "Completed",
    paymentMethod: {
      type: "Credit Card",
      brand: "Chase Sapphire Visa",
      last4: "4291",
      backup: "PayPal Balance"
    },
    protection: {
      eligible: true,
      program: "PayPal International Purchase Protection",
      details: "Full international shipment coverage with item condition protection."
    },
    aiExplanation: {
      headline: "Cross-border purchase in Japanese Yen (JPY) converted to USD",
      confidence: 98.2,
      descriptorMeaning: "'JPY-CONV' signifies an international currency conversion executed at checkout from ¥13,000 JPY to $88.40 USD.",
      statusReason: "The merchant operates in Tokyo, Japan. PayPal performed dynamic currency conversion at an exchange rate of 1 USD = 147.05 JPY, which included PayPal's standard 3.5% currency conversion spread.",
      riskAssessment: "Low Risk. Merchant is a verified Japanese business with tracking integration.",
      claritySummary: "You spent ¥13,000 JPY. PayPal converted this to $88.40 USD. International customs declaration was generated automatically.",
      timeline: [
        { title: "Merchant requested ¥13,000 JPY", time: "02:44:50 PM", status: "done" },
        { title: "Currency conversion applied ($88.40 USD)", time: "02:44:58 PM", status: "done" },
        { title: "Cross-border payment cleared", time: "02:45:00 PM", status: "done" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Track international EMS package",
        description: "International air shipments from Japan typically take 5-8 business days to pass US Customs clearance.",
        severity: "info",
        actionText: "Track Japan Post EMS"
      },
      {
        id: "step-2",
        title: "Tip: Card issuer FX conversion choice",
        description: "On future international purchases, you can choose in PayPal checkout whether PayPal or your credit card issuer converts the currency.",
        severity: "safe",
        actionText: "Learn About FX Conversion"
      }
    ]
  },
  {
    id: "1NY4001928419",
    invoiceId: "NYT-SUB-202610",
    date: "2026-10-31T06:12:00Z",
    dateFormatted: "Oct 31, 2026, 06:12 AM",
    rawDescriptor: "PAYPAL *NYTIMES-DIGITAL-RENEW",
    resolvedMerchant: "The New York Times (Digital News)",
    merchantCategory: "News Publishing & Digital Subscriptions",
    merchantLogo: "news",
    type: "subscription",
    direction: "debit",
    amount: 4.00,
    currency: "USD",
    fee: 0.00,
    net: 0.00,
    status: "Failed",
    paymentMethod: {
      type: "Credit Card",
      brand: "Capital One Mastercard",
      last4: "1109",
      backup: "None"
    },
    protection: {
      eligible: false,
      program: "Not Applicable",
      details: "Transaction failed prior to settlement."
    },
    aiExplanation: {
      headline: "Subscription auto-renewal failed due to expired card on file",
      confidence: 99.5,
      descriptorMeaning: "'NYTIMES-DIGITAL-RENEW' is the automated billing daemon for New York Times digital news access.",
      statusReason: "The renewal attempted to bill Capital One Mastercard ending in 1109. This card expired on 10/26. Because no valid backup payment method was selected, the payment failed.",
      riskAssessment: "Service Interruption Warning. The merchant will grace-period your subscription for 5 days before canceling access.",
      claritySummary: "Payment failed due to an expired card. Your news subscription will pause unless updated by Nov 5, 2026.",
      timeline: [
        { title: "Subscription scheduled renewal", time: "06:11:50 AM", status: "done" },
        { title: "Attempted billing on card ending in 1109", time: "06:11:58 AM", status: "done" },
        { title: "Declined: Card Expired (10/26)", time: "06:12:00 AM", status: "failed" },
        { title: "Merchant 5-day grace period started", time: "06:12:01 AM", status: "done" }
      ]
    },
    safeNextSteps: [
      {
        id: "step-1",
        title: "Update card expiration date or add new card",
        description: "Go to your PayPal Wallet and enter the new expiration date/CVV for your replacement card.",
        severity: "warning",
        actionText: "Update PayPal Wallet"
      },
      {
        id: "step-2",
        title: "Enable PayPal Balance as automatic backup",
        description: "Prevent future renewals from failing by toggling balance fallback in your PayPal automatic payments settings.",
        severity: "safe",
        actionText: "Enable Backup Funding"
      }
    ]
  }
];

export const MOCK_STATISTICS = {
  totalAnalyzedVolume: "$14,820.50",
  totalVolumeRaw: 14820.50,
  clarityConfidenceScore: "99.2%",
  activeTransactionsCount: 9,
  completedCount: 5,
  pendingCount: 3,
  failedCount: 2,
  disputesAvertedCount: 18,
  avgClarificationTime: "0.8s",
  sellerReserveProtected: "$580.00"
};

export const COPILOT_SAMPLE_QUESTIONS = [
  "Why is my $145.20 payment to Artisan Woodcraft Supply marked Pending?",
  "Did Uber double charge me $32.50 for a $26.40 ride?",
  "What does the cryptic descriptor 'PAYPAL *SPOTIFY-SE' actually mean?",
  "Why was my $420.00 Techgear payment declined if I had money in my account?",
  "Why are my eBay watch sale funds ($580.00) in a 21-day pending hold?",
  "How do I prevent getting charged twice for an eCheck payment?",
  "Is this $39.00 GitHub charge an unauthorized transaction?"
];

export const COPILOT_KNOWLEDGE_BASE = {
  echeck: {
    title: "Understanding PayPal eChecks & Bank Processing",
    summary: "An eCheck is an electronic funds transfer directly from your bank checking account. Unlike instant transfers, eChecks clear through the Federal Reserve ACH network and require 3-5 business days. During this window, status is Pending and both buyer and seller are advised to wait."
  },
  preauth: {
    title: "Understanding Pre-Authorization Holds",
    summary: "Merchants like rideshare apps, hotels, car rentals, and gas stations place temporary pre-authorization holds to guarantee funds. When the final invoice is submitted, the temporary hold drops off and only the exact amount is debited."
  },
  sellerHold: {
    title: "PayPal 21-Day Security Hold Policy",
    summary: "Funds are placed in temporary reserve to establish seller reliability for higher-risk or high-value physical goods. Uploading valid carrier tracking releases funds 24 hours after verified delivery."
  },
  descriptor: {
    title: "Cryptic Statement Descriptors Decoded",
    summary: "Statement descriptors are 22-character truncated strings sent to banking networks. Copilot matches these against PayPal's global merchant directory to resolve true legal entity, brand, support contact, and invoice."
  }
};

