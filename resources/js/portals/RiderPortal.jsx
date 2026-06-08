import { useState } from "react";
import { Icon } from "../icons";
import { money } from "../utils";
import { nextRiderActions } from "../data";
import { AddressBlock, MobileNav, MobilePlaceholder, MobileTopbar, NotificationList, StatusBadge } from "../components/shared";

export function RiderPortal({ markNotificationRead, notifications = [], orders, riders, progressOrder, themeProps }) {
  const [page, setPage] = useState("jobs");
  const [selectedId, setSelectedId] = useState(null);
  const rider = riders[0];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  if (!rider) {
    return (
      <div className="mobile-app rider-app">
        <MobileTopbar themeProps={themeProps} unreadCount={unreadCount} />
        <main className="mobile-content">
          <MobilePlaceholder icon="bike" title="No rider profile" />
        </main>
      </div>
    );
  }

  const riderOrders = orders.filter((order) => order.riderId === rider.id);
  const selectedOrder = orders.find((order) => order.id === selectedId);

  if (selectedOrder) {
    return (
      <div className="mobile-app rider-app">
        <MobileTopbar themeProps={themeProps} unreadCount={unreadCount} />
        <main className="mobile-content">
          <RiderJobDetail onBack={() => setSelectedId(null)} onProgress={progressOrder} order={selectedOrder} />
        </main>
      </div>
    );
  }
  return (
    <div className="mobile-app rider-app">
      <MobileTopbar themeProps={themeProps} unreadCount={unreadCount} />
      <main className="mobile-content">
        {page === "jobs" && <RiderJobs onOpen={setSelectedId} orders={riderOrders} rider={rider} />}
        {page === "history" && <MobilePlaceholder icon="clock" title="Job history" />}
        {page === "gps" && <GpsStatus />}
        {page === "notifications" && <NotificationList notifications={notifications} onRead={markNotificationRead} title="Notifications" />}
        {page === "account" && <MobilePlaceholder icon="user" title="Rider account" />}
      </main>
      <MobileNav
        active={page}
        items={[
          ["jobs", "box", "Jobs"],
          ["history", "clock", "History"],
          ["gps", "location", "GPS"],
          ["notifications", "bell", "Alerts"],
          ["account", "user", "Account"],
        ]}
        onNavigate={setPage}
      />
    </div>
  );
}

function RiderJobs({ onOpen, orders, rider }) {
  return (
    <>
      <section className="rider-hero">
        <div>
          <p className="eyebrow">RIDER WORKSPACE</p>
          <h1>Good evening, {rider.name.split(" ")[0]}</h1>
          <p><span className="online-dot" /> GPS active - Updated just now</p>
        </div>
        <label className="availability">
          <small>AVAILABLE</small><input defaultChecked type="checkbox" /><i />
        </label>
      </section>
      <section className="mini-metrics">
        <div className="glass"><small>ACTIVE JOBS</small><strong>{orders.length}</strong></div>
        <div className="glass"><small>CASH HELD</small><strong>{money(rider.cashHeld)}</strong></div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Active assignments</h2></div></div>
        <div className="delivery-list">
          {orders.map((order) => (
            <button className="delivery-list-card rider-job glass" key={order.id} onClick={() => onOpen(order.id)} type="button">
              <div className="card-row"><span className="order-code">{order.id}</span><StatusBadge status={order.status} /></div>
              <AddressBlock from={order.pickup} to={order.destination} />
              <div className="job-meta">
                <span><Icon name="wallet" size={14} /> COD {money(order.cod)}</span>
                <span><Icon name="clock" size={14} /> {order.updatedAt}</span>
              </div>
              <span className="btn primary full">View next action <Icon name="arrowRight" size={16} /></span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function RiderJobDetail({ order, onBack, onProgress }) {
  const action = nextRiderActions[order.status];
  return (
    <section className="page-section rider-detail">
      <button className="back-btn" onClick={onBack} type="button"><Icon name="chevronLeft" size={17} /> Active assignments</button>
      <div className="card-row">
        <div><p className="eyebrow">ACTIVE ASSIGNMENT</p><h1>{order.id}</h1></div>
        <StatusBadge status={order.status} />
      </div>
      <section className="stop-card glass">
        <div className="stop-heading"><span className="route-marker pickup" /><p className="eyebrow">PICKUP</p></div>
        <h3>{order.pickupContact}</h3><p>{order.pickup}</p>
        <div className="action-grid">
          <button className="btn secondary" type="button"><Icon name="phone" size={15} /> Call</button>
          <button className="btn primary" type="button"><Icon name="navigation" size={15} /> Navigate</button>
        </div>
      </section>
      <section className="stop-card glass">
        <div className="stop-heading"><span className="route-marker destination" /><p className="eyebrow">DELIVERY</p></div>
        <h3>{order.receiver}</h3><p>{order.destination}</p>
        <div className="action-grid">
          <button className="btn secondary" type="button"><Icon name="phone" size={15} /> Call</button>
          <button className="btn primary" type="button"><Icon name="navigation" size={15} /> Navigate</button>
        </div>
      </section>
      <section className="order-summary glass">
        <div><small>PRODUCT</small><strong>{order.product}</strong></div>
        <div><small>COD TO COLLECT</small><strong>{money(order.cod)}</strong></div>
        {order.fragile && <p className="warning-note">Fragile item - Handle with care</p>}
      </section>
      <div className="sticky-actions glass">
        <button className="btn secondary" type="button"><Icon name="more" size={16} /> Issue</button>
        <button className="btn primary grow" disabled={!action} onClick={() => action && onProgress(order.id, action[1])} type="button">
          {action ? action[0] : "Workflow complete"} <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}

function GpsStatus() {
  return (
    <section className="page-section">
      <p className="eyebrow">TRACKING STATUS</p><h1>GPS location</h1>
      <div className="gps-visual glass"><span><Icon name="location" size={28} /></span><h2>GPS tracking is active</h2><p>Your location was sent just now.</p></div>
      <div className="compact-list glass">
        <div className="compact-row"><span className="row-icon"><Icon name="location" size={16} /></span><span className="row-content"><strong>Location permission</strong><small>Allowed while using the app</small></span><StatusBadge status="available" /></div>
        <div className="compact-row"><span className="row-icon"><Icon name="clock" size={16} /></span><span className="row-content"><strong>Update frequency</strong><small>Every 60 seconds during jobs</small></span></div>
      </div>
    </section>
  );
}
