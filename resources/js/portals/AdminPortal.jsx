import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { activeStatuses, money } from "../utils";
import { AddressBlock, Logo, StatusBadge, ThemeControl } from "../components/shared";
import { AdminReports } from "./admin/AdminReports";

export function AdminPortal({ orders, riders, assignRider, reportData, reviewPaymentStatus, selectedOrderId, setSelectedOrderId, themeProps }) {
  const [page, setPage] = useState("dashboard");
  const [assignmentOrder, setAssignmentOrder] = useState(null);
  const [orderFilters, setOrderFilters] = useState({
    search: "",
    status: "all",
    paymentStatus: "all",
    riderId: "all",
  });
  const [riderFilters, setRiderFilters] = useState({
    search: "",
    status: "all",
  });
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const filteredOrders = useMemo(
    () => orders.filter((order) => {
      const searchText = `${order.id} ${order.client} ${order.clientPhone} ${order.receiver} ${order.receiverPhone} ${order.pickup} ${order.destination}`.toLowerCase();

      return (
        (!orderFilters.search || searchText.includes(orderFilters.search.toLowerCase())) &&
        (orderFilters.status === "all" || order.status === orderFilters.status) &&
        (orderFilters.paymentStatus === "all" || order.paymentStatus === orderFilters.paymentStatus) &&
        (orderFilters.riderId === "all" || order.riderId === orderFilters.riderId)
      );
    }),
    [orderFilters, orders],
  );
  const filteredRiders = useMemo(
    () => riders.filter((rider) => {
      const searchText = `${rider.id} ${rider.name} ${rider.phone} ${rider.area}`.toLowerCase();

      return (
        (!riderFilters.search || searchText.includes(riderFilters.search.toLowerCase())) &&
        (riderFilters.status === "all" || rider.status === riderFilters.status)
      );
    }),
    [riderFilters, riders],
  );
  const stats = [
    ["New requests", orders.filter((order) => order.status === "pending").length, "box", "+2 since 9 AM"],
    ["Active deliveries", orders.filter((order) => activeStatuses.has(order.status)).length, "navigation", "Live operations"],
    ["Available riders", riders.filter((rider) => rider.status === "available").length, "bike", `${riders.length} total riders`],
    ["Pending payments", orders.filter((order) => order.paymentStatus === "pending_approval").length, "card", "Needs review"],
    ["Today's income", "86,500", "chart", "MMK collected"],
  ];
  const nav = [
    ["dashboard", "grid", "Dashboard"],
    ["orders", "box", "Orders"],
    ["riders", "bike", "Riders"],
    ["payments", "card", "Payments"],
    ["tracking", "mapPin", "Tracking map"],
    ["reports", "chart", "Reports"],
    ["settings", "settings", "Settings"],
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar glass">
        <Logo />
        <nav>
          {nav.map(([value, icon, label]) => (
            <button className={page === value ? "active" : ""} key={value} onClick={() => setPage(value)} type="button">
              <Icon name={icon} size={17} /> {label}
              {value === "payments" && <small>1</small>}
            </button>
          ))}
        </nav>
        <div className="admin-profile"><span>MA</span><div><strong>May Aye</strong><small>Office admin</small></div></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar glass">
          <div className="global-search"><Icon name="search" size={17} /><input placeholder="Search order, rider, phone..." /></div>
          <div className="topbar-actions">
            <ThemeControl {...themeProps} />
            <button className="icon-btn notification-btn" type="button"><Icon name="bell" /><span /></button>
          </div>
        </header>
        <div className="admin-content">
          <div className="admin-page-heading">
            <div><p className="eyebrow">TUESDAY, 02 JUNE</p><h1>{page === "dashboard" ? "Operations overview" : nav.find(([value]) => value === page)?.[2]}</h1></div>
            <button className="btn primary" onClick={() => setPage("orders")} type="button"><Icon name="plus" size={16} /> New delivery</button>
          </div>
          {page === "dashboard" && (
            <>
              <section className="metrics-grid">
                {stats.map(([label, value, icon, note]) => (
                  <article className="metric-card glass" key={label}><span><Icon name={icon} size={17} /></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article>
                ))}
              </section>
              <section className="admin-grid">
                <div className="panel wide glass">
                  <PanelHeading title="Live order queue" eyebrow="OPERATIONS" action="View all orders" />
                  <OrderTable orders={orders} riders={riders} selectOrder={setSelectedOrderId} />
                </div>
                <div className="panel glass">
                  <PanelHeading title="Rider availability" eyebrow="TEAM STATUS" action="View riders" />
                  <RiderSummary riders={riders} />
                </div>
                <div className="panel map-panel glass">
                  <PanelHeading title="Live rider map" eyebrow="LOCATION" action="Open tracking map" />
                  <AdminMap riders={riders} />
                </div>
                <div className="panel glass">
                  <PanelHeading title="Attention needed" eyebrow="ALERTS" />
                  <div className="alert-list">
                    <div><span className="alert-icon warning"><Icon name="card" size={15} /></span><p><strong>Payment awaiting review</strong><small>FD-240621 - 4 min ago</small></p></div>
                    <div><span className="alert-icon info"><Icon name="bike" size={15} /></span><p><strong>Rider location updated</strong><small>Aung Kyaw - 1 min ago</small></p></div>
                  </div>
                </div>
              </section>
            </>
          )}
          {page === "orders" && (
            <section className="panel glass">
              <PanelHeading title="All delivery orders" eyebrow="ORDER MANAGEMENT" action="Export" />
              <OrderFilters filters={orderFilters} onChange={setOrderFilters} riders={riders} />
              <OrderTable orders={filteredOrders} riders={riders} selectOrder={setSelectedOrderId} />
            </section>
          )}
          {page === "riders" && <RidersAdmin filters={riderFilters} onFilterChange={setRiderFilters} riders={filteredRiders} />}
          {page === "payments" && <PaymentsAdmin orders={orders} onReview={reviewPaymentStatus} />}
          {page === "tracking" && <section className="panel full-map glass"><PanelHeading title="Live rider tracking" eyebrow="REAL-TIME MAP" /><AdminMap riders={riders} large /></section>}
          {page === "reports" && <AdminReports orders={orders} reportData={reportData} riders={riders} />}
          {!["dashboard", "orders", "riders", "payments", "tracking", "reports"].includes(page) && <AdminPlaceholder page={page} />}
        </div>
      </main>
      {selectedOrder && (
        <OrderDrawer
          close={() => setSelectedOrderId(null)}
          onAssign={() => setAssignmentOrder(selectedOrder)}
          order={selectedOrder}
          riders={riders}
        />
      )}
      {assignmentOrder && (
        <AssignmentModal
          close={() => setAssignmentOrder(null)}
          onAssign={(riderId) => {
            assignRider(assignmentOrder.id, riderId);
            setAssignmentOrder(null);
          }}
          order={assignmentOrder}
          riders={riders}
        />
      )}
    </div>
  );
}

