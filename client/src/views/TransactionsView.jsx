import { useState, useMemo } from 'react';
import { 
  SearchIcon, 
  SparklesIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheckIcon,
  ChevronRight,
  InfoIcon,
  PayPalLogo
} from '../components/icons/Icons';
import StatusBadge from '../components/StatusBadge';

export function TransactionsView({ 
  transactions = [], 
  onSelectTransaction, 
  onClarifyTransaction,
  onOpenCreatePayment
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date-desc');
  const [search, setSearch] = useState('');
  const [selectedTxId, setSelectedTxId] = useState(transactions[0]?.id || null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Status filter
      if (statusFilter !== 'ALL' && tx.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      // Type filter
      if (typeFilter === 'DEBIT' && tx.direction !== 'debit') return false;
      if (typeFilter === 'CREDIT' && tx.direction !== 'credit') return false;
      if (typeFilter === 'SUBSCRIPTION' && tx.type !== 'subscription') return false;

      // Search match
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesId = tx.id.toLowerCase().includes(query);
        const matchesMerchant = tx.resolvedMerchant.toLowerCase().includes(query);
        const matchesDescriptor = tx.rawDescriptor.toLowerCase().includes(query);
        const matchesCategory = tx.merchantCategory.toLowerCase().includes(query);
        const matchesSummary = tx.aiExplanation?.claritySummary?.toLowerCase().includes(query);
        return matchesId || matchesMerchant || matchesDescriptor || matchesCategory || matchesSummary;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.date) - new Date(a.date);
      }
      if (sortBy === 'date-asc') {
        return new Date(a.date) - new Date(b.date);
      }
      if (sortBy === 'amount-high') {
        return b.amount - a.amount;
      }
      if (sortBy === 'amount-low') {
        return a.amount - b.amount;
      }
      return 0;
    });
  }, [transactions, statusFilter, typeFilter, sortBy, search]);

  const activeSelectedTx = transactions.find(t => t.id === selectedTxId) || filteredTransactions[0] || transactions[0];

  return (
    <div className="transactions-view">
      {/* Header Bar */}
      <div className="transactions-header-row">
        <div>
          <div className="flex-row-align gap-2">
            <h1 className="view-title">Transaction Ledger & AI Clarity</h1>
            <span className="demo-pill-small">SANDBOX SIMULATION</span>
          </div>
          <p className="view-subtitle">
            Inspect all simulated PayPal transactions with instant AI descriptor decoding and safe dispute-free next steps.
          </p>
        </div>

        <div className="view-header-actions">
          <button
            type="button"
            onClick={onOpenCreatePayment}
            className="view-create-payment-btn"
            title="Create real PayPal Sandbox order via backend API (POST /api/paypal/orders)"
          >
            <PayPalLogo size={15} />
            <span>Create Sandbox Payment</span>
          </button>
          <div className="view-summary-chip">
            <ShieldCheckIcon size={16} />
            <span>{filteredTransactions.length} of {transactions.length} Records</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="filter-controls-card">
        {/* Search input */}
        <div className="filter-search-box">
          <SearchIcon size={16} className="filter-search-icon" />
          <input
            type="text"
            placeholder="Filter by merchant, statement descriptor, or transaction ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="filter-search-input"
          />
          {search && (
            <button 
              type="button" 
              onClick={() => setSearch('')}
              className="filter-clear-btn"
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="filter-dropdowns-group">
          {/* Status select */}
          <div className="filter-select-wrapper">
            <label className="filter-label">Status:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Direction / Type */}
          <div className="filter-select-wrapper">
            <label className="filter-label">Type:</label>
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Types</option>
              <option value="DEBIT">Debits (Money Out)</option>
              <option value="CREDIT">Credits (Money In)</option>
              <option value="SUBSCRIPTION">Subscriptions</option>
            </select>
          </div>

          {/* Sort order */}
          <div className="filter-select-wrapper">
            <label className="filter-label">Sort By:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-high">Amount (High to Low)</option>
              <option value="amount-low">Amount (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Table on Left, Live Quick Clarity Inspector on Right */}
      <div className="transactions-split-layout">
        {/* Left Column: Transactions List */}
        <div className="transactions-list-column">
          <div className="transactions-scroll-card">
            {filteredTransactions.length === 0 ? (
              <div className="empty-results-box">
                <SearchIcon size={36} />
                <h4>No transactions match your filters</h4>
                <p>Try resetting the search query or status filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setTypeFilter('ALL');
                  }}
                  className="empty-reset-btn"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="transactions-custom-list">
                {filteredTransactions.map((tx) => {
                  const isSelected = activeSelectedTx?.id === tx.id;
                  const isDebit = tx.direction === 'debit';
                  return (
                    <div 
                      key={tx.id}
                      onClick={() => {
                        setSelectedTxId(tx.id);
                      }}
                      className={`tx-list-row ${isSelected ? 'row-selected' : ''}`}
                    >
                      <div className="tx-list-left">
                        <div className={`tx-list-direction ${isDebit ? 'is-debit' : 'is-credit'}`}>
                          {isDebit ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                        </div>
                        <div className="tx-list-info">
                          <div className="tx-list-title-row">
                            <span className="tx-list-merchant">{tx.resolvedMerchant}</span>
                            <StatusBadge status={tx.status} size="sm" />
                          </div>
                          <div className="tx-list-descriptor-row">
                            <code className="tx-list-code">{tx.rawDescriptor}</code>
                          </div>
                          <div className="tx-list-date-row">
                            <span>{tx.dateFormatted}</span>
                            <span>•</span>
                            <span>{tx.paymentMethod?.brand}</span>
                          </div>
                        </div>
                      </div>

                      <div className="tx-list-right">
                        <div className="tx-list-amount-col">
                          <span className={`tx-list-amount ${isDebit ? 'text-debit' : 'text-credit'}`}>
                            {isDebit ? '-' : '+'}${tx.amount.toFixed(2)}
                          </span>
                          <span className="tx-list-currency">{tx.currency}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTransaction(tx);
                          }}
                          className="tx-list-inspect-btn"
                          title="Open full inspection dialog"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Quick Clarity Inspector */}
        <div className="transactions-inspector-column">
          {activeSelectedTx ? (
            <div className="inspector-sticky-card">
              <div className="inspector-header">
                <div className="inspector-tag-row">
                  <span className="inspector-tag">
                    <SparklesIcon size={13} />
                    <span>Active Transaction Insight</span>
                  </span>
                  <span className="inspector-sandbox-badge">DEMO DATA</span>
                </div>
                <h3 className="inspector-merchant-title">{activeSelectedTx.resolvedMerchant}</h3>
                <div className="inspector-meta-row">
                  <code>{activeSelectedTx.id}</code>
                  <span>•</span>
                  <span>{activeSelectedTx.dateFormatted}</span>
                </div>
              </div>

              {/* Amount and Status banner */}
              <div className="inspector-hero-row">
                <div className="inspector-amount-block">
                  <span className="inspector-amount-label">Gross Amount</span>
                  <span className={`inspector-amount-value ${activeSelectedTx.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
                    {activeSelectedTx.direction === 'debit' ? '-' : '+'}${activeSelectedTx.amount.toFixed(2)} {activeSelectedTx.currency}
                  </span>
                </div>
                <div className="inspector-status-block">
                  <span className="inspector-status-label">Status</span>
                  <StatusBadge status={activeSelectedTx.status} size="md" />
                </div>
              </div>

              {/* Statement Descriptor Decoder Box */}
              <div className="inspector-section">
                <span className="inspector-section-label">Raw Card/Bank Statement String</span>
                <div className="inspector-descriptor-box">
                  <code>{activeSelectedTx.rawDescriptor}</code>
                </div>
              </div>

              {/* Plain English AI Explanation */}
              <div className="inspector-section">
                <div className="inspector-clarity-box">
                  <div className="inspector-clarity-badge">
                    <SparklesIcon size={13} />
                    <span>Plain-English Diagnosis</span>
                  </div>
                  <h4 className="inspector-clarity-head">{activeSelectedTx.aiExplanation?.headline}</h4>
                  <p className="inspector-clarity-desc">{activeSelectedTx.aiExplanation?.claritySummary}</p>
                </div>
              </div>

              {/* Top Safe Next Step */}
              {activeSelectedTx.safeNextSteps && activeSelectedTx.safeNextSteps.length > 0 && (
                <div className="inspector-section">
                  <span className="inspector-section-label">Top Safe Action</span>
                  <div className={`inspector-safe-step step-${activeSelectedTx.safeNextSteps[0].severity}`}>
                    <div className="step-badge-mini">1</div>
                    <div>
                      <div className="step-title-mini">{activeSelectedTx.safeNextSteps[0].title}</div>
                      <div className="step-desc-mini">{activeSelectedTx.safeNextSteps[0].description}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inspector Buttons */}
              <div className="inspector-actions-row">
                <button
                  type="button"
                  onClick={() => onSelectTransaction(activeSelectedTx)}
                  className="inspector-open-modal-btn"
                >
                  <span>Full Ledger & Protection</span>
                </button>

                <button
                  type="button"
                  onClick={() => onClarifyTransaction(activeSelectedTx)}
                  className="inspector-launch-chat-btn"
                >
                  <SparklesIcon size={14} />
                  <span>Ask Copilot</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="inspector-empty">
              <InfoIcon size={28} />
              <p>Select any transaction on the left to inspect its AI explanation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionsView;
