import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons";
import { formatSettingValue, settingValueForInput } from "../api";
import { activeStatuses, formatDeliveryFeeLabel, money, useStoredState } from "../utils";
import { AddressBlock, CreatorSourceBadge, formatOrderCreator, Logo, StatusBadge, ThemeControl } from "../components/shared";
import { AdminReports } from "./admin/AdminReports";

function todayDateInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function AdminPortal({
  appName = "FlowDrop Delivery",
  orders,
  riders,
  assignRider,
  collectRiderFees,
  customers = [],
  removeOrder,
  removeRider,
  removeSetting,
  removeUser,
  reportData,
  saveOrder,
  saveProfile,
  saveRider,
  saveSetting,
  saveUser,
  selectedOrderId,
  setSelectedOrderId,
  settings = [],
  shops = [],
  themeProps,
  onLogout,
  user,
  users = [],
}) {
  const today = useMemo(() => todayDateInputValue(), []);
  const [page, setPage] = useStoredState("flowdrop.admin.page", "dashboard");
  const [assignmentOrder, setAssignmentOrder] = useState(null);
  const [orderEditor, setOrderEditor] = useState(null);
  const [riderEditor, setRiderEditor] = useState(null);
  const [settlementRider, setSettlementRider] = useState(null);
  const [userEditor, setUserEditor] = useState(null);
  const [settingEditor, setSettingEditor] = useState(null);
  const [orderFilters, setOrderFilters] = useState({
    search: "",
    status: "all",
    riderId: "all",
    dateFrom: today,
    dateTo: today,
  });
  const [riderFilters, setRiderFilters] = useState({
    search: "",
    status: "all",
  });
  const [collectionFilters, setCollectionFilters] = useState({
    search: "",
    holding: "positive",
  });
  const activePage = ["cash", "payments"].includes(page) ? "collections" : page;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const filteredOrders = useMemo(
    () => orders.filter((order) => {
      const searchText = `${order.id} ${order.creatorName || order.client} ${order.creatorPhone || order.clientPhone} ${order.creatorEmail || ""} ${order.receiver} ${order.receiverPhone} ${order.pickup} ${order.destination}`.toLowerCase();

      return (
        (!orderFilters.search || searchText.includes(orderFilters.search.toLowerCase())) &&
        (orderFilters.status === "all" || order.status === orderFilters.status) &&
        (orderFilters.riderId === "all" || order.riderId === orderFilters.riderId) &&
        (!orderFilters.dateFrom || order.createdDate >= orderFilters.dateFrom) &&
        (!orderFilters.dateTo || order.createdDate <= orderFilters.dateTo)
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
  const collectionRiders = useMemo(
    () => riders
      .filter((rider) => {
        const searchText = `${rider.id} ${rider.name} ${rider.phone} ${rider.area}`.toLowerCase();

        return (
          (!collectionFilters.search || searchText.includes(collectionFilters.search.toLowerCase())) &&
          (collectionFilters.holding === "all" || Number(rider.cashHeld || 0) > 0)
        );
      })
      .sort((a, b) => Number(b.cashHeld || 0) - Number(a.cashHeld || 0)),
    [collectionFilters, riders],
  );
  const ordersPagination = usePagination(
    filteredOrders,
    `orders:${orderFilters.search}|${orderFilters.status}|${orderFilters.riderId}|${orderFilters.dateFrom}|${orderFilters.dateTo}`,
  );
  const ridersPagination = usePagination(
    filteredRiders,
    `riders:${riderFilters.search}|${riderFilters.status}`,
  );
  const collectionsPagination = usePagination(
    collectionRiders,
    `collections:${collectionFilters.search}|${collectionFilters.holding}`,
  );
  const usersPagination = usePagination(users, "users");
  const totalCashHeld = riders.reduce((total, rider) => total + Number(rider.cashHeld || 0), 0);
  const currentOperationOrders = orders.filter((order) => !["completed", "failed", "cancelled"].includes(order.status));
  const stats = [
    ["New requests", orders.filter((order) => order.status === "pending").length, "box", "Waiting for review"],
    ["Active deliveries", orders.filter((order) => activeStatuses.has(order.status)).length, "navigation", "Live operations"],
    ["Available riders", riders.filter((rider) => rider.status === "available").length, "bike", `${riders.length} total riders`],
    ["Cash held", money(totalCashHeld), "wallet", "Delivery fees with riders"],
  ];
  const navGroups = [
    {
      label: "Operations",
      items: [
        ["dashboard", "grid", "Dashboard"],
        ["orders", "box", "Orders"],
        ["collections", "wallet", "Fee collections"],
        ["tracking", "mapPin", "Tracking map"],
      ],
    },
    {
      label: "Master data",
      items: [
        ["riders", "bike", "Riders"],
        ["users", "lock", "Users"],
      ],
    },
    {
      label: "Insights",
      items: [
        ["reports", "chart", "Reports"],
        ["settings", "settings", "Settings"],
      ],
    },
    {
      label: "Account",
      items: [
        ["profile", "user", "Profile"],
      ],
    },
  ];
  const pageLabel = navGroups.flatMap((group) => group.items).find(([value]) => value === activePage)?.[2];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar glass">
        <Logo appName={appName} />
        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([value, icon, label]) => (
                <button className={activePage === value ? "active" : ""} key={value} onClick={() => setPage(value)} type="button">
                  <Icon name={icon} size={17} /> {label}
                </button>
              ))}
            </div>
          ))}
        </nav>
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
            <button className="btn primary" onClick={() => setOrderEditor({})} type="button"><Icon name="plus" size={16} /> New delivery</button>
            <ThemeControl {...themeProps} />
            <button className="icon-btn notification-btn" type="button"><Icon name="bell" /><span /></button>
            <AdminProfileMenu onLogout={onLogout} onProfile={() => setPage("profile")} onSettings={() => setPage("settings")} onUsers={() => setPage("users")} user={user} />
          </div>
        </header>
        <div className="admin-content">
          <div className="admin-page-heading">
            <div><p className="eyebrow">TUESDAY, 02 JUNE</p><h1>{activePage === "dashboard" || activePage === "customers" ? "Operations overview" : pageLabel}</h1></div>
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
                <OrderFilters filters={orderFilters} onChange={setOrderFilters} riders={riders} today={today} />
                <OrderTable onDelete={removeOrder} onEdit={(order) => setOrderEditor(order)} orders={ordersPagination.items} riders={riders} selectOrder={setSelectedOrderId} />
                <TablePagination label="orders" pagination={ordersPagination} />
              </div>
            </section>
          )}
          {activePage === "riders" && <RidersAdmin filters={riderFilters} onDelete={removeRider} onEdit={(rider) => setRiderEditor(rider)} onFilterChange={setRiderFilters} onNew={() => setRiderEditor({})} pagination={ridersPagination} riders={ridersPagination.items} />}
          {activePage === "collections" && <RiderCollectionsAdmin filters={collectionFilters} onCollect={setSettlementRider} onFilterChange={setCollectionFilters} pagination={collectionsPagination} riders={collectionsPagination.items} totalCashHeld={totalCashHeld} />}
          {activePage === "users" && <UsersAdmin onDelete={removeUser} onEdit={(user) => setUserEditor(user)} onNew={() => setUserEditor({})} pagination={usersPagination} users={usersPagination.items} />}
          {activePage === "settings" && <SettingsAdmin onDelete={removeSetting} onEdit={(setting) => setSettingEditor(setting)} onNew={() => setSettingEditor({})} settings={settings} />}
          {activePage === "tracking" && <section className="panel full-map glass"><PanelHeading title="Live rider tracking" eyebrow="REAL-TIME MAP" /><AdminMap riders={riders} large /></section>}
          {activePage === "reports" && <AdminReports orders={orders} reportData={reportData} riders={riders} />}
          {activePage === "profile" && <AdminProfilePage onSave={saveProfile} user={user} />}
          {!["dashboard", "orders", "riders", "collections", "customers", "users", "settings", "tracking", "reports", "profile"].includes(activePage) && <AdminPlaceholder page={activePage} />}
        </div>
      </main>
      {selectedOrder && (
        <OrderDrawer
          close={() => setSelectedOrderId(null)}
          onAssign={() => setAssignmentOrder(selectedOrder)}
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
      {settlementRider && (
        <RiderSettlementModal
          close={() => setSettlementRider(null)}
          onSave={(settlement) => collectRiderFees(settlementRider, settlement).then(() => setSettlementRider(null))}
          rider={settlementRider}
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

function userInitials(user) {
  return (user?.name || user?.email || "Office")
    .split(/[ @.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ProfileAvatar({ className = "", previewUrl = "", user }) {
  const photoUrl = previewUrl || user?.profile_photo_url;

  return photoUrl
    ? <img alt="" className={`profile-avatar ${className}`} src={photoUrl} />
    : <span className={`profile-avatar ${className}`}>{userInitials(user)}</span>;
}

function AdminProfileMenu({ onLogout, onProfile, onSettings, onUsers, user }) {
  const [open, setOpen] = useState(false);
  const displayName = user?.name || "Office user";
  const role = user?.role?.replaceAll("_", " ") || "office admin";

  return (
    <div className="profile-menu">
      <button className="profile-trigger" onClick={() => setOpen((current) => !current)} type="button">
        <ProfileAvatar user={user} />
        <div><strong>{displayName}</strong><small>{role}</small></div>
      </button>
      {open && (
        <div className="profile-dropdown glass">
          <div className="profile-dropdown-head">
            <ProfileAvatar user={user} />
            <div><strong>{displayName}</strong><small>{user?.email || "No email"}</small></div>
          </div>
          <button onClick={() => { onProfile?.(); setOpen(false); }} type="button"><Icon name="user" size={15} /> Profile</button>
          <button onClick={() => { onUsers?.(); setOpen(false); }} type="button"><Icon name="lock" size={15} /> User accounts</button>
          <button onClick={() => { onSettings?.(); setOpen(false); }} type="button"><Icon name="settings" size={15} /> Settings</button>
          <button className="danger" onClick={onLogout} type="button"><Icon name="close" size={15} /> Sign out</button>
        </div>
      )}
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

function usePagination(items, resetKey, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  const start = (currentPage - 1) * pageSize;

  return {
    from: total === 0 ? 0 : start + 1,
    items: items.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    setPage,
    setPageSize: (value) => setPageSize(Number(value)),
    to: Math.min(start + pageSize, total),
    total,
    totalPages,
  };
}

function TablePagination({ label, pagination }) {
  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
    .filter((page) => (
      page === 1 ||
      page === pagination.totalPages ||
      Math.abs(page - pagination.page) <= 1
    ));

  return (
    <div className="table-pagination">
      <span>{pagination.from}-{pagination.to} of {pagination.total} {label}</span>
      <div>
        <select aria-label={`Rows per page for ${label}`} onChange={(event) => pagination.setPageSize(event.target.value)} value={pagination.pageSize}>
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
        </select>
        <button disabled={pagination.page <= 1} onClick={() => pagination.setPage(pagination.page - 1)} type="button"><Icon name="chevronLeft" size={15} /></button>
        {pageNumbers.map((page, index) => {
          const previous = pageNumbers[index - 1];

          return (
            <span className="page-number-wrap" key={page}>
              {previous && page - previous > 1 && <i>...</i>}
              <button className={page === pagination.page ? "active" : ""} onClick={() => pagination.setPage(page)} type="button">{page}</button>
            </span>
          );
        })}
        <button disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.setPage(pagination.page + 1)} type="button"><Icon name="chevronRight" size={15} /></button>
      </div>
    </div>
  );
}

function OrderFilters({ filters, onChange, riders, today }) {
  const [expanded, setExpanded] = useState(false);
  const statuses = ["pending", "rider_assigned", "rider_accepted", "picked_up", "delivered", "completed", "failed", "cancelled"];
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="order-filter-box">
      <div className="order-filter-main">
        <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} onFocus={() => setExpanded(false)} placeholder="Search order, creator, phone, receiver..." value={filters.search} /></div>
        <button className={`btn secondary ${expanded ? "active" : ""}`} onClick={() => setExpanded((current) => !current)} type="button">
          <Icon name="filter" size={15} /> Filters
        </button>
      </div>
      {expanded && (
        <div className="filter-toolbar order-filters">
          <select onChange={(event) => update("status", event.target.value)} value={filters.status}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select onChange={(event) => update("riderId", event.target.value)} value={filters.riderId}>
            <option value="all">All riders</option>
            {riders.map((rider) => <option key={rider.id} value={rider.id}>{rider.name}</option>)}
          </select>
          <input aria-label="Order date from" onChange={(event) => update("dateFrom", event.target.value)} type="date" value={filters.dateFrom} />
          <input aria-label="Order date to" onChange={(event) => update("dateTo", event.target.value)} type="date" value={filters.dateTo} />
          <button className="btn secondary" onClick={() => onChange({ ...filters, dateFrom: today, dateTo: today })} type="button">Today</button>
        </div>
      )}
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

function RidersAdmin({ filters, onDelete, onEdit, onFilterChange, onNew, pagination, riders }) {
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
      <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Active orders</th><th>Current area</th><th>Last GPS update</th><th /></tr></thead><tbody>
        {riders.map((rider) => (
          <tr key={rider.id}>
            <td><span className="rider-cell"><i>{rider.initials}</i><span><strong>{rider.name}</strong><small>{rider.phone}</small></span></span></td>
            <td><StatusBadge status={rider.status} /></td>
            <td>{rider.activeOrders}</td>
            <td>{rider.area}</td>
            <td>{rider.lastSeen}</td>
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
      <TablePagination label="riders" pagination={pagination} />
    </section>
  );
}

function RiderCollectionsAdmin({ filters, onCollect, onFilterChange, pagination, riders, totalCashHeld }) {
  const update = (key, value) => onFilterChange({ ...filters, [key]: value });

  return (
    <section className="panel glass">
      <div className="panel-heading">
        <div><p className="eyebrow">OPERATIONS PROCESS</p><h2>Rider fee collections</h2></div>
        <strong>{money(totalCashHeld)} held</strong>
      </div>
      <div className="filter-toolbar compact">
        <div className="search-box"><Icon name="search" size={16} /><input onChange={(event) => update("search", event.target.value)} placeholder="Search rider, phone, area..." value={filters.search} /></div>
        <select onChange={(event) => update("holding", event.target.value)} value={filters.holding}>
          <option value="positive">Holding fees</option>
          <option value="all">All riders</option>
        </select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Current area</th><th>Active orders</th><th>Delivery fees held</th><th /></tr></thead><tbody>
        {riders.map((rider) => (
          <tr key={rider.id}>
            <td><span className="rider-cell"><i>{rider.initials}</i><span><strong>{rider.name}</strong><small>{rider.phone}</small></span></span></td>
            <td><StatusBadge status={rider.status} /></td>
            <td>{rider.area}</td>
            <td>{rider.activeOrders}</td>
            <td><strong>{money(rider.cashHeld)}</strong></td>
            <td>
              <button className="btn secondary" disabled={Number(rider.cashHeld || 0) <= 0} onClick={() => onCollect(rider)} type="button">
                <Icon name="wallet" size={15} /> Collect
              </button>
            </td>
          </tr>
        ))}
        {riders.length === 0 && (
          <tr>
            <td colSpan="6"><span className="muted">No rider held delivery fees match this filter.</span></td>
          </tr>
        )}
      </tbody></table></div>
      <TablePagination label="riders" pagination={pagination} />
    </section>
  );
}

function UsersAdmin({ onDelete, onEdit, onNew, pagination, users }) {
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
      <TablePagination label="users" pagination={pagination} />
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

function OrderDrawer({ order, riders, close, onAssign, onDelete, onEdit }) {
  const rider = riders.find((item) => item.id === order.riderId);
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
        {order.client && <div className="detail-row"><span>Requester</span><strong>{order.client}</strong></div>}
        {order.clientPhone && <div className="detail-row"><span>Requester phone</span><strong>{order.clientPhone}</strong></div>}
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
      <section><p className="eyebrow">RIDER ASSIGNMENT</p>{rider ? <div className="assigned-rider"><span className="avatar">{rider.initials}</span><div><strong>{rider.name}</strong><small>{rider.phone} - {rider.vehicle}</small></div></div> : <p className="muted">No rider assigned yet.</p>}</section>
      <div className="drawer-actions">
        <button className="btn secondary" onClick={onEdit} type="button">Edit</button>
        <button className="btn danger" onClick={() => window.confirm(`Delete ${order.id}?`) && onDelete()} type="button">Delete</button>
        <button className="btn primary grow" onClick={onAssign} type="button"><Icon name="bike" size={16} /> {rider ? "Change rider" : "Assign rider"}</button>
      </div>
    </aside>
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
  const [submitting, setSubmitting] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          await onSave(form);
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
          {!isNewOrder && (
            <>
              <CrudField label="Requester name" onChange={(value) => update("client", value)} value={form.client} />
              <CrudField label="Requester phone" onChange={(value) => update("clientPhone", value)} value={form.clientPhone} />
            </>
          )}
          <CrudField label="Pickup contact" onChange={(value) => update("pickupContact", value)} required value={form.pickupContact} />
          <CrudField label="Pickup phone" onChange={(value) => update("pickupPhone", value)} required value={form.pickupPhone} />
          <CrudField className="span-2" label="Pickup address" onChange={(value) => update("pickup", value)} required value={form.pickup} />
          <CrudField label="Destination name" onChange={(value) => update("receiver", value)} value={form.receiver} />
          <CrudField label="Destination phone" onChange={(value) => update("receiverPhone", value)} value={form.receiverPhone} />
          <CrudField className="span-2" label="Destination address" onChange={(value) => update("destination", value)} value={form.destination} />
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
          <CrudSelect label="Order status" onChange={(value) => update("status", value)} options={["pending", "rider_assigned", "rider_accepted", "picked_up", "delivered", "completed", "failed", "cancelled"]} value={form.status} />
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
    password: "",
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
          <CrudField label="Email" onChange={(value) => update("email", value)} type="email" value={form.email} />
          <CrudField className="span-2" label={form._apiId ? "New password" : "Password"} onChange={(value) => update("password", value)} type="password" value={form.password} />
          <CrudSelect label="Status" onChange={(value) => update("status", value)} options={["available", "online", "busy", "offline", "on_break", "suspended"]} value={form.status} />
          <CrudField label="Vehicle" onChange={(value) => update("vehicle", value)} value={form.vehicle} />
          <CrudField label="Current area" onChange={(value) => update("area", value)} value={form.area} />
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={submitting} type="submit">{submitting ? "Saving..." : "Save rider"}</button>
        </div>
      </form>
    </div>
  );
}

function RiderSettlementModal({ close, onSave, rider }) {
  const [form, setForm] = useState({
    amount: rider.cashHeld || 0,
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const update = (key, value) => {
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal compact glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError("");

          try {
            await onSave(form);
          } catch (settlementError) {
            setError(
              settlementError?.payload?.message ||
              Object.values(settlementError?.payload?.errors || {})?.[0]?.[0] ||
              settlementError?.message ||
              "Could not collect rider fees.",
            );
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">RIDER SETTLEMENT</p><h2>Collect held fees</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="settlement-summary glass">
          <span><Icon name="wallet" size={18} /></span>
          <div><small>Rider</small><strong>{rider.name}</strong></div>
          <div><small>Currently held</small><strong>{money(rider.cashHeld)}</strong></div>
        </div>
        <div className="crud-grid">
          <CrudField inputMode="numeric" label="Amount collected" onChange={(value) => update("amount", value)} required value={form.amount} />
          <CrudField className="span-2" label="Settlement note" onChange={(value) => update("note", value)} value={form.note} />
          {error && <p className="auth-error span-2">{error}</p>}
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={submitting || Number(form.amount || 0) <= 0} type="submit">
            {submitting ? "Saving..." : "Collect fees"}
          </button>
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
      <CrudField className="span-2" label={form._apiId ? "New password" : "Password"} onChange={(value) => update("password", value)} required={!form._apiId} type="password" value={form.password} />
    </CrudModal>
  );
}

function AdminProfilePage({ onSave, user }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
    photoFile: null,
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    }));
  }, [user?.email, user?.name, user?.phone]);

  const update = (key, value) => {
    setSaved(false);
    setError("");
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!form.photoFile) {
      setPhotoPreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(form.photoFile);
    setPhotoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [form.photoFile]);

  return (
    <section className="panel glass profile-page">
      <PanelHeading eyebrow="ACCOUNT" title="Office admin profile" />
      <form
        className="profile-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setSaved(false);
          setError("");

          if (form.password && form.password !== form.passwordConfirmation) {
            setError("New password and confirmation do not match.");
            setSaving(false);
            return;
          }

          try {
            await onSave(form);
            setForm((current) => ({
              ...current,
              currentPassword: "",
              password: "",
              passwordConfirmation: "",
              photoFile: null,
            }));
            setSaved(true);
          } catch (profileError) {
            setError(
              profileError?.payload?.message ||
              Object.values(profileError?.payload?.errors || {})?.[0]?.[0] ||
              profileError?.message ||
              "Could not save profile.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="profile-summary glass">
          <ProfileAvatar className="large" previewUrl={photoPreview} user={user} />
          <div><strong>{user?.name || "Office user"}</strong><small>{user?.role?.replaceAll("_", " ") || "office admin"}</small></div>
        </div>
        <label className="photo-upload glass">
          <ProfileAvatar previewUrl={photoPreview} user={user} />
          <span><strong>Profile photo</strong><small>Upload a JPG or PNG up to 2 MB</small></span>
          <input
            accept="image/*"
            onChange={(event) => update("photoFile", event.target.files?.[0] || null)}
            type="file"
          />
        </label>
        <div className="crud-grid">
          <CrudField label="Full name" onChange={(value) => update("name", value)} required value={form.name} />
          <CrudField label="Email" onChange={(value) => update("email", value)} required type="email" value={form.email} />
          <CrudField inputMode="tel" label="Phone" onChange={(value) => update("phone", value)} required value={form.phone} />
          <CrudField label="Current password" onChange={(value) => update("currentPassword", value)} type="password" value={form.currentPassword} />
          <CrudField label="New password" onChange={(value) => update("password", value)} type="password" value={form.password} />
          <CrudField label="Confirm new password" onChange={(value) => update("passwordConfirmation", value)} type="password" value={form.passwordConfirmation} />
          {error && <p className="auth-error span-2">{error}</p>}
          {saved && <p className="profile-success span-2">Profile saved.</p>}
        </div>
        <div className="profile-actions">
          <button className="btn primary" disabled={saving} type="submit">{saving ? "Saving..." : "Save profile"}</button>
        </div>
      </form>
    </section>
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

function CrudField({ className = "", disabled = false, inputMode, label, onChange, required = false, type = "text", value }) {
  return (
    <label className={`form-field ${className}`}>
      <span>{label}</span>
      <input disabled={disabled} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} />
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
