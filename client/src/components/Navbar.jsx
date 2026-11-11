import { PayPalLogo, SparklesIcon, SearchIcon, ShieldCheckIcon } from './icons/Icons';

export function Navbar({ 
  searchQuery, 
  setSearchQuery, 
  onSelectTab, 
  mobileMenuOpen, 
  setMobileMenuOpen,
  onOpenCreatePayment 
}) {
  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand / Logo */}
        <div className="navbar-left">
          <button 
            type="button"
            className="navbar-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={Boolean(mobileMenuOpen)}
            aria-controls="primary-sidebar"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          <div
            className="navbar-brand"
            onClick={() => onSelectTab('dashboard')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTab('dashboard');
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="navbar-logo-badge">
              <PayPalLogo size={28} />
            </div>
            <div className="navbar-title-group">
              <div className="navbar-brand-row">
                <span className="navbar-brand-name">PayPal</span>
                <span className="navbar-brand-accent">Clarity</span>
                <span className="copilot-pill">
                  <SparklesIcon size={12} />
                  <span>COPILOT</span>
                </span>
              </div>
              <span className="navbar-subtitle">AI Transaction Intelligence</span>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="navbar-center">
          <div className="search-bar-wrapper">
            <SearchIcon size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by transaction ID, merchant, descriptor, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="navbar-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="search-clear-btn"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Status / User actions */}
        <div className="navbar-right">
          {/* Create Sandbox Payment Action */}
          <button
            type="button"
            onClick={onOpenCreatePayment}
            className="navbar-create-payment-btn"
            title="Create a real PayPal Sandbox order via backend API"
          >
            <PayPalLogo size={16} />
            <span>Create Sandbox Payment</span>
          </button>

          {/* AI Status Badge */}
          <div className="ai-engine-status" title="Gemini AI runs on-demand when you query /api/copilot/explain">
            <span className="status-pulse-dot"></span>
            <div className="ai-status-text">
              <span className="ai-status-label">AI Engine</span>
              <span className="ai-status-engine">Gemini (On-Demand)</span>
            </div>
          </div>

          {/* Sandbox Indicator */}
          <div className="sandbox-indicator-pill" title="Sandbox mode - real funds disabled">
            <ShieldCheckIcon size={15} />
            <span>Sandbox Mode</span>
          </div>

          {/* User Profile Chip */}
          <div className="user-profile-chip" title="Alex Morgan (Sandbox Tester)">
            <div className="user-avatar">
              <span>AM</span>
            </div>
            <div className="user-info">
              <span className="user-name">Alex Morgan</span>
              <span className="user-tier">Sandbox Demo User</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
