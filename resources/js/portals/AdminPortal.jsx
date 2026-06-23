import { useEffect, useMemo, useState, useCallback } from "react";
import { Icon } from "../icons";
import { formatSettingValue, searchCustomers, searchShops, settingValueForInput } from "../api";
import { activeStatuses, formatDeliveryFeeLabel, money, useStoredState } from "../utils";
import { AddressBlock, CreatorSourceBadge, formatOrderCreator, Logo, StatusBadge, ThemeControl } from "../components/shared";
import { SearchableRecordPicker } from "../components/SearchableRecordPicker";
import { AdminReports } from "./admin/AdminReports";

export function AdminPortal({
  appName = "FlowDrop Delivery",
  orders,
  riders,
  assignRider,
  cashCollections = [],
  customers = [],
  removeCashCollection,
  removeOrder,
  removeRider,
  removeSetting,
  removeUser,
  reportData,
  saveCashCollection,
  saveOrder,
  saveRider,
  saveSetting,
  saveUser,
  selectedOrderId,
  setSelectedOrderId,
  settings = [],
  shops = [],
  themeProps,
  users = [],
}) {
  const [page, setPage] = useStoredState("flowdrop.admin.page", "dashboard");
  const [assignmentOrder, setAssignmentOrder] = useState(null);
  const [orderEditor, setOrderEditor] = useState(null);
  const [riderEditor, setRiderEditor] = useState(null);
  const [cashEditor, setCashEditor] = useState(null);
  const [userEditor, setUserEditor] = useState(null);
  const [settingEditor, setSettingEditor] = useState(null);
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
  const activePage = page === "payments" ? "cash" : page;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const filteredOrders = useMemo(
    () => orders.filter((order) => {
      const searchText = `${order.id} ${order.creatorName || order.client} ${order.creatorPhone || order.clientPhone} ${order.creatorEmail || ""} ${order.receiver} ${order.receiverPhone} ${order.pickup} ${order.destination}`.toLowerCase();

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
  const totalCashHeld = riders.reduce((total, rider) => total + Number(rider.cashHeld || 0), 0);
  const totalCollectedFees = cashCollections.reduce((total, collection) => total + Number(collection.totalCashCollected || 0), 0);
  const currentOperationOrders = orders.filter((order) => !["completed", "failed", "cancelled"].includes(order.status));
  const stats = [
    ["New requests", orders.filter((order) => order.status === "pending").length, "box", "Waiting for review"],
    ["Active deliveries", orders.filter((order) => activeStatuses.has(order.status)).length, "navigation", "Live operations"],
    ["Available riders", riders.filter((rider) => rider.status === "available").length, "bike", `${riders.length} total riders`],
    ["Cash held", money(totalCashHeld), "wallet", "Delivery fees with riders"],
    ["Collected fees", money(totalCollectedFees), "chart", "Recorded collections"],
  ];
  const nav = [
    ["dashboard", "grid", "Dashboard"],
    ["orders", "box", "Orders"],
    ["riders", "bike", "Riders"],
    ["cash", "wallet", "Cash collections"],
    ["users", "lock", "Users"],
    ["tracking", "mapPin", "Tracking map"],
    ["reports", "chart", "Reports"],
    ["settings", "settings", "Settings"],
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar glass">
        <Logo appName={appName} />
        <nav>
          {nav.map(([value, icon, label]) => (
            <button className={activePage === value ? "active" : ""} key={value} onClick={() => setPage(value)} type="button">
              <Icon name={icon} size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="admin-profile"><span>MA</span><div><strong>May Aye</strong><small>Office admin</small></div></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar glass">
          <div className="global-search">
            <Icon name="search" size={17} />
            <input
              onChange={(event) => {
                setOrderFilters((current) => ({ ...current, search: event.target.value }));
                setPage("orders");
              }}
              placeholder="Search order, creator, phone..."
              value={orderFilters.search}
            />
          </div>
          <div className="topbar-actions">
            <ThemeControl {...themeProps} />
            <button className="icon-btn notification-btn" type="button"><Icon name="bell" /><span /></button>
          </div>
        </header>
        <div className="admin-content">
          <div className="admin-page-heading">
            <div><p className="eyebrow">TUESDAY, 02 JUNE</p><h1>{activePage === "dashboard" || activePage === "customers" ? "Operations overview" : nav.find(([value]) => value === activePage)?.[2]}</h1></div>
            <button className="btn primary" onClick={() => setOrderEditor({})} type="button"><Icon name="plus" size={16} /> New delivery</button>
          </div>
          {(activePage === "dashboard" || activePage === "customers") && (
            <>
              <section className="metrics-grid">
                {stats.map(([label, value, icon, note]) => (
                  <article className="metric-card glass" key={label}><span><Icon name={icon} size={17} /></span><small>{label}</small><strong>{value}</strong><p>{note}</p></article>
                ))}
              </section>
              <section className="admin-grid">
                <div className="panel wide glass">
                  <PanelHeading title="Current operation addresses" eyebrow="ACTIVE PICKUP & SHIPPING" />
                  <CurrentAddressBoard orders={currentOperationOrders} selectOrder={setSelectedOrderId} />
                </div>
                <div className="panel wide glass">
                  <PanelHeading title="Live order queue" eyebrow="OPERATIONS" action="View all orders" onAction={() => setPage("orders")} />
                  <OrderTable onDelete={removeOrder} onEdit={(order) => setOrderEditor(order)} orders={currentOperationOrders} riders={riders} selectOrder={setSelectedOrderId} />
                </div>
                <div className="panel glass">
                  <PanelHeading title="Rider availability" eyebrow="TEAM STATUS" action="View riders" onAction={() => setPage("riders")} />
                  <RiderSummary riders={riders} />
                </div>
                <div className="panel map-panel glass">
                  <PanelHeading title="Live rider map" eyebrow="LOCATION" action="Open tracking map" onAction={() => setPage("tracking")} />
                  <AdminMap riders={riders} />
                </div>
                <div className="panel glass">
                  <PanelHeading title="Attention needed" eyebrow="ALERTS" />
                  <div className="alert-list">
                    <div><span className="alert-icon info"><Icon name="bike" size={15} /></span><p><strong>Rider location updated</strong><small>Aung Kyaw - 1 min ago</small></p></div>
                    <div><span className="alert-icon info"><Icon name="wallet" size={15} /></span><p><strong>Delivery fees collected in cash</strong><small>Set by rider when completing delivery</small></p></div>
                  </div>
                </div>
              </section>
            </>
          )}
          {activePage === "orders" && (
            <section className="reports-layout">
              <div className="panel glass">
                <PanelHeading title="Current operation addresses" eyebrow="ACTIVE PICKUP & SHIPPING" />
                <CurrentAddressBoard orders={currentOperationOrders} selectOrder={setSelectedOrderId} />
              </div>
              <div className="panel glass">
                <PanelHeading title="All delivery orders" eyebrow="ORDER MANAGEMENT" action="Export" onAction={() => exportOrdersCsv(filteredOrders)} />
                <OrderFilters filters={orderFilters} onChange={setOrderFilters} riders={riders} />
                <OrderTable onDelete={removeOrder} onEdit={(order) => setOrderEditor(order)} orders={filteredOrders} riders={riders} selectOrder={setSelectedOrderId} />
              </div>
            </section>
          )}
          {activePage === "riders" && <RidersAdmin filters={riderFilters} onDelete={removeRider} onEdit={(rider) => setRiderEditor(rider)} onFilterChange={setRiderFilters} onNew={() => setRiderEditor({})} riders={filteredRiders} />}
          {activePage === "cash" && <CashCollectionsAdmin collections={cashCollections} onConfirm={(collection) => saveCashCollection({ ...collection, confirmed: true })} onDelete={removeCashCollection} onEdit={(collection) => setCashEditor(collection)} onNew={() => setCashEditor({})} orders={orders} riders={riders} />}
          {activePage === "users" && <UsersAdmin onDelete={removeUser} onEdit={(user) => setUserEditor(user)} onNew={() => setUserEditor({})} users={users} />}
          {activePage === "settings" && <SettingsAdmin onDelete={removeSetting} onEdit={(setting) => setSettingEditor(setting)} onNew={() => setSettingEditor({})} settings={settings} />}
          {activePage === "tracking" && <section className="panel full-map glass"><PanelHeading title="Live rider tracking" eyebrow="REAL-TIME MAP" /><AdminMap riders={riders} large /></section>}
          {activePage === "reports" && <AdminReports orders={orders} reportData={reportData} riders={riders} />}
          {!["dashboard", "orders", "riders", "cash", "customers", "users", "settings", "tracking", "reports"].includes(activePage) && <AdminPlaceholder page={activePage} />}
        </div>
      </main>
      {selectedOrder && (
        <OrderDrawer
          cashCollections={cashCollections}
          close={() => setSelectedOrderId(null)}
          onAssign={() => setAssignmentOrder(selectedOrder)}
          onCashCollectionSave={saveCashCollection}
          onOrderSave={saveOrder}
          onDelete={() => {
            removeOrder(selectedOrder.id);
            setSelectedOrderId(null);
          }}
          onEdit={() => setOrderEditor(selectedOrder)}
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
      {orderEditor && (
        <OrderEditorModal
          close={() => setOrderEditor(null)}
          onSave={(order) => saveOrder(order).then(() => setOrderEditor(null))}
          order={orderEditor}
        />
      )}
      {riderEditor && (
        <RiderEditorModal
          close={() => setRiderEditor(null)}
          onSave={(rider) => saveRider(rider).then(() => setRiderEditor(null))}
          rider={riderEditor}
        />
      )}
      {cashEditor && (
        <CashCollectionEditorModal
          close={() => setCashEditor(null)}
          collection={cashEditor}
          onSave={(collection) => saveCashCollection(collection).then(() => setCashEditor(null))}
          orders={orders}
          riders={riders}
        />
      )}
      {userEditor && <UserEditorModal close={() => setUserEditor(null)} onSave={(user) => saveUser(user).then(() => setUserEditor(null))} user={userEditor} />}
      {settingEditor && (
        <SettingEditorModal
          close={() => setSettingEditor(null)}
          onSave={(setting) => saveSetting(setting).then(() => setSettingEditor(null))}
          setting={settingEditor}
        />
      )}
    </div>
  );
}

function PanelHeading({ eyebrow, title, action, onAction }) {
  return (
    <div className="panel-heading">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      {action && <button className="text-btn" onClick={onAction} type="button">{action}</button>}
    </div>
  );
}

function exportOrdersCsv(orders) {
  const columns = [
    ["Order", (order) => order.id],
    ["Created at", (order) => order.createdAt],
    ["Created by", (order) => formatOrderCreator(order).title],
    ["Creator type", (order) => formatOrderCreator(order).badge],
    ["Requester phone", (order) => order.clientPhone],
    ["Receiver", (order) => order.receiver],
    ["Receiver phone", (order) => order.receiverPhone],
    ["Pickup", (order) => order.pickup],
    ["Delivery address", (order) => order.destination],
    ["Status", (order) => order.status],
    ["Fee status", (order) => order.paymentStatus],
    ["Rider", (order) => order.riderId || "Unassigned"],
    ["Delivery fee", (order) => order.fee],
    ["Product COD", (order) => (order.codEnabled ? "On" : "Off")],
    ["COD amount", (order) => order.cod || 0],
  ];
  const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [
    columns.map(([header]) => escapeCell(header)).join(","),
    ...orders.map((order) => columns.map(([, value]) => escapeCell(value(order))).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flowdrop-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function OrderFilters({ filters, onChange, riders }) {
  const statuses = ["pending", "approved", "rider_assigned", "going_to_pickup", "picked_up", "delivered", "completed", "failed", "cancelled"];
  const paymentStatuses = ["unpaid", "pending_approval", "paid", "rejected", "refunded"];
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="filter-toolbar">
      <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} placeholder="Search order, creator, phone, receiver..." value={filters.search} /></div>
      <select onChange={(event) => update("status", event.target.value)} value={filters.status}>
        <option value="all">All statuses</option>
        {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select>
      <select onChange={(event) => update("paymentStatus", event.target.value)} value={filters.paymentStatus}>
        <option value="all">All fee status</option>
        {paymentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select>
      <select onChange={(event) => update("riderId", event.target.value)} value={filters.riderId}>
        <option value="all">All riders</option>
        {riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
      </select>
    </div>
  );
}

function OrderTable({ onDelete, onEdit, orders, riders, selectOrder }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Order</th><th>Created by</th><th>Receiver</th><th>Route</th><th>Rider</th><th>Fee status</th><th>Status</th><th>Updated</th><th /></tr></thead>
        <tbody>
          {orders.map((order) => {
            const rider = riders.find((item) => item.id === order.riderId);
            const creator = formatOrderCreator(order);
            return (
              <tr key={order.id} onClick={() => selectOrder(order.id)}>
                <td><strong>{order.id}</strong><small>{order.createdAt}</small></td>
                <td>
                  <div className="creator-cell">
                    <CreatorSourceBadge compact type={creator.badge} />
                    <span>
                      <strong>{creator.title}</strong>
                      <small>{creator.meta}</small>
                    </span>
                  </div>
                </td>
                <td><strong>{order.receiver}</strong><small>{order.receiverPhone}</small></td>
                <td><strong>{order.pickup.split(",")[0]} -&gt; {order.destination.split(",")[0]}</strong><small>{formatDeliveryFeeLabel(order)}</small></td>
                <td>{rider ? <span className="rider-cell"><i>{rider.initials}</i>{rider.name}</span> : <span className="muted">Unassigned</span>}</td>
                <td><StatusBadge status={order.paymentStatus} /></td>
                <td><StatusBadge status={order.status} /></td>
                <td><small>{order.updatedAt}</small></td>
                <td>
                  <div className="inline-actions">
                    <button
                      className="icon-btn small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit?.(order);
                      }}
                      title="Edit order"
                      type="button"
                    >
                      <Icon name="settings" size={15} />
                    </button>
                    <button
                      className="icon-btn small danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`Delete ${order.id}?`)) {
                          onDelete?.(order.id);
                        }
                      }}
                      title="Delete order"
                      type="button"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {orders.length === 0 && <p className="muted table-empty">No delivery orders match the current filters.</p>}
    </div>
  );
}

function CurrentAddressBoard({ orders, selectOrder }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Created by</th>
            <th>Pickup address</th>
            <th>Shipping address</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const creator = formatOrderCreator(order);
            return (
            <tr key={order.id} onClick={() => selectOrder(order.id)}>
              <td><strong>{order.id}</strong><small>{order.createdAt}</small></td>
              <td>
                <div className="creator-cell">
                  <CreatorSourceBadge compact type={creator.badge} />
                  <span>
                    <strong>{creator.title}</strong>
                    <small>{creator.meta}</small>
                  </span>
                </div>
              </td>
              <td><strong>{order.pickupContact}</strong><small>{order.pickup}</small></td>
              <td><strong>{order.receiver}</strong><small>{order.destination}</small></td>
              <td><StatusBadge status={order.status} /></td>
            </tr>
            );
          })}
          {orders.length === 0 && (
            <tr>
              <td colSpan="5"><span className="muted">No active pickup or shipping addresses. Completed, failed, and cancelled orders are hidden here.</span></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RiderSummary({ riders }) {
  return <div className="rider-summary">{riders.slice(0, 4).map((rider) => <div key={rider.id}><span className="avatar">{rider.initials}</span><p><strong>{rider.name}</strong><small>{rider.area} - {rider.lastSeen}</small></p><StatusBadge status={rider.status} /></div>)}</div>;
}

function RidersAdmin({ filters, onDelete, onEdit, onFilterChange, onNew, riders }) {
  const update = (key, value) => onFilterChange({ ...filters, [key]: value });

  return (
    <section className="panel glass">
      <div className="panel-heading">
        <div><p className="eyebrow">TEAM MANAGEMENT</p><h2>Riders</h2></div>
        <button className="btn primary" onClick={onNew} type="button"><Icon name="plus" size={16} /> Add rider</button>
      </div>
      <div className="filter-toolbar compact">
        <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} placeholder="Search rider, phone, area..." value={filters.search} /></div>
        <select onChange={(event) => update("status", event.target.value)} value={filters.status}>
          <option value="all">All availability</option>
          {["available", "busy", "online", "offline", "on_break"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Active orders</th><th>Current area</th><th>Last GPS update</th><th>Delivery fees held</th><th /></tr></thead><tbody>
        {riders.map((rider) => (
          <tr key={rider.id}>
            <td><span className="rider-cell"><i>{rider.initials}</i><span><strong>{rider.name}</strong><small>{rider.phone}</small></span></span></td>
            <td><StatusBadge status={rider.status} /></td>
            <td>{rider.activeOrders}</td>
            <td>{rider.area}</td>
            <td>{rider.lastSeen}</td>
            <td><strong>{money(rider.cashHeld)}</strong></td>
            <td>
              <div className="inline-actions">
                <button className="icon-btn small" onClick={() => onEdit(rider)} title="Edit rider" type="button"><Icon name="settings" size={15} /></button>
                <button
                  className="icon-btn small danger"
                  onClick={() => window.confirm(`Delete ${rider.name}?`) && onDelete(rider.id)}
                  title="Delete rider"
                  type="button"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody></table></div>
    </section>
  );
}

function CashCollectionsAdmin({ collections, onConfirm, onDelete, onEdit, onNew, orders, riders }) {
  const [filters, setFilters] = useState({ status: "all", riderId: "all" });
  const filteredCollections = collections.filter((collection) => (
    (filters.status === "all" ||
      (filters.status === "confirmed" && collection.confirmedAt) ||
      (filters.status === "pending" && !collection.confirmedAt)) &&
    (filters.riderId === "all" || String(collection.riderApiId) === String(filters.riderId))
  ));
  const totalCollected = filteredCollections.reduce((total, collection) => total + Number(collection.totalCashCollected || 0), 0);
  const pendingCount = collections.filter((collection) => !collection.confirmedAt).length;
  const confirmedCount = collections.filter((collection) => collection.confirmedAt).length;
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <section className="panel glass">
      <div className="panel-heading">
        <div><p className="eyebrow">CASH COLLECTIONS</p><h2>Delivery fee collections</h2></div>
        <button className="btn primary" onClick={onNew} type="button"><Icon name="plus" size={16} /> Record cash</button>
      </div>
      <div className="cash-summary-grid">
        <div className="glass"><small>VISIBLE TOTAL</small><strong>{money(totalCollected)}</strong></div>
        <div className="glass"><small>PENDING</small><strong>{pendingCount}</strong></div>
        <div className="glass"><small>CONFIRMED</small><strong>{confirmedCount}</strong></div>
      </div>
      <div className="filter-toolbar cash-filters">
        <div className="search-box"><Icon name="wallet" size={16} /><input disabled value={`${filteredCollections.length} collection records`} /></div>
        <select onChange={(event) => update("status", event.target.value)} value={filters.status}>
          <option value="all">All confirmation states</option>
          <option value="pending">Pending confirmation</option>
          <option value="confirmed">Confirmed only</option>
        </select>
        <select onChange={(event) => update("riderId", event.target.value)} value={filters.riderId}>
          <option value="all">All riders</option>
          {riders.map((rider) => <option key={rider._apiId} value={rider._apiId}>{rider.name}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Order</th><th>Rider</th><th>Delivery fee</th><th>Note</th><th>Confirmed</th><th /></tr></thead>
          <tbody>
            {filteredCollections.map((collection) => (
              <tr key={collection.id}>
                <td><strong>{collection.orderCode}</strong><small>{collection.createdAt}</small></td>
                <td>{collection.riderName || riders.find((rider) => rider._apiId === collection.riderApiId)?.name || "Unassigned"}</td>
                <td><strong>{money(collection.deliveryFeeCollected)}</strong></td>
                <td>{collection.paymentNote || <span className="muted">No note</span>}</td>
                <td>{collection.confirmedAt ? <StatusBadge status="confirmed" /> : <StatusBadge status="pending" />}{collection.confirmedAt && <small>{collection.confirmedAt}</small>}</td>
                <td>
                  <div className="inline-actions">
                    {!collection.confirmedAt && (
                      <button
                        className="icon-btn small"
                        onClick={() => onConfirm(collection)}
                        title="Confirm collection"
                        type="button"
                      >
                        <Icon name="check" size={15} />
                      </button>
                    )}
                    <button className="icon-btn small" onClick={() => onEdit(collection)} title="Edit collection" type="button"><Icon name="settings" size={15} /></button>
                    <button
                      className="icon-btn small danger"
                      onClick={() => window.confirm(`Delete cash record for ${collection.orderCode}?`) && onDelete(collection.id)}
                      title="Delete collection"
                      type="button"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCollections.length === 0 && (
              <tr><td colSpan="6"><span className="muted">{collections.length === 0 ? "No delivery fee collections recorded yet. Use Record cash to create the first record." : "No cash collections match the current filters."}</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersAdmin({ onDelete, onEdit, onNew, users }) {
  return (
    <section className="panel glass">
      <div className="panel-heading">
        <div><p className="eyebrow">ACCESS CONTROL</p><h2>Users</h2></div>
        <button className="btn primary" onClick={onNew} type="button"><Icon name="plus" size={16} /> Add user</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Phone</th><th>Role</th><th>Created</th><th /></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.name}</strong><small>{user.email}</small></td>
                <td>{user.phone}</td>
                <td><StatusBadge status={user.role} /></td>
                <td>{user.createdAt}</td>
                <td><CrudActions label={user.name} onDelete={() => onDelete(user.id)} onEdit={() => onEdit(user)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomersShopsAdmin({ customers, onDeleteCustomer, onDeleteShop, onEditCustomer, onEditShop, onNewCustomer, onNewShop, shops }) {
  return (
    <section className="management-grid">
      <div className="panel glass">
        <div className="panel-heading">
          <div><p className="eyebrow">CLIENT DATA</p><h2>Clients</h2></div>
          <button className="btn primary" onClick={onNewCustomer} type="button"><Icon name="plus" size={16} /> Add client</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Type</th><th>Address</th><th>Orders</th><th /></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.name}</strong><small>{customer.phone}</small></td>
                  <td><StatusBadge status={customer.type} /></td>
                  <td>{customer.address || <span className="muted">No saved address</span>}</td>
                  <td>{customer.ordersCount}</td>
                  <td><CrudActions label={customer.name} onDelete={() => onDeleteCustomer(customer.id)} onEdit={() => onEditCustomer(customer)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel glass">
        <div className="panel-heading">
          <div><p className="eyebrow">PICKUP DATA</p><h2>Pickup addresses</h2></div>
          <button className="btn primary" onClick={onNewShop} type="button"><Icon name="plus" size={16} /> Add pickup</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pickup name</th><th>Owner/client</th><th>Status</th><th>Orders</th><th /></tr></thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop.id}>
                  <td><strong>{shop.name}</strong><small>{shop.phone}</small></td>
                  <td>{shop.customerName || <span className="muted">No owner</span>}</td>
                  <td>{shop.isDefault ? <StatusBadge status="default" /> : <StatusBadge status={shop.status} />}</td>
                  <td>{shop.ordersCount}</td>
                  <td><CrudActions label={shop.name} onDelete={() => onDeleteShop(shop.id)} onEdit={() => onEditShop(shop)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function SettingsAdmin({ onDelete, onEdit, onNew, settings }) {
  const [filters, setFilters] = useState({ search: "", group: "all" });
  const groups = useMemo(
    () => [...new Set(settings.map((setting) => setting.group || "general"))].sort(),
    [settings],
  );
  const filteredSettings = useMemo(
    () => settings.filter((setting) => {
      const searchText = `${setting.key} ${setting.group} ${formatSettingValue(setting.value)} ${setting.description || ""}`.toLowerCase();

      return (
        (!filters.search || searchText.includes(filters.search.toLowerCase())) &&
        (filters.group === "all" || setting.group === filters.group)
      );
    }),
    [filters, settings],
  );
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <section className="panel glass">
      <div className="panel-heading">
        <div><p className="eyebrow">SYSTEM CONFIGURATION</p><h2>Settings</h2></div>
        <button className="btn primary" onClick={onNew} type="button"><Icon name="plus" size={16} /> Add setting</button>
      </div>
      <div className="filter-toolbar compact">
        <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} placeholder="Search key, value, group..." value={filters.search} /></div>
        <select onChange={(event) => update("group", event.target.value)} value={filters.group}>
          <option value="all">All groups</option>
          {groups.map((group) => <option key={group} value={group}>{group}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Key</th><th>Value</th><th>Group</th><th>Description</th><th /></tr></thead>
          <tbody>
            {filteredSettings.map((setting) => (
              <tr key={setting._apiId || setting.key}>
                <td><strong>{setting.key}</strong></td>
                <td>{formatSettingValue(setting.value)}</td>
                <td>{setting.group}</td>
                <td>{setting.description || <span className="muted">No description</span>}</td>
                <td><CrudActions label={setting.key} onDelete={() => onDelete(setting.id)} onEdit={() => onEdit(setting)} /></td>
              </tr>
            ))}
            {filteredSettings.length === 0 && (
              <tr>
                <td colSpan="5">
                  <span className="muted">
                    {settings.length === 0
                      ? "No settings yet. Use Add setting to create app configuration values."
                      : "No settings match the current search or group filter."}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CrudActions({ label, onDelete, onEdit }) {
  return (
    <div className="inline-actions">
      <button className="icon-btn small" onClick={onEdit} title="Edit" type="button"><Icon name="settings" size={15} /></button>
      <button className="icon-btn small danger" onClick={() => window.confirm(`Delete ${label}?`) && onDelete()} title="Delete" type="button"><Icon name="close" size={15} /></button>
    </div>
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

function OrderDrawer({ cashCollections = [], order, riders, close, onAssign, onCashCollectionSave, onDelete, onEdit, onOrderSave }) {
  const rider = riders.find((item) => item.id === order.riderId);
  const cashCollection = cashCollections.find((collection) => Number(collection.orderApiId) === Number(order._apiId));
  const creator = formatOrderCreator(order);
  return (
    <aside className="drawer glass">
      <div className="drawer-header"><div><p className="eyebrow">ORDER DETAIL</p><h2>{order.id}</h2></div><button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button></div>
      <StatusBadge status={order.status} />
      <AddressBlock from={order.pickup} to={order.destination} />
      <section>
        <p className="eyebrow">ORDER CREATOR</p>
        <div className="detail-row">
          <span>Source</span>
          <strong><CreatorSourceBadge type={creator.badge} /></strong>
        </div>
        <div className="detail-row"><span>Account</span><strong>{creator.isClient ? creator.accountName : "Office entry"}</strong></div>
        <div className="detail-row"><span>Contact</span><strong>{creator.meta}</strong></div>
        {creator.isClient && creator.requesterName !== creator.accountName && (
          <div className="detail-row"><span>Requester on form</span><strong>{creator.requesterName}</strong></div>
        )}
      </section>
      <section>
        <p className="eyebrow">CONTACTS</p>
        <div className="detail-row"><span>Requester</span><strong>{order.client}</strong></div>
        <div className="detail-row"><span>Requester phone</span><strong>{order.clientPhone}</strong></div>
        <div className="detail-row"><span>Pickup</span><strong>{order.pickupContact}</strong></div>
        <div className="detail-row"><span>Pickup phone</span><strong>{order.pickupPhone}</strong></div>
        <div className="detail-row"><span>Receiver</span><strong>{order.receiver}</strong></div>
        <div className="detail-row"><span>Receiver phone</span><strong>{order.receiverPhone}</strong></div>
      </section>
      <section>
        <p className="eyebrow">PACKAGE & PAYMENT</p>
        <div className="detail-row"><span>Product</span><strong>{order.product}</strong></div>
        <div className="detail-row"><span>Delivery fee</span><strong>{formatDeliveryFeeLabel(order)}</strong></div>
        <div className="detail-row"><span>Fee payment</span><strong>{order.paymentMethod}</strong></div>
        <div className="detail-row"><span>Fee status</span><strong><StatusBadge status={order.paymentStatus} /></strong></div>
        <div className="detail-row">
          <span>Product COD</span>
          <strong>{order.codEnabled ? (Number(order.cod) > 0 ? `On - ${money(order.cod)}` : "On") : "Off"}</strong>
        </div>
      </section>
      <CashCollectionDrawerForm
        collection={cashCollection}
        onOrderSave={onOrderSave}
        onSave={onCashCollectionSave}
        order={order}
        rider={rider}
      />
      <section><p className="eyebrow">RIDER ASSIGNMENT</p>{rider ? <div className="assigned-rider"><span className="avatar">{rider.initials}</span><div><strong>{rider.name}</strong><small>{rider.phone} - {rider.vehicle}</small></div></div> : <p className="muted">No rider assigned yet.</p>}</section>
      <div className="drawer-actions">
        <button className="btn secondary" onClick={onEdit} type="button">Edit</button>
        <button className="btn danger" onClick={() => window.confirm(`Delete ${order.id}?`) && onDelete()} type="button">Delete</button>
        <button className="btn primary grow" onClick={onAssign} type="button"><Icon name="bike" size={16} /> {rider ? "Change rider" : "Assign rider"}</button>
      </div>
    </aside>
  );
}

function CashCollectionDrawerForm({ collection, onOrderSave, onSave, order, rider }) {
  const [form, setForm] = useState({
    codEnabled: Boolean(order.codEnabled),
    codAmount: order.cod || 0,
    deliveryFeeCollected: collection?.deliveryFeeCollected ?? order.fee ?? 0,
    paymentNote: collection?.paymentNote || "",
    confirmed: Boolean(collection?.confirmedAt),
  });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = (key, value) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    setForm({
      codEnabled: Boolean(order.codEnabled),
      codAmount: order.cod || 0,
      deliveryFeeCollected: collection?.deliveryFeeCollected ?? order.fee ?? 0,
      paymentNote: collection?.paymentNote || "",
      confirmed: Boolean(collection?.confirmedAt),
    });
    setSaved(false);
  }, [collection?._apiId, collection?.confirmedAt, collection?.deliveryFeeCollected, collection?.paymentNote, order._apiId, order.cod, order.codEnabled, order.fee]);

  const canRecordFee = order._apiId && (order.riderApiId || rider?._apiId);

  return (
    <section>
      <p className="eyebrow">DELIVERY FEE COLLECTION</p>
      {collection && (
        <div className="detail-row"><span>Recorded fee</span><strong>{money(collection.deliveryFeeCollected)}</strong></div>
      )}
      <form
        className="drawer-cash-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onOrderSave({
            ...order,
            codEnabled: form.codEnabled,
            cod: form.codEnabled ? Number(form.codAmount || 0) : 0,
          });
          if (canRecordFee) {
            await onSave({
              _apiId: collection?._apiId,
              id: collection?.id,
              orderApiId: order._apiId,
              riderApiId: order.riderApiId || rider?._apiId,
              deliveryFeeCollected: form.deliveryFeeCollected,
              paymentNote: form.paymentNote,
              confirmed: form.confirmed,
            });
          }
          setSubmitting(false);
          setSaved(true);
        }}
      >
        <label className="switch-row glass span-2">
          <span><strong>COD on</strong><small>Record product payment COD on this order only</small></span>
          <input
            checked={form.codEnabled}
            onChange={(event) => update("codEnabled", event.target.checked)}
            type="checkbox"
          />
          <i />
        </label>
        {form.codEnabled && (
          <label className="form-field span-2">
            <span>Payment COD amount</span>
            <input inputMode="numeric" onChange={(event) => update("codAmount", event.target.value)} value={form.codAmount} />
          </label>
        )}
        <label className="form-field span-2">
          <span>Delivery fee collected</span>
          <input inputMode="numeric" onChange={(event) => update("deliveryFeeCollected", event.target.value)} value={form.deliveryFeeCollected} />
        </label>
        {!canRecordFee && (
          <p className="muted span-2">Assign a rider before recording delivery fee collection.</p>
        )}
        <label className="form-field span-2">
          <span>Payment note</span>
          <input onChange={(event) => update("paymentNote", event.target.value)} value={form.paymentNote} />
        </label>
        <label className="switch-row glass span-2">
          <span><strong>Confirmed by office</strong><small>Marks the collection as checked</small></span>
          <input checked={form.confirmed} disabled={!canRecordFee} onChange={(event) => update("confirmed", event.target.checked)} type="checkbox" />
          <i />
        </label>
        <button className="btn primary span-2" disabled={submitting} type="submit">
          {submitting ? "Saving..." : "Save collection"}
        </button>
        {saved && <p className="muted span-2">Order payment details saved.</p>}
      </form>
    </section>
  );
}

function AssignmentModal({ order, riders, close, onAssign }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const assignableStatuses = new Set(["available", "online"]);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRiders = normalizedSearch
    ? riders.filter((rider) => [
        rider.name,
        rider.phone,
        rider.area,
        rider.status,
        rider.id,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)))
    : riders;

  return (
    <div className="modal-backdrop">
      <section className="assignment-modal glass">
        <div className="drawer-header"><div><p className="eyebrow">MANUAL ASSIGNMENT</p><h2>Assign rider</h2><small>{order.id} - Pickup from {order.pickup.split(",")[0]}</small></div><button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button></div>
        <label className="search-box assignment-search">
          <Icon name="search" size={16} />
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Search rider, phone, or area" value={search} />
        </label>
        <div className="assignment-list">
          {filteredRiders.length === 0 && <p className="muted assignment-empty">No riders match this search.</p>}
          {filteredRiders.map((rider) => (
            <button className={selected === rider.id ? "selected" : ""} disabled={!assignableStatuses.has(rider.status)} key={rider.id} onClick={() => setSelected(rider.id)} type="button">
              <span className="avatar">{rider.initials}</span><span><strong>{rider.name}</strong><small>{rider.area} - {rider.activeOrders} active - {assignableStatuses.has(rider.status) ? rider.lastSeen : "not available"}</small></span><StatusBadge status={rider.status} />
            </button>
          ))}
        </div>
        <div className="drawer-actions"><button className="btn secondary" onClick={close} type="button">Cancel</button><button className="btn primary grow" disabled={!selected} onClick={() => onAssign(selected)} type="button">Confirm assignment <Icon name="check" size={16} /></button></div>
      </section>
    </div>
  );
}

function OrderEditorModal({ close, onSave, order }) {
  const creator = formatOrderCreator(order);
  const isClientCreated = Boolean(order._apiId && creator.isClient);
  const isNewOrder = !order._apiId;
  const [form, setForm] = useState({
    _apiId: order._apiId,
    id: order.id,
    customerId: order.customerId || "",
    shopId: order.shopId || "",
    client: order.client || "",
    clientPhone: order.clientPhone || "",
    pickupContact: order.pickupContact || "",
    pickupPhone: order.pickupPhone || "",
    pickup: order.pickup || "",
    receiver: order.receiver || "",
    receiverPhone: order.receiverPhone || "",
    destination: order.destination || "",
    product: order.product || "",
    category: order.category || "Package",
    quantity: order.quantity || 1,
    fragile: Boolean(order.fragile),
    paymentMethod: order.paymentMethod || "Cash",
    fee: order.fee ?? "",
    codEnabled: Boolean(order.codEnabled),
    cod: order.cod ?? "",
    status: order.status || "pending",
    paymentStatus: order.paymentStatus || "unpaid",
    note: order.note || "",
    internalNote: order.internalNote || "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState(
    form.customerId
      ? { _apiId: form.customerId, name: order.customerName || order.client, phone: order.clientPhone }
      : null,
  );
  const [selectedShop, setSelectedShop] = useState(
    form.shopId
      ? { _apiId: form.shopId, name: order.shopName || order.pickupContact, phone: order.pickupPhone, address: order.pickup }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const searchClientRecords = useCallback(
    (search) => searchCustomers({ search, perPage: 15 }),
    [],
  );
  const searchPickupRecords = useCallback(
    (search) => searchShops({
      search,
      customerId: form.customerId || "",
      perPage: 15,
      status: "",
    }),
    [form.customerId],
  );

  const chooseCustomer = (customer) => {
    if (!customer) {
      setSelectedCustomer(null);
      setForm((current) => ({ ...current, customerId: "" }));
      return;
    }

    setSelectedCustomer(customer);
    setForm((current) => ({
      ...current,
      customerId: customer._apiId,
      client: customer.name || current.client,
      clientPhone: customer.phone || current.clientPhone,
      shopId: "",
      pickupContact: current.pickupContact,
      pickupPhone: current.pickupPhone,
      pickup: current.pickup,
    }));
    setSelectedShop(null);
  };

  const chooseShop = (shop) => {
    if (!shop) {
      setSelectedShop(null);
      setForm((current) => ({ ...current, shopId: "" }));
      return;
    }

    setSelectedShop(shop);
    setForm((current) => ({
      ...current,
      shopId: shop._apiId,
      pickupContact: shop.contactName || shop.name || current.pickupContact,
      pickupPhone: shop.phone || current.pickupPhone,
      pickup: shop.address || current.pickup,
    }));
  };

  const buildPayload = () => {
    if (!isNewOrder) {
      return form;
    }

    return {
      ...form,
      receiver: form.receiver || form.client,
      receiverPhone: form.receiverPhone || form.clientPhone,
      destination: form.destination || form.pickup,
    };
  };

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onSave(buildPayload());
          setSubmitting(false);
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">{isNewOrder ? "NEW ORDER" : "EDIT ORDER"}</p><h2>{form._apiId ? form.id : "Create delivery order"}</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="crud-grid">
          {!isClientCreated && (
            <div className="order-creator-inline span-2">
              <CreatorSourceBadge type="office" />
              <small>{isNewOrder ? "Office entry — add delivery details later if needed." : "Entered by office staff"}</small>
            </div>
          )}
          {isClientCreated && (
            <section className="order-creator-panel span-2 glass">
              <div className="creator-summary">
                <CreatorSourceBadge type="client" />
                <div>
                  <strong>{creator.accountName}</strong>
                  <small>{creator.meta}</small>
                </div>
              </div>
            </section>
          )}
          <section className="order-record-pickers span-2">
            <p className="eyebrow">QUICK FILL</p>
            <div className="record-picker-stack">
              <SearchableRecordPicker
                emptyHint="Search customer name, phone, or email."
                getOptionMeta={(customer) => [customer.phone, customer.email].filter(Boolean).join(" · ")}
                getOptionTitle={(customer) => customer.name}
                label="Customer record"
                onClear={() => chooseCustomer(null)}
                onSelect={chooseCustomer}
                placeholder="Search customer..."
                searchRecords={searchClientRecords}
                selectedMeta={selectedCustomer ? [selectedCustomer.phone, selectedCustomer.email].filter(Boolean).join(" · ") : ""}
                selectedTitle={selectedCustomer?.name || order.customerName}
                value={form.customerId}
              />
              <SearchableRecordPicker
                emptyHint="Search pickup name, phone, or address."
                getOptionMeta={(shop) => [shop.phone, shop.address].filter(Boolean).join(" · ")}
                getOptionTitle={(shop) => shop.name}
                label="Saved pickup address"
                onClear={() => chooseShop(null)}
                onSelect={chooseShop}
                placeholder="Search pickup..."
                searchRecords={searchPickupRecords}
                selectedMeta={selectedShop ? [selectedShop.phone, selectedShop.address].filter(Boolean).join(" · ") : ""}
                selectedTitle={selectedShop?.name || order.shopName || order.pickupContact}
                value={form.shopId}
              />
            </div>
          </section>
          <CrudField label="Requester name" onChange={(value) => update("client", value)} required value={form.client} />
          <CrudField label="Requester phone" onChange={(value) => update("clientPhone", value)} required value={form.clientPhone} />
          <CrudField label="Pickup contact" onChange={(value) => update("pickupContact", value)} required value={form.pickupContact} />
          <CrudField label="Pickup phone" onChange={(value) => update("pickupPhone", value)} required value={form.pickupPhone} />
          <CrudField className="span-2" label="Pickup address" onChange={(value) => update("pickup", value)} required value={form.pickup} />
          {!isNewOrder && (
            <>
              <CrudField label="Receiver" onChange={(value) => update("receiver", value)} required value={form.receiver} />
              <CrudField label="Receiver phone" onChange={(value) => update("receiverPhone", value)} required value={form.receiverPhone} />
              <CrudField className="span-2" label="Delivery address" onChange={(value) => update("destination", value)} required value={form.destination} />
            </>
          )}
          <CrudField label="Product" onChange={(value) => update("product", value)} required value={form.product} />
          <CrudField label="Category" onChange={(value) => update("category", value)} value={form.category} />
          <CrudField inputMode="numeric" label="Quantity" onChange={(value) => update("quantity", value)} value={form.quantity} />
          <label className="switch-row glass">
            <span><strong>Fragile item</strong><small>Mark package as fragile for handling</small></span>
            <input checked={form.fragile} onChange={(event) => update("fragile", event.target.checked)} type="checkbox" />
            <i />
          </label>
          <CrudSelect label="Fee payment" onChange={(value) => update("paymentMethod", value)} options={["Cash", "Banking"]} value={form.paymentMethod} />
          <CrudField inputMode="numeric" label="Delivery fee (optional)" onChange={(value) => update("fee", value)} placeholder="Rider sets final fee" value={form.fee} />
          <label className="switch-row glass">
            <span><strong>Product COD</strong><small>Rider collects product payment separately</small></span>
            <input checked={form.codEnabled} onChange={(event) => update("codEnabled", event.target.checked)} type="checkbox" />
            <i />
          </label>
          {form.codEnabled && (
            <CrudField inputMode="numeric" label="COD amount (MMK)" onChange={(value) => update("cod", value)} value={form.cod} />
          )}
          <CrudSelect label="Order status" onChange={(value) => update("status", value)} options={["pending", "approved", "rider_assigned", "rider_accepted", "going_to_pickup", "arrived_at_pickup", "picked_up", "going_to_delivery", "arrived_at_delivery", "delivered", "completed", "failed", "cancelled"]} value={form.status} />
          <CrudSelect label="Fee status" onChange={(value) => update("paymentStatus", value)} options={["unpaid", "paid"]} value={form.paymentStatus} />
          <CrudField className="span-2" label="Client note" onChange={(value) => update("note", value)} value={form.note} />
          <CrudField className="span-2" label="Internal note" onChange={(value) => update("internalNote", value)} value={form.internalNote} />
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={submitting} type="submit">{submitting ? "Saving..." : "Save order"}</button>
        </div>
      </form>
    </div>
  );
}

function RiderEditorModal({ close, onSave, rider }) {
  const [form, setForm] = useState({
    _apiId: rider._apiId,
    id: rider.id || `R-${String(Date.now()).slice(-4)}`,
    name: rider.name || "",
    phone: rider.phone || "",
    email: rider.email || "",
    status: rider.status || "available",
    vehicle: rider.vehicle || "Motorbike",
    area: rider.area || "",
    cashHeld: rider.cashHeld || 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal compact glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onSave(form);
          setSubmitting(false);
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">RIDER CRUD</p><h2>{form._apiId ? `Edit ${form.name}` : "Add rider"}</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="crud-grid">
          <CrudField label="Rider code" onChange={(value) => update("id", value)} required value={form.id} />
          <CrudField label="Name" onChange={(value) => update("name", value)} required value={form.name} />
          <CrudField label="Phone" onChange={(value) => update("phone", value)} required value={form.phone} />
          <CrudField label="Email" onChange={(value) => update("email", value)} value={form.email} />
          <CrudSelect label="Status" onChange={(value) => update("status", value)} options={["available", "online", "busy", "offline", "on_break", "suspended"]} value={form.status} />
          <CrudField label="Vehicle" onChange={(value) => update("vehicle", value)} value={form.vehicle} />
          <CrudField label="Current area" onChange={(value) => update("area", value)} value={form.area} />
          <CrudField inputMode="numeric" label="Delivery fees held" onChange={(value) => update("cashHeld", value)} value={form.cashHeld} />
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={submitting} type="submit">{submitting ? "Saving..." : "Save rider"}</button>
        </div>
      </form>
    </div>
  );
}

function CashCollectionEditorModal({ close, collection, onSave, orders, riders }) {
  const firstOrder = orders.find((order) => order._apiId);
  const firstRider = riders.find((rider) => rider._apiId);
  const [form, setForm] = useState({
    _apiId: collection._apiId,
    id: collection.id,
    orderApiId: collection.orderApiId || firstOrder?._apiId || "",
    riderApiId: collection.riderApiId || firstRider?._apiId || "",
    deliveryFeeCollected: collection.deliveryFeeCollected || 0,
    paymentNote: collection.paymentNote || "",
    confirmed: Boolean(collection.confirmedAt),
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal compact glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onSave(form);
          setSubmitting(false);
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">CASH CRUD</p><h2>{form._apiId ? "Edit fee record" : "Record delivery fee"}</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="crud-grid">
          <CrudSelect
            label="Order"
            onChange={(value) => update("orderApiId", Number(value))}
            options={orders.filter((order) => order._apiId).map((order) => [order._apiId, `${order.id} - ${order.receiver}`])}
            value={form.orderApiId}
          />
          <CrudSelect
            label="Rider"
            onChange={(value) => update("riderApiId", Number(value))}
            options={riders.filter((rider) => rider._apiId).map((rider) => [rider._apiId, rider.name])}
            value={form.riderApiId}
          />
          <CrudField inputMode="numeric" label="Delivery fee collected" onChange={(value) => update("deliveryFeeCollected", value)} value={form.deliveryFeeCollected} />
          <CrudField className="span-2" label="Payment note" onChange={(value) => update("paymentNote", value)} value={form.paymentNote} />
          <label className="switch-row glass span-2">
            <span><strong>Confirmed by office</strong><small>Marks the cash collection as checked</small></span>
            <input checked={form.confirmed} onChange={(event) => update("confirmed", event.target.checked)} type="checkbox" />
            <i />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={submitting || !form.orderApiId || !form.riderApiId} type="submit">{submitting ? "Saving..." : "Save collection"}</button>
        </div>
      </form>
    </div>
  );
}

function UserEditorModal({ close, onSave, user }) {
  const [form, setForm] = useState({
    _apiId: user._apiId,
    id: user.id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role || "client",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <CrudModal close={close} eyebrow="USER CRUD" onSave={onSave} setSubmitting={setSubmitting} submitting={submitting} title={form._apiId ? `Edit ${form.name}` : "Add user"} value={form}>
      <CrudField label="Name" onChange={(value) => update("name", value)} required value={form.name} />
      <CrudField label="Email" onChange={(value) => update("email", value)} required value={form.email} />
      <CrudField label="Phone" onChange={(value) => update("phone", value)} required value={form.phone} />
      <CrudSelect label="Role" onChange={(value) => update("role", value)} options={["client", "rider", "office_admin", "super_admin"]} value={form.role} />
      <CrudField className="span-2" label={form._apiId ? "New password" : "Password"} onChange={(value) => update("password", value)} required={!form._apiId} value={form.password} />
    </CrudModal>
  );
}

function CustomerEditorModal({ close, customer, onSave, users }) {
  const clientUsers = users.filter((user) => user.role === "client");
  const [form, setForm] = useState({
    _apiId: customer._apiId,
    id: customer.id,
    userId: customer.userId || "",
    name: customer.name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    type: customer.type || "individual",
    address: customer.address || "",
    note: customer.note || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <CrudModal close={close} eyebrow="CLIENT CRUD" onSave={onSave} setSubmitting={setSubmitting} submitting={submitting} title={form._apiId ? `Edit ${form.name}` : "Add client"} value={form}>
      <CrudSelect label="Linked client user" onChange={(value) => update("userId", value)} options={[["", "No linked user"], ...clientUsers.map((user) => [user._apiId, user.name])]} value={form.userId} />
      <CrudSelect label="Type" onChange={(value) => update("type", value)} options={["individual", "business"]} value={form.type} />
      <CrudField label="Name" onChange={(value) => update("name", value)} required value={form.name} />
      <CrudField label="Phone" onChange={(value) => update("phone", value)} required value={form.phone} />
      <CrudField label="Email" onChange={(value) => update("email", value)} value={form.email} />
      <CrudField label="Address" onChange={(value) => update("address", value)} value={form.address} />
      <CrudField className="span-2" label="Note" onChange={(value) => update("note", value)} value={form.note} />
    </CrudModal>
  );
}

function ShopEditorModal({ close, customers, onSave, shop }) {
  const [form, setForm] = useState({
    _apiId: shop._apiId,
    id: shop.id,
    customerId: shop.customerId || "",
    name: shop.name || "",
    contactName: shop.contactName || "",
    phone: shop.phone || "",
    email: shop.email || "",
    address: shop.address || "",
    status: shop.status || "active",
    isDefault: shop.isDefault ?? false,
    note: shop.note || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <CrudModal close={close} eyebrow="PICKUP CRUD" onSave={onSave} setSubmitting={setSubmitting} submitting={submitting} title={form._apiId ? `Edit ${form.name}` : "Add pickup address"} value={form}>
      <CrudSelect label="Owner/client" onChange={(value) => update("customerId", value)} options={[["", "No owner"], ...customers.map((customer) => [customer._apiId, customer.name])]} value={form.customerId} />
      <CrudSelect label="Status" onChange={(value) => update("status", value)} options={["active", "inactive", "suspended"]} value={form.status} />
      <CrudField label="Pickup name" onChange={(value) => update("name", value)} required value={form.name} />
      <CrudField label="Contact name" onChange={(value) => update("contactName", value)} value={form.contactName} />
      <CrudField label="Phone" onChange={(value) => update("phone", value)} required value={form.phone} />
      <CrudField label="Email" onChange={(value) => update("email", value)} value={form.email} />
      <CrudField className="span-2" label="Address" onChange={(value) => update("address", value)} required value={form.address} />
      <label className="switch-row glass">
        <span><strong>Default pickup</strong><small>Use first for this owner's shop requests</small></span>
        <input checked={form.isDefault} onChange={(event) => update("isDefault", event.target.checked)} type="checkbox" />
        <i />
      </label>
      <CrudField className="span-2" label="Note" onChange={(value) => update("note", value)} value={form.note} />
    </CrudModal>
  );
}

function SettingEditorModal({ close, onSave, setting }) {
  const [form, setForm] = useState({
    _apiId: setting._apiId,
    id: setting.id,
    key: setting.key || "",
    value: settingValueForInput(setting.value),
    group: setting.group || "general",
    description: setting.description || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => {
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (value) => {
    setError("");

    try {
      await onSave(value);
    } catch (saveError) {
      setError(
        saveError?.payload?.message ||
        Object.values(saveError?.payload?.errors || {})?.[0]?.[0] ||
        saveError?.message ||
        "Could not save setting.",
      );
      throw saveError;
    }
  };

  return (
    <CrudModal close={close} error={error} eyebrow="SETTING CRUD" onSave={handleSave} setSubmitting={setSubmitting} submitting={submitting} title={form._apiId ? `Edit ${form.key}` : "Add setting"} value={form}>
      <CrudField disabled={Boolean(form._apiId)} label="Key" onChange={(value) => update("key", value)} required value={form.key} />
      {form.key === "brand_color" ? (
        <label className="form-field">
          <span>Value</span>
          <div className="color-row">
            <input aria-label="Brand color" onChange={(event) => update("value", event.target.value)} type="color" value={form.value || "#087f74"} />
            <input onChange={(event) => update("value", event.target.value)} required value={form.value} />
          </div>
        </label>
      ) : form.key === "default_theme" ? (
        <CrudSelect label="Value" onChange={(value) => update("value", value)} options={["light", "dark"]} value={form.value || "light"} />
      ) : (
        <CrudField className="span-2" label="Value" onChange={(value) => update("value", value)} required value={form.value} />
      )}
      <CrudSelect label="Group" onChange={(value) => update("group", value)} options={["general", "branding", "contact", "notifications", "operations"]} value={form.group} />
      <CrudField className="span-2" label="Description" onChange={(value) => update("description", value)} value={form.description} />
      {["brand_color", "default_theme", "app_name"].includes(form.key) && (
        <p className="muted span-2">This setting is applied live across all portals after save.</p>
      )}
    </CrudModal>
  );
}

function CrudModal({ children, close, error = "", eyebrow, onSave, setSubmitting, submitting, title, value }) {
  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal compact glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);

          try {
            await onSave(value);
          } catch {
            // Parent or caller handles error display and keeps the modal open.
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="crud-grid">
          {children}
          {error && <p className="auth-error span-2">{error}</p>}
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={submitting} type="submit">{submitting ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function CrudField({ className = "", disabled = false, inputMode, label, onChange, required = false, value }) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      <input disabled={disabled} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} required={required} value={value} />
    </label>
  );
}

function CrudSelect({ label, onChange, options, value }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option.replaceAll("_", " ");

          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function AdminPlaceholder({ page }) {
  return <section className="panel placeholder admin-placeholder glass"><span><Icon name="settings" size={23} /></span><h2>{page.replace(/\b\w/g, (letter) => letter.toUpperCase())}</h2><p>This module is staged for the next roadmap milestone.</p></section>;
}
