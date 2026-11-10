export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  trendDirection = "up", 
  variant = "default",
  badge
}) {
  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {icon && <div className="stat-card-icon-wrap">{icon}</div>}
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value-row">
          <span className="stat-card-value">{value}</span>
          {badge && <span className="stat-card-badge">{badge}</span>}
        </div>

        {(subtitle || trend) && (
          <div className="stat-card-footer">
            {trend && (
              <span className={`stat-trend stat-trend-${trendDirection}`}>
                {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '•'} {trend}
              </span>
            )}
            {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