function PanelHeading({ eyebrow, title, action }) {
  return (
    <div className="panel-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {action && <button className="text-btn" type="button">{action}</button>}
    </div>
  );
}

function OrderFilters({ filters, onChange, riders }) {
  const statuses = ["pending", "approved", "rider_assigned", "going_to_pickup", "picked_up", "delivered", "completed", "failed", "cancelled"];
  const paymentStatuses = ["unpaid", "pending_approval", "paid", "rejected"];
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="filter-toolbar">
      <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} placeholder="Search order, phone, receiver..." value={filters.search} /></div>
      <select onChange={(event) => update("status", event.target.value)} value={filters.status}>
        <option value="all">All statuses</option>
        {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select>
      <select onChange={(event) => update("paymentStatus", event.target.value)} value={filters.paymentStatus}>
        <option value="all">All payments</option>
        {paymentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select>
      <select onChange={(event) => update("riderId", event.target.value)} value={filters.riderId}>
        <option value="all">All riders</option>
        {riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
      </select>
    </div>
  );
}

function OrderTable({ orders, riders, selectOrder }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Order</th><th>Client</th><th>Route</th><th>Rider</th><th>Payment</th><th>Status</th><th>Updated</th><th /></tr></thead>
        <tbody>
          {orders.map((order) => {
            const rider = riders.find((item) => item.id === order.riderId);
            return (
              <tr key={order.id} onClick={() => selectOrder(order.id)}>
                <td><strong>{order.id}</strong><small>{order.createdAt}</small></td>
                <td><strong>{order.client}</strong><small>{order.clientPhone}</small></td>
                <td><strong>{order.pickup.split(",")[0]} -&gt; {order.destination.split(",")[0]}</strong><small>{money(order.cod)} COD</small></td>
                <td>{rider ? <span className="rider-cell"><i>{rider.initials}</i>{rider.name}</span> : <span className="muted">Unassigned</span>}</td>
                <td><StatusBadge status={order.paymentStatus} /></td>
                <td><StatusBadge status={order.status} /></td>
                <td><small>{order.updatedAt}</small></td>
                <td><button className="icon-btn small" type="button"><Icon name="more" size={15} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RiderSummary({ riders }) {
  return <div className="rider-summary">{riders.slice(0, 4).map((rider) => <div key={rider.id}><span className="avatar">{rider.initials}</span><p><strong>{rider.name}</strong><small>{rider.area} - {rider.lastSeen}</small></p><StatusBadge status={rider.status} /></div>)}</div>;
}

function RidersAdmin({ filters, onFilterChange, riders }) {
  const update = (key, value) => onFilterChange({ ...filters, [key]: value });

  return (
    <section className="panel glass">
      <PanelHeading eyebrow="TEAM MANAGEMENT" title="Riders" action="Add rider" />
      <div className="filter-toolbar compact">
        <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} placeholder="Search rider, phone, area..." value={filters.search} /></div>
        <select onChange={(event) => update("status", event.target.value)} value={filters.status}>
          <option value="all">All availability</option>
          {["available", "busy", "online", "offline", "on_break"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Active orders</th><th>Current area</th><th>Last GPS update</th><th>Cash held</th></tr></thead><tbody>
        {riders.map((rider) => <tr key={rider.id}><td><span className="rider-cell"><i>{rider.initials}</i><span><strong>{rider.name}</strong><small>{rider.phone}</small></span></span></td><td><StatusBadge status={rider.status} /></td><td>{rider.activeOrders}</td><td>{rider.area}</td><td>{rider.lastSeen}</td><td><strong>{money(rider.cashHeld)}</strong></td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function PaymentsAdmin({ orders, onReview }) {
  const paymentOrders = orders.filter((order) => order.paymentMethod === "Mobile Banking" || order.paymentStatus === "pending_approval");

  return (
    <section className="panel glass">
      <PanelHeading eyebrow="PAYMENT APPROVAL" title="Mobile banking reviews" action={`${paymentOrders.filter((order) => order.paymentStatus === "pending_approval").length} pending`} />
      <div className="payment-review-grid">
        <div className="payment-queue">
          {paymentOrders.length === 0 && <p className="muted">No mobile banking payments need review.</p>}
          {paymentOrders.map((order) => (
            <article className="payment-review-row" key={order.id}>
              <div>
                <strong>{order.id}</strong>
                <small>{order.client} - {order.createdAt}</small>
                {order.paymentReviewedAt && <small>Reviewed {order.paymentReviewedAt}</small>}
                {order.paymentNote && <small>{order.paymentNote}</small>}
              </div>
              <span>{money(order.fee)}</span>
              <StatusBadge status={order.paymentStatus} />
              <div className="row-actions">
                <button
                  className="btn secondary"
                  disabled={order.paymentStatus !== "pending_approval"}
                  onClick={() => onReview(order.id, "rejected")}
                  type="button"
                >
                  Reject
                </button>
                <button
                  className="btn primary"
                  disabled={order.paymentStatus !== "pending_approval"}
                  onClick={() => onReview(order.id, "paid")}
                  type="button"
                >
                  Approve
                </button>
              </div>
            </article>
          ))}
        </div>
        <aside className="payment-review-panel">
          <p className="eyebrow">REVIEW GUIDE</p>
          <h3>Check amount and sender reference</h3>
          <p>Approve only after the transfer amount matches the delivery fee. Rejected payments require client follow-up before assignment can continue.</p>
        </aside>
      </div>
    </section>
  );
}

function AdminMap({ riders, large = false }) {
  return (
    <div className={`admin-map ${large ? "large" : ""}`}>
      <div className="map-road one" /><div className="map-road two" /><div className="map-road three" /><div className="map-road four" />
      {riders.slice(0, 4).map((rider, index) => <span className={`rider-pin pin-${index + 1}`} key={rider.id}><Icon name="bike" size={14} /><small>{rider.name}</small></span>)}
    </div>
  );
}

function OrderDrawer({ order, riders, close, onAssign }) {
  const rider = riders.find((item) => item.id === order.riderId);
  return (
    <aside className="drawer glass">
      <div className="drawer-header"><div><p className="eyebrow">ORDER DETAIL</p><h2>{order.id}</h2></div><button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button></div>
      <StatusBadge status={order.status} />
      <AddressBlock from={order.pickup} to={order.destination} />
      <section><p className="eyebrow">CONTACTS</p><div className="detail-row"><span>Pickup</span><strong>{order.pickupContact}</strong></div><div className="detail-row"><span>Receiver</span><strong>{order.receiver}</strong></div></section>
      <section><p className="eyebrow">PACKAGE & PAYMENT</p><div className="detail-row"><span>Product</span><strong>{order.product}</strong></div><div className="detail-row"><span>Delivery fee</span><strong>{money(order.fee)}</strong></div><div className="detail-row"><span>Product COD</span><strong>{money(order.cod)}</strong></div></section>
      <section><p className="eyebrow">RIDER ASSIGNMENT</p>{rider ? <div className="assigned-rider"><span className="avatar">{rider.initials}</span><div><strong>{rider.name}</strong><small>{rider.phone} - {rider.vehicle}</small></div></div> : <p className="muted">No rider assigned yet.</p>}</section>
      <div className="drawer-actions"><button className="btn secondary" type="button">Add note</button><button className="btn primary grow" onClick={onAssign} type="button"><Icon name="bike" size={16} /> {rider ? "Change rider" : "Assign rider"}</button></div>
    </aside>
  );
}

function AssignmentModal({ order, riders, close, onAssign }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="modal-backdrop">
      <section className="assignment-modal glass">
        <div className="drawer-header"><div><p className="eyebrow">MANUAL ASSIGNMENT</p><h2>Assign rider</h2><small>{order.id} - Pickup from {order.pickup.split(",")[0]}</small></div><button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button></div>
        <div className="search-box"><Icon name="search" size={16} /><input placeholder="Search rider by name or area" /></div>
        <div className="assignment-list">
          {riders.map((rider) => (
            <button className={selected === rider.id ? "selected" : ""} disabled={rider.status === "offline"} key={rider.id} onClick={() => setSelected(rider.id)} type="button">
              <span className="avatar">{rider.initials}</span><span><strong>{rider.name}</strong><small>{rider.area} - {rider.activeOrders} active - {rider.lastSeen}</small></span><StatusBadge status={rider.status} />
            </button>
          ))}
        </div>
        <div className="drawer-actions"><button className="btn secondary" onClick={close} type="button">Cancel</button><button className="btn primary grow" disabled={!selected} onClick={() => onAssign(selected)} type="button">Confirm assignment <Icon name="check" size={16} /></button></div>
      </section>
    </div>
  );
}

function AdminPlaceholder({ page }) {
  return <section className="panel placeholder admin-placeholder glass"><span><Icon name="settings" size={23} /></span><h2>{page.replace(/\b\w/g, (letter) => letter.toUpperCase())}</h2><p>This module is staged for the next roadmap milestone.</p></section>;
}
