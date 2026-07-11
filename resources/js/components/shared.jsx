import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { statusLabels } from "../data";

const defaultInfinitePageSize = 10;

export function useInfiniteList(items = [], { pageSize = defaultInfinitePageSize, resetKey = "" } = {}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const total = items.length;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, resetKey]);

  const visibleItems = useMemo(
    () => items.slice(0, Math.min(visibleCount, total)),
    [items, total, visibleCount],
  );
  const hasMore = visibleItems.length < total;
  const loadMore = () => {
    setVisibleCount((current) => Math.min(current + pageSize, total));
  };

  return {
    hasMore,
    loadMore,
    showing: visibleItems.length,
    total,
    visibleItems,
  };
}

export function InfiniteListFooter({ hasMore, label = "Load more", onLoadMore, showing = 0, total = 0 }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !markerRef.current || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore?.();
        }
      },
      { rootMargin: "180px 0px" },
    );

    observer.observe(markerRef.current);

    return () => observer.disconnect();
  }, [hasMore, onLoadMore, showing, total]);

  if (!hasMore) {
    return null;
  }

  return (
    <div className="infinite-list-footer" ref={markerRef}>
      <button className="btn secondary full" onClick={onLoadMore} type="button">
        {label}
      </button>
      <small>{showing} of {total}</small>
    </div>
  );
}

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

export function SocketStatusBadge({ status = "disconnected" }) {
  const connected = status === "connected";
  const label = connected ? "Socket online" : "Socket offline";

  return (
    <span
      aria-label={label}
      className={`socket-status-badge ${connected ? "connected" : "disconnected"}`}
      title={label}
    >
      <span />
      Socket
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

export function MobileTopbar({ appIconUrl = "", appName, onNotifications, onRefresh, onThemeChange, socketStatus = "disconnected", theme = "light", title, unreadCount = 0 }) {
  return (
    <header className="mobile-topbar glass">
      <Logo appIconUrl={appIconUrl} appName={appName} />
      {title && <span className="topbar-title">{title}</span>}
      <div className="topbar-actions">
        <SocketStatusBadge status={socketStatus} />
        {onRefresh && (
          <button aria-label="Refresh" className="icon-btn" onClick={onRefresh} title="Refresh" type="button">
            <Icon name="refresh" />
          </button>
        )}
        <DayNightToggle onChange={onThemeChange} theme={theme} />
        {onNotifications && (
          <button aria-label="Notifications" className="icon-btn notification-btn" onClick={onNotifications} type="button">
            <Icon name="bell" />
            {unreadCount > 0 && <span>{countBadgeLabel(unreadCount)}</span>}
          </button>
        )}
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

function pushStatusContent(pushStatus) {
  if (!pushStatus) {
    return null;
  }

  const labels = {
    default: ["Push disabled", pushStatus.message],
    disabled: ["Push disabled", pushStatus.message],
    enabled: ["Push enabled", pushStatus.message || "Push alerts are enabled on this device."],
    working: ["Push alerts", pushStatus.message],
    unconfigured: ["Push not configured", pushStatus.message],
    blocked: ["Push blocked", pushStatus.message || "Allow notifications from browser site settings to enable alerts."],
    unsupported: ["Push unavailable", pushStatus.message],
    error: ["Push unavailable", pushStatus.message],
  };

  return labels[pushStatus.state] || null;
}

function socketHealthContent(socketStatus) {
  return socketStatus === "connected"
    ? {
        detail: "Realtime order updates are connected.",
        health: "available",
        label: "Online",
      }
    : {
        detail: "Realtime updates are offline. Use refresh if updates look stale.",
        health: "offline",
        label: "Offline",
      };
}

function pushHealthContent(pushStatus) {
  const state = pushStatus?.state || "default";
  const healthy = state === "enabled";
  const warning = ["default", "disabled", "working"].includes(state);
  const label =
    state === "enabled" ? "Enabled" :
      state === "blocked" ? "Blocked" :
        state === "working" ? "Checking" :
          state === "unconfigured" ? "Config needed" :
            state === "unsupported" ? "Unsupported" :
              state === "error" ? "Error" :
                "Disabled";

  return {
    detail: pushStatus?.message || (healthy ? "Push alerts are enabled on this device." : "Push alerts are not enabled on this device."),
    health: healthy ? "available" : warning ? "pending" : "failed",
    label,
  };
}

export function AccountHealthPanel({ pushStatus, socketStatus = "disconnected" }) {
  const socket = socketHealthContent(socketStatus);
  const push = pushHealthContent(pushStatus);

  return (
    <section className="account-health-panel glass">
      <div className="section-heading">
        <div><span className="eyebrow">HEALTH</span><h2>Connection status</h2></div>
      </div>
      <div className="compact-list">
        <div className="compact-row">
          <span className="row-icon"><Icon name="refresh" size={16} /></span>
          <span className="row-content"><strong>Socket server</strong><small>{socket.detail}</small></span>
          <StatusBadge status={socket.health} />
        </div>
        <div className="compact-row">
          <span className="row-icon"><Icon name="bell" size={16} /></span>
          <span className="row-content"><strong>Push notification</strong><small>{push.detail}</small></span>
          <StatusBadge status={push.health} />
        </div>
      </div>
    </section>
  );
}

export function NotificationList({ notifications = [], onDisablePush, onEnablePush, onRead, pushStatus, title = "Notifications" }) {
  const pushContent = pushStatusContent(pushStatus);
  const pagedNotifications = useInfiniteList(notifications, {
    pageSize: 12,
    resetKey: notifications.map((notification) => notification.id).join("|"),
  });
  const canEnablePush = ["default", "disabled", "error"].includes(pushStatus?.state);
  const canDisablePush = pushStatus?.state === "enabled";
  const pushPanel = pushContent && (
    <div className="push-alert-panel glass">
      <span><Icon name="bell" size={17} /></span>
      <div>
        <strong>{pushContent[0]}</strong>
        {pushContent[1] && <small>{pushContent[1]}</small>}
      </div>
      {canEnablePush && (
        <button className="btn secondary" onClick={onEnablePush} type="button">
          Enable
        </button>
      )}
      {canDisablePush && (
        <button className="btn secondary" onClick={onDisablePush} type="button">
          Disable
        </button>
      )}
    </div>
  );

  if (!notifications.length) {
    return (
      <section className="page-section">
        <p className="eyebrow">ALERTS</p>
        <h1>{title}</h1>
        {pushPanel}
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
      {pushPanel}
      <div className="compact-list glass">
        {pagedNotifications.visibleItems.map((notification) => (
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
      <InfiniteListFooter
        hasMore={pagedNotifications.hasMore}
        label="Load more alerts"
        onLoadMore={pagedNotifications.loadMore}
        showing={pagedNotifications.showing}
        total={pagedNotifications.total}
      />
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
