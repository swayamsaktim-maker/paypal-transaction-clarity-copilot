import { useState } from 'react';
import { 
  SparklesIcon, 
  ShieldCheckIcon, 
  ClockIcon, 
  ArrowUpRight,
  ChevronRight,
  PayPalLogo
} from '../components/icons/Icons';
import StatCard from '../components/StatCard';
import TransactionTable from '../components/TransactionTable';

export function DashboardView({ 
  transactions = [], 
  statistics, 
  onSelectTransaction, 
  onClarifyTransaction,
  onNavigateToCopilot,
  onOpenCreatePayment
}) {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const pendingTransactions = transactions.filter(t => t.status === 'Pending');
  const failedTransactions = transactions.filter(t => t.status === 'Failed');
  const completedTransactions = transactions.filter(t => t.status === 'Completed');

  return (
    <div className="dashboard-view">
      {/* Top Welcome / Hero Banner */}
      <div className="dashboard-hero-banner">
        <div className="hero-content">
          <div className="hero-pill">
            <SparklesIcon size={14} />
            <span>Demo Dataset + Live PayPal Sandbox</span>
          </div>
          <h1 className="hero-title">PayPal Transaction Clarity Copilot</h1>
          <p className="hero-subtitle">
            Sample clarity workspace with simulated statement decoding plus real PayPal Orders v2 Sandbox & Gemini explanations in AI Copilot.
          </p>

          <div className="hero-quick-stats">
            <div className="hero-stat-item">
              <span className="stat-bullet bullet-emerald"></span>
              <span className="stat-text"><strong>{completedTransactions.length}</strong> Completed (Demo)</span>
            </div>
            <div className="hero-stat-item">
              <span className="stat-bullet bullet-amber"></span>
              <span className="stat-text"><strong>{pendingTransactions.length}</strong> Pending Holds (Demo)</span>
            </div>
            <div className="hero-stat-item">
              <span className="stat-bullet bullet-rose"></span>
              <span className="stat-text"><strong>{failedTransactions.length}</strong> Declined (Demo)</span>
            </div>
          </div>

          <div className="hero-button-row">
            <button
              type="button"
              onClick={onOpenCreatePayment}
              className="hero-create-payment-btn"
              title="Create real PayPal Sandbox order via backend API (POST /api/paypal/orders)"
            >
              <PayPalLogo size={18} />
              <span>Create Sandbox Payment ($10.00)</span>
            </button>
          </div>
        </div>

        <div className="hero-action-card">
          <div className="hero-action-card-header">
            <ShieldCheckIcon size={18} />
            <span>Dispute Prevention Preview (DEMO DATA)</span>
          </div>
          <div className="hero-score-val">100%</div>
          <p className="hero-score-text">
            Simulated showcase metric for preloaded sample holds. Open AI Copilot to inspect live PayPal Sandbox orders.
          </p>
          <button 
            type="button"
            onClick={() => onNavigateToCopilot()}
            className="hero-copilot-launch-btn"
          >
            <SparklesIcon size={15} />
            <span>Launch Clarity Copilot</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Statistics Cards */}
      <div className="stats-grid">
        <StatCard
          title="Sample Analyzed Volume (Demo)"
          value={statistics?.totalAnalyzedVolume || "$14,820.50"}
          subtitle={`${transactions.length} simulated / sandbox rows`}
          trend="Illustrative Total"
          trendDirection="up"
          variant="primary"
          badge="DEMO DATA"
          icon={<ArrowUpRight size={18} />}
        />

        <StatCard
          title="Clarity Confidence (Demo)"
          value={statistics?.clarityConfidenceScore || "99.2%"}
          subtitle="Simulated benchmark metric"
          trend="Synthetic Preview"
          trendDirection="up"
          variant="success"
          badge="DEMO DATA"
          icon={<SparklesIcon size={18} />}
        />

        <StatCard
          title="Sample Pending Holds (Demo)"
          value={`${pendingTransactions.length} Holds`}
          subtitle="Simulated eCheck, Auth & reserve"
          trend="Demo Scenarios"
          trendDirection="neutral"
          variant="warning"
          badge="DEMO DATA"
          icon={<ClockIcon size={18} />}
        />

        <StatCard
          title="Disputes Prevented (Demo)"
          value={`${statistics?.disputesAvertedCount || 18} Cases`}
          subtitle="Simulated chargeback example"
          trend="Illustrative Savings"
          trendDirection="up"
          variant="info"
          badge="DEMO DATA"
          icon={<ShieldCheckIcon size={18} />}
        />
      </div>

      {/* AI Clarity Spotlight Row (3 Core Scenarios Handled) */}
      <div className="spotlight-section">
        <div className="spotlight-header">
          <div className="spotlight-title-group">
            <SparklesIcon size={18} className="text-paypal-blue" />
            <h3 className="spotlight-title">Sample Clarity Insights Spotlight (Demo Scenarios)</h3>
          </div>
          <span className="spotlight-badge">DEMO DATA — Simulated Patterns</span>
        </div>

        <div className="spotlight-grid">
          {/* Spotlight Card 1: Cryptic Authorization */}
          <div 
            className="spotlight-card"
            onClick={() => {
              const uberTx = transactions.find(t => t.id === "7UB3104928172");
              if (uberTx) onSelectTransaction(uberTx);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="spotlight-card-top">
              <span className="spotlight-tag tag-amber">Temporary Pre-Authorization</span>
              <span className="spotlight-amount">$32.50 USD</span>
            </div>
            <h4 className="spotlight-card-name">Uber Technologies Inc.</h4>
            <code className="spotlight-raw">PAYPAL *UBER TRIP TEMP-AUTH SF CA</code>
            <p className="spotlight-desc">
              Customer thought they were double billed. Copilot clarified the $32.50 was a pre-auth hold that will adjust to the final $26.40 fare automatically.
            </p>
            <div className="spotlight-card-footer">
              <span className="spotlight-action">Inspect Clarity Breakdown</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Spotlight Card 2: eCheck Clearing */}
          <div 
            className="spotlight-card"
            onClick={() => {
              const echeckTx = transactions.find(t => t.id === "4TR9182301948");
              if (echeckTx) onSelectTransaction(echeckTx);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="spotlight-card-top">
              <span className="spotlight-tag tag-blue">ACH Banking Delay</span>
              <span className="spotlight-amount">$145.20 USD</span>
            </div>
            <h4 className="spotlight-card-name">Artisan Woodcraft Supply</h4>
            <code className="spotlight-raw">PAYPAL *ECHECK-CLEARING AMZN-SUPPLIER</code>
            <p className="spotlight-desc">
              Electronic checks take 3-5 business days across the Federal Reserve ACH network. Copilot guided the buyer not to make a duplicate payment.
            </p>
            <div className="spotlight-card-footer">
              <span className="spotlight-action">Inspect Clarity Breakdown</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Spotlight Card 3: Seller Hold */}
          <div 
            className="spotlight-card"
            onClick={() => {
              const sellerTx = transactions.find(t => t.id === "3WH5801928472");
              if (sellerTx) onSelectTransaction(sellerTx);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="spotlight-card-top">
              <span className="spotlight-tag tag-purple">Seller Reserve Policy</span>
              <span className="spotlight-amount">+$580.00 USD</span>
            </div>
            <h4 className="spotlight-card-name">Vintage Horology Group</h4>
            <code className="spotlight-raw">PAYPAL *EBAY-COLLECTIBLE VINTAGE-WATCH</code>
            <p className="spotlight-desc">
              Funds are held under PayPal 21-day seller protection. Copilot advised the seller to upload USPS tracking to unlock funds 24 hours post-delivery.
            </p>
            <div className="spotlight-card-footer">
              <span className="spotlight-action">Inspect Clarity Breakdown</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <TransactionTable 
        transactions={transactions}
        onSelectTransaction={onSelectTransaction}
        onClarifyTransaction={onClarifyTransaction}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        showFilters={true}
        limit={6}
      />
    </div>
  );
}

export default DashboardView;
