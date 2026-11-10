import { 
  DashboardIcon, 
  TransactionsIcon, 
  CopilotChatIcon, 
  SettingsIcon, 
  SparklesIcon, 
  ShieldCheckIcon,
  ChevronRight
} from './icons/Icons';

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  transactionsCount, 
  pendingCount,
  mobileMenuOpen,
  setMobileMenuOpen 
}) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon size={20} />,
      badge: null,
      desc: 'Overview & statistics'
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: <TransactionsIcon size={20} />,
      badge: transactionsCount,
      desc: 'Ledger & status tracking'
    },
    {
      id: 'copilot',
      label: 'AI Copilot',
      icon: <CopilotChatIcon size={20} />,
      badge: 'Live',
      badgeClass: 'badge-copilot',
      desc: 'Interactive explanation chat'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon size={20} />,
      badge: null,
      desc: 'Sandbox & safety preferences'
    }
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    if (setMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`sidebar-container ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-inner">
          {/* Navigation Section */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">MAIN NAVIGATION</div>
            <nav className="sidebar-nav">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="sidebar-nav-icon">{item.icon}</span>
                    <div className="sidebar-nav-labels">
                      <span className="sidebar-nav-title">{item.label}</span>
                      <span className="sidebar-nav-desc">{item.desc}</span>
                    </div>

                    {item.badge && (
                      <span className={`sidebar-badge ${item.badgeClass || ''}`}>
                        {item.badge}
                      </span>
                    )}

                    {isActive && <ChevronRight size={14} className="sidebar-active-indicator" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Context Summary */}
          <div className="sidebar-section quick-status-section">
            <div className="sidebar-section-header">SAFETY METRICS</div>
            <div className="sidebar-quick-card">
              <div className="quick-card-row">
                <span className="quick-card-label">Active Pending Holds</span>
                <span className="quick-card-value font-semibold text-amber">{pendingCount} items</span>
              </div>
              <div className="quick-card-progress">
                <div 
                  className="quick-card-bar" 
                  style={{ width: `${Math.min(100, (pendingCount / (transactionsCount || 1)) * 100)}%` }}
                ></div>
              </div>
              <p className="quick-card-note">
                All 3 pending holds explained with safe next steps before premature dispute.
              </p>
            </div>
          </div>

          {/* AI Clarity Guard Card */}
          <div className="sidebar-guard-card">
            <div className="guard-card-header">
              <div className="guard-icon-wrap">
                <ShieldCheckIcon size={18} />
              </div>
              <div>
                <span className="guard-title">Dispute Guard Active</span>
                <span className="guard-subtitle">AI Protection Layer</span>
              </div>
            </div>
            <p className="guard-text">
              Copilot resolves ambiguous card descriptors and explains clearing times to eliminate chargebacks.
            </p>
            <div className="guard-tag">
              <SparklesIcon size={12} />
              <span>18 Chargebacks Prevented</span>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <div className="sidebar-footer-row">
              <span className="footer-env-dot"></span>
              <span className="footer-env-text">PayPal AI Hackathon 2026</span>
            </div>
            <div className="sidebar-footer-version">v1.0.0 • Read-Only Simulator</div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
