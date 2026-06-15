import { useState } from "react";
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

export function Logo({ appName = "FlowDrop", compact = false }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Icon name="navigation" size={17} />
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

export function ThemeControl({ theme, setTheme, brand, setBrand }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="theme-control">
      <button
        aria-label="Customize appearance"
        className="icon-btn"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Icon name="palette" />
      </button>
      {open && (
        <div className="theme-popover glass">
          <div className="popover-heading">
            <div>
              <strong>Appearance</strong>
              <small>Applied across every portal</small>
            </div>
            <button className="icon-btn small" onClick={() => setOpen(false)} type="button">
              <Icon name="close" size={15} />
            </button>
          </div>
          <label className="field-label">Theme mode</label>
          <div className="segmented">
            {[
              ["light", "sun", "Light"],
              ["dark", "moon", "Dark"],
            ].map(([value, icon, label]) => (
              <button
                className={theme === value ? "active" : ""}
                key={value}
                onClick={() => setTheme(value)}
                type="button"
              >
                <Icon name={icon} size={15} />
                {label}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="brand-color">
            Brand color
          </label>
          <div className="color-row">
            {["#087f74", "#2563eb", "#7c3aed", "#c2410c"].map((color) => (
              <button
                aria-label={`Use ${color} as brand color`}
                className={`color-swatch ${brand === color ? "selected" : ""}`}
                key={color}
                onClick={() => setBrand(color)}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
            <input
              aria-label="Custom brand color"
              id="brand-color"
              onChange={(event) => setBrand(event.target.value)}
              type="color"
              value={brand}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileTopbar({ appName, title, themeProps, unreadCount = 0 }) {
  return (
    <header className="mobile-topbar glass">
      <Logo appName={appName} />
      {title && <span className="topbar-title">{title}</span>}
      <div className="topbar-actions">
        <ThemeControl {...themeProps} />
        <button aria-label="Notifications" className="icon-btn notification-btn" type="button">
          <Icon name="bell" />
          {unreadCount > 0 && <span />}
        </button>
      </div>
    </header>
  );
}

export function MobileNav({ active, onNavigate, items }) {
  return (
    <nav className="mobile-nav glass">
      {items.map(([value, icon, label, prominent]) => (
        <button
          className={`${active === value ? "active" : ""} ${prominent ? "prominent" : ""}`}
          key={value}
          onClick={() => onNavigate(value)}
          type="button"
        >
          <span className="nav-icon">
            <Icon name={icon} size={prominent ? 21 : 18} />
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

export function CreatorSourceBadge({ type = "office" }) {
  const isClient = type === "client";

  return (
    <span className={`creator-source-badge ${isClient ? "client" : "office"}`}>
      <Icon name={isClient ? "user" : "settings"} size={12} />
      {isClient ? "Client" : "Office"}
    </span>
  );
}

export function formatOrderCreator(order) {
  const isClient = order.creatorType === "client";

  return {
    isClient,
    badge: isClient ? "client" : "office",
    title: isClient ? order.creatorAccountName || order.client : order.client,
    meta: isClient
      ? [order.creatorAccountPhone || order.clientPhone, order.creatorAccountEmail].filter(Boolean).join(" · ")
      : "Entered manually by office staff",
    accountName: order.creatorAccountName || "",
    requesterName: order.client,
    requesterPhone: order.clientPhone,
  };
}
