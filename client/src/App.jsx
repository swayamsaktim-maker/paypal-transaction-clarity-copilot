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
import { apiService } from './services/apiService';
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
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
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
      tx.id.toLowerCase().includes(q) ||
      tx.resolvedMerchant.toLowerCase().includes(q) ||
      tx.rawDescriptor.toLowerCase().includes(q) ||
      tx.status.toLowerCase().includes(q) ||
      tx.merchantCategory.toLowerCase().includes(q)
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
        error: err.message || "Failed to connect to backend at http://localhost:5000.",
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
    showToast(`Payment capture confirmed: $${Number(capturedOrder.amount?.value || 10).toFixed(2)} USD`);
    const newCapturedTx = {
      id: capturedOrder.orderId,
      invoiceId: `INV-SANDBOX-${capturedOrder.orderId.slice(-6)}`,
      date: new Date().toISOString(),
      dateFormatted: "Just now",
      rawDescriptor: "PAYPAL *CLARITY HACKATHON DEMO",
      resolvedMerchant: "PayPal Clarity Copilot",
      merchantCategory: "Software & Technology / Payment Verification",
      merchantLogo: "shield",
      type: "payment",
      direction: "credit",
      amount: Number(capturedOrder.amount?.value || 10.00),
      currency: capturedOrder.amount?.currency || "USD",
      fee: Number(capturedOrder.capture?.sellerReceivableBreakdown?.paypalFee?.value || 0.49),
      net: Number(capturedOrder.capture?.sellerReceivableBreakdown?.netAmount?.value || 9.51),
      status: "Completed",
      paymentMethod: {
        type: "PayPal Balance",
        brand: "PayPal Sandbox Wallet",
        last4: "9901",
        backup: "Bank Account"
      },
      protection: {
        eligible: true,
        program: "PayPal Seller Protection",
        details: "Confirmed captured payment via Sandbox Orders v2."
      },
      aiExplanation: {
        headline: "Verified Sandbox Payment successfully captured via Orders v2 API",
        confidence: 100.0,
        descriptorMeaning: "Official PayPal Clarity Sandbox Hackathon payment transaction.",
        statusReason: "Order capture completed and verified directly with PayPal Sandbox ledger.",
        riskAssessment: "Safe. Verified buyer authorization and completed capture.",
        claritySummary: `Successfully captured $${Number(capturedOrder.amount?.value || 10).toFixed(2)} USD from buyer account.`,
        timeline: [
          { title: "Order created (intent: CAPTURE)", time: "Earlier", status: "done" },
          { title: "Buyer authorized on PayPal", time: "Earlier", status: "done" },
          { title: "Payment captured successfully", time: "Just now", status: "done" }
        ]
      },
      safeNextSteps: [
        {
          id: "step-cap-1",
          title: "Verified capture recorded",
          description: "Funds are confirmed in the PayPal Sandbox merchant account.",
          severity: "safe",
          actionText: "View Transaction"
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
