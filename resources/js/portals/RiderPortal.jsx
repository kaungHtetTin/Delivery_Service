import { useState } from "react";
import { Icon } from "../icons";
import { deliveryFeeCashDue, formatDeliveryFeeLabel, money, useStoredState } from "../utils";
import { nextRiderActions } from "../data";
import { AddressBlock, MobileNav, MobilePlaceholder, MobileTopbar, NotificationList, StatusBadge } from "../components/shared";

const historyStatuses = new Set(["completed", "failed", "cancelled"]);

export function RiderPortal({ appName, markNotificationRead, notifications = [], orders, riders, progressOrder, themeProps }) {
  const [page, setPage] = useStoredState("flowdrop.rider.page", "jobs");
  const [selectedId, setSelectedId] = useStoredState("flowdrop.rider.selectedOrder", null);
  const rider = riders[0];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  if (!rider) {
    return (
      <div className="mobile-app rider-app">
        <MobileTopbar appName={appName} themeProps={themeProps} unreadCount={unreadCount} />
        <main className="mobile-content">
          <MobilePlaceholder icon="bike" title="No rider profile" />
        </main>
      </div>
    );
  }

  const riderOrders = orders.filter((order) => order.riderId === rider.id);
  const activeOrders = riderOrders.filter((order) => !historyStatuses.has(order.status));
  const historyOrders = riderOrders.filter((order) => historyStatuses.has(order.status));
  const selectedOrder = riderOrders.find((order) => order.id === selectedId);

  if (selectedOrder) {
    const isHistory = historyStatuses.has(selectedOrder.status);

    return (
      <div className="mobile-app rider-app">
        <MobileTopbar appName={appName} themeProps={themeProps} unreadCount={unreadCount} />
        <main className="mobile-content">
          <RiderJobDetail history={isHistory} onBack={() => setSelectedId(null)} onProgress={progressOrder} order={selectedOrder} />
        </main>
      </div>
    );
  }
  return (
    <div className="mobile-app rider-app">
      <MobileTopbar appName={appName} themeProps={themeProps} unreadCount={unreadCount} />
      <main className="mobile-content">
        {page === "jobs" && <RiderJobs onOpen={setSelectedId} orders={activeOrders} rider={rider} />}
        {page === "history" && <RiderHistory onOpen={setSelectedId} orders={historyOrders} />}
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
  const expectedDeliveryFees = orders.reduce((total, order) => total + deliveryFeeCashDue(order), 0);

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
        <div className="glass"><small>FEES TO COLLECT</small><strong>{money(expectedDeliveryFees)}</strong></div>
        <div className="glass"><small>PAY OFFICE</small><strong>{money(rider.cashHeld)}</strong></div>
      </section>
      <section className="section-block">
        <div className="section-heading"><div><span className="eyebrow">TODAY</span><h2>Active assignments</h2></div></div>
        <div className="delivery-list">
          {orders.length === 0 && <MobilePlaceholder icon="box" title="No active assignments" />}
          {orders.map((order) => (
            <button className="delivery-list-card rider-job glass" key={order.id} onClick={() => onOpen(order.id)} type="button">
              <div className="card-row"><span className="order-code">{order.id}</span><StatusBadge status={order.status} /></div>
              <AddressBlock from={order.pickup} to={order.destination} />
              <div className="job-meta">
                <span><Icon name="wallet" size={14} /> Delivery fee {formatDeliveryFeeLabel(order)}</span>
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

function RiderHistory({ onOpen, orders }) {
  const [filter, setFilter] = useStoredState("flowdrop.rider.historyFilter", "all");
  const filteredOrders = filter === "all" ? orders : orders.filter((order) => order.status === filter);
  const completedCount = orders.filter((order) => order.status === "completed").length;
  const deliveryFeesTotal = filteredOrders.reduce((total, order) => total + deliveryFeeCashDue(order), 0);

  return (
    <section className="page-section">
      <p className="eyebrow">PAST ASSIGNMENTS</p>
      <h1>Job history</h1>
      <section className="mini-metrics history-metrics">
        <div className="glass"><small>TOTAL JOBS</small><strong>{orders.length}</strong></div>
        <div className="glass"><small>COMPLETED</small><strong>{completedCount}</strong></div>
        <div className="glass"><small>DELIVERY FEES</small><strong>{money(deliveryFeesTotal)}</strong></div>
      </section>
      <div className="filter-pills">
        {[
          ["all", "All"],
          ["completed", "Completed"],
          ["failed", "Failed"],
          ["cancelled", "Cancelled"],
        ].map(([value, label]) => (
          <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} type="button">{label}</button>
        ))}
      </div>
      <div className="delivery-list">
        {filteredOrders.length === 0 && <MobilePlaceholder icon="clock" title="No matching history" />}
        {filteredOrders.map((order) => (
          <button className="delivery-list-card rider-job glass" key={order.id} onClick={() => onOpen(order.id)} type="button">
            <div className="card-row"><span className="order-code">{order.id}</span><StatusBadge status={order.status} /></div>
            <AddressBlock from={order.pickup} to={order.destination} />
            <div className="job-meta">
              <span><Icon name="wallet" size={14} /> Delivery fee {formatDeliveryFeeLabel(order)}</span>
              <span><Icon name="clock" size={14} /> {order.updatedAt}</span>
            </div>
            <span className="history-detail-link">View delivery details <Icon name="chevronRight" size={15} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RiderJobDetail({ history = false, order, onBack, onProgress }) {
  const [completing, setCompleting] = useState(false);
  const [feeInput, setFeeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const action = nextRiderActions[order.status];
  const isCompleteStep = action?.[1] === "completed";

  const handleAction = () => {
    if (!action) {
      return;
    }

    if (isCompleteStep) {
      setCompleting(true);
      return;
    }

    onProgress(order.id, action[1]);
  };

  const confirmComplete = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    await onProgress(order.id, "completed", Number(feeInput || 0));
    setSubmitting(false);
    setCompleting(false);
  };

  return (
    <section className="page-section rider-detail">
      <button className="back-btn" onClick={onBack} type="button"><Icon name="chevronLeft" size={17} /> {history ? "Job history" : "Active assignments"}</button>
      <div className="card-row">
        <div><p className="eyebrow">{history ? "DELIVERY RECORD" : "ACTIVE ASSIGNMENT"}</p><h1>{order.id}</h1></div>
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
        <div><small>DELIVERY FEE</small><strong>{formatDeliveryFeeLabel(order)}</strong></div>
        {history && <div><small>LAST UPDATED</small><strong>{order.updatedAt}</strong></div>}
        {order.fragile && <p className="warning-note">Fragile item - Handle with care</p>}
      </section>
      {!history && isCompleteStep && (
        <section className="cash-note glass">
          <span><Icon name="wallet" size={18} /></span>
          <div>
            <strong>Collect delivery fee in cash</strong>
            <small>Enter the final amount when you complete this order.</small>
          </div>
        </section>
      )}
      {!history && (
        <div className="sticky-actions glass">
          <button className="btn secondary" type="button"><Icon name="more" size={16} /> Issue</button>
          <button className="btn primary grow" disabled={!action} onClick={handleAction} type="button">
            {action ? action[0] : "Workflow complete"} <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}
      {completing && (
        <div className="modal-backdrop">
          <form className="operation-modal glass rider-complete-modal" onSubmit={confirmComplete}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">COMPLETE DELIVERY</p>
                <h2>Final delivery fee</h2>
              </div>
              <button className="icon-btn" onClick={() => setCompleting(false)} type="button"><Icon name="close" /></button>
            </div>
            <p className="muted">Enter the cash amount collected from the client for this delivery.</p>
            <label className="field-label">Delivery fee (MMK)</label>
            <input
              autoFocus
              className="text-input"
              inputMode="numeric"
              min="0"
              onChange={(event) => setFeeInput(event.target.value)}
              placeholder="e.g. 3000"
              required
              type="number"
              value={feeInput}
            />
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setCompleting(false)} type="button">Cancel</button>
              <button className="btn primary grow" disabled={submitting} type="submit">
                {submitting ? "Saving..." : "Complete order"} <Icon name="check" size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
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
