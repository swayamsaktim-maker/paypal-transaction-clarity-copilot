import { CheckCircleIcon, ClockIcon, AlertCircleIcon } from './icons/Icons';

export function StatusBadge({ status, size = "md", showIcon = true }) {
  const norm = (status || '').toLowerCase();

  let config;
  if (norm === 'completed' || norm === 'settled' || norm === 'success') {
    config = {
      label: 'Completed',
      bg: 'status-badge-completed-bg',
      text: 'status-badge-completed-text',
      border: 'status-badge-completed-border',
      icon: <CheckCircleIcon size={size === 'sm' ? 14 : 16} />
    };
  } else if (norm === 'failed' || norm === 'declined' || norm === 'cancelled') {
    config = {
      label: 'Failed',
      bg: 'status-badge-failed-bg',
      text: 'status-badge-failed-text',
      border: 'status-badge-failed-border',
      icon: <AlertCircleIcon size={size === 'sm' ? 14 : 16} />
    };
  } else {
    // Default Pending
    config = {
      label: 'Pending',
      bg: 'status-badge-pending-bg',
      text: 'status-badge-pending-text',
      border: 'status-badge-pending-border',
      icon: <ClockIcon size={size === 'sm' ? 14 : 16} />
    };
  }

  const sizeClass = size === 'sm' 
    ? 'px-2 py-0.5 text-xs font-medium' 
    : size === 'lg' 
    ? 'px-3 py-1.5 text-sm font-semibold' 
    : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span 
      className={`status-badge ${config.bg} ${config.text} ${config.border} ${sizeClass} inline-flex items-center gap-1.5 rounded-full border shadow-xs transition-all`}
      title={`Transaction status: ${config.label}`}
    >
      {showIcon && <span className="status-badge-icon flex-shrink-0">{config.icon}</span>}
      <span className="status-badge-text tracking-wide">{config.label}</span>
    </span>
  );
}

export default StatusBadge;
