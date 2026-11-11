import { useState, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DemoBanner from './components/DemoBanner';
import TransactionDetailModal from './components/TransactionDetailModal';
import CreatePaymentModal from './components/CreatePaymentModal';
import PaymentReturnModal from './components/PaymentReturnModal';
import DashboardView from './views/DashboardView';
import TransactionsView from './views/TransactionsView';
import CopilotView from './views/CopilotView';
import SettingsView from './views/SettingsView';
import { MOCK_TRANSACTIONS, MOCK_STATISTICS } from './data/mockTransactions';
import { apiService, BACKEND_URL } from './services/apiService';
import './App.css';

function App() {
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'transactions', 'copilot', 'settings'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxForModal, setSelectedTxForModal] = useState(null);
  const [selectedTxForCopilot, setSelectedTxForCopilot] = useState(null);
  const [initialCopilotPrompt, setInitialCopilotPrompt] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // State for real PayPal Sandbox order creation
  const [createOrderState, setCreateOrderState] = useState({
    isOpen: false,
    isLoading: false,
    error: null,
    orderData: null
  });

  // State for PayPal Buyer Return / Payment Verification (initialized from URL if present)
  const [returnOrderState, setReturnOrderState] = useState(() => {
    if (typeof window === 'undefined') {
      return { isOpen: false, token: null, isCancelled: false };
    }
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');
      const paypalStatus = searchParams.get('paypal_status');
      if (paypalStatus === 'cancelled' || token || paypalStatus === 'returned') {
        return {
          isOpen: true,
          token: token || null,
          isCancelled: paypalStatus === 'cancelled'
        };
      }
    } catch {
      // ignore
    }
    return { isOpen: false, token: null, isCancelled: false };
  });

  // Compute live statistics based on current transaction list
  const statistics = useMemo(() => {
    const totalVolume = transactions.reduce(
      (sum, tx) => sum + (Number.isFinite(Number(tx.amount)) ? Number(tx.amount) : 0),
      0
    );
    const pendingCount = transactions.filter(t => t.status === 'Pending').length;
    const completedCount = transactions.filter(t => t.status === 'Completed').length;
    const failedCount = transactions.filter(t => t.status === 'Failed').length;

    return {
      totalAnalyzedVolume: `$${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      clarityConfidenceScore: '99.2%',
      activeTransactionsCount: transactions.length,
      completedCount,
      pendingCount,
      failedCount,
      disputesAvertedCount: MOCK_STATISTICS.disputesAvertedCount,
      sellerReserveProtected: MOCK_STATISTICS.sellerReserveProtected
    };
  }, [transactions]);

  // Handle global search filtering
  const displayTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase();
    return transactions.filter(tx => 
      tx.id?.toLowerCase().includes(q) ||
      tx.resolvedMerchant?.toLowerCase().includes(q) ||
      tx.rawDescriptor?.toLowerCase().includes(q) ||
      tx.status?.toLowerCase().includes(q) ||
      tx.merchantCategory?.toLowerCase().includes(q)
    );
  }, [transactions, searchQuery]);

  // Open transaction detail modal
  const handleSelectTransaction = (tx) => {
    setSelectedTxForModal(tx);
  };

  // Navigate to Copilot with pre-selected transaction
  const handleClarifyTransaction = (tx, prompt = '') => {
    setSelectedTxForCopilot(tx);
    setInitialCopilotPrompt(prompt);
    setActiveTab('copilot');
  };

  // Real PayPal Sandbox payment order creation
  const handleOpenCreatePayment = async () => {
    setCreateOrderState({
      isOpen: true,
      isLoading: true,
      error: null,
      orderData: null
    });

    try {
      const data = await apiService.createSandboxOrder("10.00");
      setCreateOrderState({
        isOpen: true,
        isLoading: false,
        error: null,
        orderData: data
      });
    } catch (err) {
      setCreateOrderState({
        isOpen: true,
        isLoading: false,
        error: err.message || `Failed to connect to backend at ${BACKEND_URL}.`,
        orderData: null
      });
    }
  };

  const handleCloseCreatePayment = () => {
    setCreateOrderState(prev => ({ ...prev, isOpen: false }));
  };

  // Simulate a new incoming PayPal transaction / webhook event
  const handleSimulateEvent = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const newSimulatedTx = {
        id: `7MK${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        invoiceId: `INV-2026-SIM-${Math.floor(100 + Math.random() * 900)}`,
        date: new Date().toISOString(),
        dateFormatted: "Just now",
        rawDescriptor: "PAYPAL *BLUE-BOTTLE-COFFEE SAN FRANCISCO",
        resolvedMerchant: "Blue Bottle Coffee Co.",
        merchantCategory: "Food & Beverage / Specialty Retail",
        merchantLogo: "coffee",
        type: "purchase",
        direction: "debit",
        amount: 8.75,
        currency: "USD",
        fee: 0.00,
        net: 8.75,
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
          details: "Standard retail purchase coverage."
        },
        aiExplanation: {
          headline: "Specialty cafe purchase authorized via PayPal in-store QR code",
          confidence: 99.7,
          descriptorMeaning: "'BLUE-BOTTLE-COFFEE' represents the San Francisco flagship roastery for Blue Bottle Coffee.",
          statusReason: "Payment completed instantaneously at contactless point of sale.",
          riskAssessment: "Safe. Verified merchant checkout location.",
          claritySummary: "You spent $8.75 on coffee & bakery items at Blue Bottle Coffee.",
          timeline: [
            { title: "Point of sale QR scan", time: "Just now", status: "done" },
            { title: "Bank authorized $8.75", time: "Just now", status: "done" },
            { title: "Receipt issued to email", time: "Just now", status: "done" }
          ]
        },
        safeNextSteps: [
          {
            id: "step-sim-1",
            title: "Digital receipt saved to PayPal",
            description: "No further action needed. Keep email receipt for your records.",
            severity: "safe",
            actionText: "View Digital Receipt"
          }
        ]
      };

      setTransactions(prev => [newSimulatedTx, ...prev]);
      setIsSimulating(false);
      showToast("Simulated new transaction event: Blue Bottle Coffee ($8.75)");
    }, 600);
  };

  // Reset to initial mock dataset
  const handleResetData = () => {
    setTransactions(MOCK_TRANSACTIONS);
    setSearchQuery('');
    showToast("Reset demo data to default sandbox state");
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Clean URL query parameters safely after capturing state so refresh doesn't re-trigger
  useEffect(() => {
    if (returnOrderState.isOpen) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [returnOrderState.isOpen]);

  const handleCaptureSuccess = (capturedOrder) => {
    const parseOptionalNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const amountObj = capturedOrder?.amount || capturedOrder?.capture?.amount || null;
    const grossAmount = parseOptionalNumber(amountObj?.value);
    const currencyCode = amountObj?.currency || 'USD';
    const breakdown = capturedOrder?.capture?.sellerReceivableBreakdown || null;
    const feeAmount = parseOptionalNumber(breakdown?.paypalFee?.value);
    const netAmount = parseOptionalNumber(breakdown?.netAmount?.value);

    const amountToastText = grossAmount !== null
      ? `${grossAmount.toFixed(2)} ${currencyCode}`
      : 'verified amount';
    showToast(`PayPal capture confirmed: ${amountToastText}`);

    const resolvedDateIso =
      capturedOrder?.capture?.updateTime ||
      capturedOrder?.updateTime ||
      capturedOrder?.createTime ||
      new Date().toISOString();

    const payerEmail = capturedOrder?.payer?.emailAddress || null;
    const payeeLabel = capturedOrder?.payee?.emailAddress || capturedOrder?.payee?.merchantId || 'PayPal Sandbox Merchant';

    const newCapturedTx = {
      id: capturedOrder.orderId,
      isRealSandboxOrder: true,
      invoiceId: null,
      date: resolvedDateIso,
      dateFormatted: new Date(resolvedDateIso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }),
      rawDescriptor: null,
      resolvedMerchant: payeeLabel,
      merchantCategory: 'PayPal Orders v2 Sandbox Order',
      merchantLogo: 'shield',
      type: 'payment',
      direction: 'credit',
      amount: grossAmount,
      currency: currencyCode,
      fee: feeAmount,
      net: netAmount,
      status: capturedOrder?.status === 'COMPLETED' || capturedOrder?.isCompleted ? 'Completed' : (capturedOrder?.status || 'Completed'),
      paymentMethod: payerEmail ? {
        type: 'PayPal Sandbox Account',
        brand: 'PayPal',
        last4: 'N/A',
        backup: 'Not provided by PayPal Orders v2'
      } : null,
      protection: {
        eligible: false,
        program: 'Not provided by PayPal Orders v2',
        details: 'Capture completion confirms the PayPal order capture state, without asserting final bank settlement or seller protection eligibility.'
      },
      aiExplanation: {
        headline: 'PayPal Sandbox capture confirmed via Orders v2 API (no AI explanation generated yet)',
        confidence: null,
        descriptorMeaning: 'Card/bank statement descriptor is not returned by PayPal Orders v2 order lookup.',
        statusReason: 'PayPal Sandbox confirmed capture completion (COMPLETED). Capture completion confirms the capture on PayPal, but does not establish final bank settlement.',
        riskAssessment: 'Verified directly from PayPal Orders v2 response. Query this Order ID in AI Copilot for a Gemini explanation.',
        claritySummary: grossAmount !== null
          ? `PayPal confirmed capture completion for ${grossAmount.toFixed(2)} ${currencyCode}. PayPal fee breakdown and bank settlement details depend on official PayPal merchant statements.`
          : 'PayPal confirmed capture completion. Open AI Copilot to inspect verified order facts.',
        timeline: [
          capturedOrder?.createTime ? { title: 'Order created on PayPal', time: capturedOrder.createTime, status: 'done' } : null,
          { title: 'Capture confirmed by PayPal Orders v2', time: capturedOrder?.capture?.updateTime || capturedOrder?.updateTime || 'Confirmed', status: 'done' }
        ].filter(Boolean)
      },
      safeNextSteps: [
        {
          id: 'step-cap-1',
          title: 'Capture confirmed in PayPal Sandbox',
          description: 'Review fee and settlement details directly in your PayPal merchant account or query this Order ID in AI Copilot.',
          severity: 'safe',
          actionText: 'Open AI Copilot'
        }
      ]
    };

    setTransactions(prev => [newCapturedTx, ...prev]);
  };

  return (
    <div className="app-layout">
      {/* Top Demo Banner */}
      <DemoBanner 
        onSimulateEvent={handleSimulateEvent}
        onResetData={handleResetData}
        isSimulating={isSimulating}
      />

      {/* Main Top Navigation Bar */}
      <Navbar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectTab={setActiveTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onOpenCreatePayment={handleOpenCreatePayment}
      />

      {/* Application Shell */}
      <div className="app-shell-container">
        {/* Left Sidebar */}
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          transactionsCount={transactions.length}
          pendingCount={statistics.pendingCount}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Center Main View Area */}
        <main className="main-content-area">
          {toastMessage && (
            <div className="global-toast-notification">
              <span className="toast-dot"></span>
              <span>{toastMessage}</span>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView 
              transactions={displayTransactions}
              statistics={statistics}
              onSelectTransaction={handleSelectTransaction}
              onClarifyTransaction={handleClarifyTransaction}
              onNavigateToCopilot={() => setActiveTab('copilot')}
              onOpenCreatePayment={handleOpenCreatePayment}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView 
              transactions={displayTransactions}
              onSelectTransaction={handleSelectTransaction}
              onClarifyTransaction={handleClarifyTransaction}
              onOpenCreatePayment={handleOpenCreatePayment}
            />
          )}

          {activeTab === 'copilot' && (
            <CopilotView 
              transactions={transactions}
              initialTransaction={selectedTxForCopilot}
              initialPrompt={initialCopilotPrompt}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </main>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxForModal && (
        <TransactionDetailModal 
          transaction={selectedTxForModal}
          onClose={() => setSelectedTxForModal(null)}
          onAskCopilot={(prompt, tx) => {
            handleClarifyTransaction(tx || selectedTxForModal, prompt);
          }}
        />
      )}

      {/* Real PayPal Sandbox Payment Creation Modal */}
      <CreatePaymentModal 
        isOpen={createOrderState.isOpen}
        isLoading={createOrderState.isLoading}
        error={createOrderState.error}
        orderData={createOrderState.orderData}
        onClose={handleCloseCreatePayment}
        onRetry={handleOpenCreatePayment}
      />

      {/* Real PayPal Buyer Return Verification & Capture Modal */}
      <PaymentReturnModal 
        isOpen={returnOrderState.isOpen}
        token={returnOrderState.token}
        isCancelled={returnOrderState.isCancelled}
        onClose={() => setReturnOrderState(prev => ({ ...prev, isOpen: false }))}
        onCaptureSuccess={handleCaptureSuccess}
      />
    </div>
  );
}

export default App;
