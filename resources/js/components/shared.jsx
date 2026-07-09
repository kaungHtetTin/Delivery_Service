import { Icon } from "../icons";
import { statusLabels } from "../data";

export function StatusBadge({ status }) {
  const family = ["completed", "delivered", "paid", "available"].includes(status)
    ? "success"
    : ["failed", "cancelled", "rejected"].includes(status)
      ? "danger"
      : ["pending", "pending_approval", "unpaid"].includes(status)
        ? "warning"
        : ["offline"].includes(status)
          ? "neutral"
          : "info";
  const label =
    statusLabels[status] ||
    status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <span className={`status status-${family}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

export function Logo({ appIconUrl = "", appName = "FlowDrop", compact = false }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        {appIconUrl
          ? <img alt="" src={appIconUrl} />
          : <Icon name="navigation" size={17} />}
      </span>
      {!compact && (
        <span>
          <strong>{appName}</strong>
          <small>DELIVERY</small>
        </span>
      )}
    </div>
  );
}

export function DayNightToggle({ onChange, theme = "light" }) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      className="icon-btn"
      onClick={() => onChange?.(nextTheme)}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

function countBadgeLabel(count) {
  return count > 99 ? "99+" : String(count);
}

export function MobileTopbar({ appIconUrl = "", appName, onNotifications, onThemeChange, theme = "light", title, unreadCount = 0 }) {
  return (
    <header className="mobile-topbar glass">
      <Logo appIconUrl={appIconUrl} appName={appName} />
      {title && <span className="topbar-title">{title}</span>}
      <div className="topbar-actions">
        <DayNightToggle onChange={onThemeChange} theme={theme} />
        <button aria-label="Notifications" className="icon-btn notification-btn" onClick={onNotifications} type="button">
          <Icon name="bell" />
          {unreadCount > 0 && <span>{countBadgeLabel(unreadCount)}</span>}
        </button>
      </div>
    </header>
  );
}

export function MobileNav({ active, onNavigate, items }) {
  return (
    <nav className="mobile-nav glass">
      {items.map(([value, icon, label, prominent, badgeCount = 0]) => (
        <button
          className={`${active === value ? "active" : ""} ${prominent ? "prominent" : ""}`}
          key={value}
          onClick={() => onNavigate(value)}
          type="button"
        >
          <span className="nav-icon">
            <Icon name={icon} size={prominent ? 21 : 18} />
            {badgeCount > 0 && <span className="nav-badge">{countBadgeLabel(badgeCount)}</span>}
          </span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

export function AddressBlock({ from, to }) {
  return (
    <div className="route">
      <span className="route-line" />
      <div>
        <span className="route-marker pickup" />
        <small>Pickup</small>
        <strong>{from}</strong>
      </div>
      <div>
        <span className="route-marker destination" />
        <small>Deliver to</small>
        <strong>{to}</strong>
      </div>
    </div>
  );
}

export function MobilePlaceholder({ icon, message = "Nothing to show here yet.", title }) {
  return (
    <section className="placeholder">
      <span><Icon name={icon} size={23} /></span>
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

export function NotificationList({ notifications = [], onRead, title = "Notifications" }) {
  if (!notifications.length) {
    return (
      <section className="page-section">
        <p className="eyebrow">ALERTS</p>
        <h1>{title}</h1>
        <div className="placeholder compact-placeholder glass">
          <span><Icon name="bell" size={23} /></span>
          <h2>No alerts yet</h2>
          <p>Delivery updates will appear here when your order is reviewed, a rider is assigned, or the delivery status changes.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <p className="eyebrow">ALERTS</p>
      <h1>{title}</h1>
      <div className="compact-list glass">
        {notifications.map((notification) => (
          <button
            className={`compact-row notification-row ${notification.readAt ? "" : "unread"}`}
            key={notification.id}
            onClick={() => !notification.readAt && onRead?.(notification.id)}
            type="button"
          >
            <span className="row-icon"><Icon name="bell" size={16} /></span>
            <span className="row-content">
              <strong>{notification.title}</strong>
              <small>{notification.body}</small>
              <small>{notification.orderCode} - {notification.createdAt}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CreatorSourceBadge({ compact = false, type = "office" }) {
  const isClient = type === "client";
  const label = isClient ? "Client" : "Office";

  return (
    <span
      className={`creator-source-badge ${compact ? "compact" : ""} ${isClient ? "client" : "office"}`}
      title={label}
    >
      <Icon name={isClient ? "user" : "settings"} size={12} />
      {!compact && label}
      {compact && <span>{isClient ? "C" : "O"}</span>}
    </span>
  );
}

export function formatOrderCreator(order) {
  const isClient = order.creatorType === "client";

  return {
    isClient,
    badge: isClient ? "client" : "office",
    title: isClient ? order.creatorAccountName || order.client : order.client || "Office entry",
    meta: isClient
      ? [order.creatorAccountPhone || order.clientPhone, order.creatorAccountEmail].filter(Boolean).join(" · ")
      : "Entered manually by office staff",
    accountName: order.creatorAccountName || "",
    requesterName: order.client,
    requesterPhone: order.clientPhone,
  };
}
