import { 
  SparklesIcon, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  SearchIcon,
  ShieldCheckIcon,
  InfoIcon
} from './icons/Icons';
import StatusBadge from './StatusBadge';

export function TransactionTable({ 
  transactions = [], 
  onSelectTransaction, 
  onClarifyTransaction,
  activeFilter = 'ALL',
  onFilterChange,
  showFilters = true,
  limit
}) {
  const filteredList = transactions.filter(tx => {
    if (activeFilter === 'ALL') return true;
    return tx.status.toUpperCase() === activeFilter.toUpperCase();
  });

  const displayList = limit ? filteredList.slice(0, limit) : filteredList;

  const counts = {
    all: transactions.length,
    completed: transactions.filter(t => t.status === 'Completed').length,
    pending: transactions.filter(t => t.status === 'Pending').length,
    failed: transactions.filter(t => t.status === 'Failed').length,
  };

  return (
    <div className="transaction-table-card">
      {/* Table Header & Filter Bar */}
      <div className="table-card-header">
        <div className="table-header-title-group">
          <div className="table-title-row">
            <h3 className="table-title">Recent Transactions</h3>
            <span className="demo-table-pill" title="All transaction records are synthetic sandbox data">
              DEMO DATA
            </span>
          </div>
          <p className="table-subtitle">
            Every transaction is pre-analyzed with AI statement decoding and safe resolution guidance
          </p>
        </div>

        {showFilters && (
          <div className="table-filters-pill-group">
            <button
              type="button"
              onClick={() => onFilterChange('ALL')}
              className={`filter-pill-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
            >
              <span>All</span>
              <span className="pill-count">{counts.all}</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('COMPLETED')}
              className={`filter-pill-btn ${activeFilter === 'COMPLETED' ? 'active' : ''}`}
            >
              <span className="pill-dot dot-completed"></span>
              <span>Completed</span>
              <span className="pill-count">{counts.completed}</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('PENDING')}
              className={`filter-pill-btn ${activeFilter === 'PENDING' ? 'active' : ''}`}
            >
              <span className="pill-dot dot-pending"></span>
              <span>Pending</span>
              <span className="pill-count">{counts.pending}</span>
            </button>

            <button
              type="button"
              onClick={() => onFilterChange('FAILED')}
              className={`filter-pill-btn ${activeFilter === 'FAILED' ? 'active' : ''}`}
            >
              <span className="pill-dot dot-failed"></span>
              <span>Failed</span>
              <span className="pill-count">{counts.failed}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="table-responsive-wrapper">
        <table className="transaction-table">
          <thead>
            <tr>
              <th className="th-tx">Transaction / Merchant</th>
              <th className="th-descriptor">Raw Bank Descriptor</th>
              <th className="th-date">Date & Time</th>
              <th className="th-status">Status</th>
              <th className="th-amount text-right">Amount</th>
              <th className="th-actions text-right">AI Clarity Action</th>
            </tr>
          </thead>
          <tbody>
            {displayList.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  <div className="table-empty-state">
                    <SearchIcon size={32} className="empty-icon" />
                    <h4>No transactions found</h4>
                    <p>No transactions match the selected filter criteria.</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayList.map((tx) => {
                const isDebit = tx.direction === 'debit';
                return (
                  <tr 
                    key={tx.id} 
                    className="table-row-item"
                    onClick={() => onSelectTransaction(tx)}
                  >
                    {/* Merchant & ID */}
                    <td className="td-merchant">
                      <div className="merchant-cell-wrapper">
                        <div className={`merchant-direction-icon ${isDebit ? 'is-debit' : 'is-credit'}`}>
                          {isDebit ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        </div>
                        <div className="merchant-cell-info">
                          <span className="merchant-primary-name">{tx.resolvedMerchant}</span>
                          <div className="merchant-id-sub">
                            <code className="tx-code-mini">{tx.id}</code>
                            <span className="merchant-cat-tag">{tx.merchantCategory?.split('&')[0]}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Raw Descriptor */}
                    <td className="td-descriptor">
                      <div className="raw-descriptor-cell">
                        <code className="raw-code" title={tx.rawDescriptor}>
                          {tx.rawDescriptor}
                        </code>
                        <span className="clarity-insight-snippet">
                          {tx.aiExplanation?.headline?.slice(0, 48)}...
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="td-date">
                      <span className="date-main">{tx.dateFormatted}</span>
                      <span className="payment-method-sub">
                        {tx.paymentMethod?.brand} {tx.paymentMethod?.last4 !== 'N/A' && `•••• ${tx.paymentMethod?.last4}`}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="td-status">
                      <StatusBadge status={tx.status} />
                    </td>

                    {/* Amount */}
                    <td className="td-amount text-right">
                      <div className="amount-cell-wrapper">
                        <span className={`amount-value ${isDebit ? 'amount-debit' : 'amount-credit'}`}>
                          {isDebit ? '-' : '+'}${tx.amount.toFixed(2)}
                        </span>
                        <span className="amount-currency">{tx.currency}</span>
                      </div>
                    </td>

                    {/* AI Clarity Actions */}
                    <td className="td-actions text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions-group">
                        <button
                          type="button"
                          onClick={() => onClarifyTransaction(tx)}
                          className="table-action-clarify-btn"
                          title="Open AI explanation for this transaction"
                        >
                          <SparklesIcon size={14} />
                          <span>Clarify</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectTransaction(tx)}
                          className="table-action-inspect-btn"
                          title="Inspect ledger details"
                        >
                          <span>Details</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="table-card-footer">
        <div className="footer-left">
          <InfoIcon size={14} />
          <span>Showing {displayList.length} of {transactions.length} sandbox transactions</span>
        </div>
        <div className="footer-right">
          <span className="footer-shield-tag">
            <ShieldCheckIcon size={13} />
            <span>AI Dispute Guard Active</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default TransactionTable;
