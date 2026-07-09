import { activeStatuses, money } from "../../utils";
import { StatusBadge } from "../../components/shared";

const badgeStatuses = new Set([
  "active",
  "cancelled",
  "completed",
  "failed",
  "paid",
  "pending_approval",
  "refunded",
  "rejected",
  "unpaid",
]);
const trackedRiderStatuses = new Set(["available", "online", "busy", "on_break"]);

function reportLocationFreshness(rider) {
  const location = rider.currentLocation || rider.latest_location;

  if (!location?.recordedAt && !location?.recorded_at) {
    return "no_gps";
  }

  if (location.freshness) {
    return location.freshness;
  }

  const recordedAt = location.recordedAt || location.recorded_at;
  const ageSeconds = (Date.now() - new Date(recordedAt).getTime()) / 1000;

  if (ageSeconds <= 30) {
    return "fresh";
  }

  return ageSeconds <= 120 ? "warning" : "stale";
}

export function AdminReports({ orders, reportData, riders }) {
  const localSummary = buildLocalSummary(orders, riders);
  const ordersSummary = {
    total: reportData?.orders?.total ?? localSummary.orders.total,
    active: reportData?.orders?.active ?? localSummary.orders.active,
    completed: reportData?.orders?.completed ?? localSummary.orders.completed,
    failed: reportData?.orders?.failed ?? localSummary.orders.failed,
    cancelled: reportData?.orders?.cancelled ?? localSummary.orders.cancelled,
  };
  const paymentSummary = {
    unpaid: reportData?.payments?.unpaid ?? localSummary.payments.unpaid,
    pendingApproval: reportData?.payments?.pending_approval ?? localSummary.payments.pendingApproval,
    paid: reportData?.payments?.paid ?? localSummary.payments.paid,
    rejected: reportData?.payments?.rejected ?? localSummary.payments.rejected,
    refunded: reportData?.payments?.refunded ?? localSummary.payments.refunded,
    approvedAmount: reportData?.payments?.approved_amount ?? localSummary.payments.approvedAmount,
  };
  const cashSummary = {
    riderCollected: reportData?.delivery_fees?.rider_collected ?? localSummary.cash.riderCollected,
    records: reportData?.delivery_fees?.records ?? localSummary.cash.records,
    cashHeld: reportData?.riders?.reduce((total, rider) => total + Number(rider.cash_held || 0), 0) ?? localSummary.cash.cashHeld,
  };
  const gpsSummary = {
    activeRiders: reportData?.gps?.active_riders ?? localSummary.gps.activeRiders,
    freshRiders: reportData?.gps?.fresh_riders ?? localSummary.gps.freshRiders,
    warningRiders: reportData?.gps?.warning_riders ?? localSummary.gps.warningRiders,
    staleRiders: reportData?.gps?.stale_riders ?? localSummary.gps.staleRiders,
    noGpsRiders: reportData?.gps?.no_gps_riders ?? localSummary.gps.noGpsRiders,
    poorAccuracyRiders: reportData?.gps?.poor_accuracy_riders ?? localSummary.gps.poorAccuracyRiders,
    updatesLastMinute: reportData?.gps?.updates_last_minute ?? localSummary.gps.updatesLastMinute,
    averageAccuracy: reportData?.gps?.average_accuracy ?? localSummary.gps.averageAccuracy,
  };
  const riderRows = reportData?.riders || riders.map((rider) => ({
    code: rider.id,
    name: rider.name,
    status: rider.status,
    current_area: rider.area,
    cash_held: rider.cashHeld,
    active_orders_count: rider.activeOrders,
    completed_orders_count: 0,
  }));

  return (
    <section className="reports-layout">
      <div className="report-metrics">
        <ReportMetric label="Total orders" value={ordersSummary.total} note="All requests" />
        <ReportMetric label="Active orders" value={ordersSummary.active} note="Still operating" />
        <ReportMetric label="Completed orders" value={ordersSummary.completed} note="Finished deliveries" />
        <ReportMetric label="Paid payments" value={paymentSummary.paid} note={money(paymentSummary.approvedAmount)} />
        <ReportMetric label="Rider-collected fees" value={money(cashSummary.riderCollected)} note={`${cashSummary.records} completed fee records`} />
        <ReportMetric label="Rider cash held" value={money(cashSummary.cashHeld)} note="Current balance" />
        <ReportMetric label="GPS active riders" value={gpsSummary.activeRiders} note={`${gpsSummary.freshRiders} fresh positions`} />
        <ReportMetric label="Stale or no GPS" value={gpsSummary.staleRiders + gpsSummary.noGpsRiders} note={`${gpsSummary.poorAccuracyRiders} weak accuracy`} />
        <ReportMetric label="GPS updates/min" value={gpsSummary.updatesLastMinute} note={gpsSummary.averageAccuracy ? `${gpsSummary.averageAccuracy}m average accuracy` : "No recent GPS accuracy"} />
      </div>

      <div className="report-panels">
        <ReportStatusPanel
          eyebrow="ORDER STATUS"
          rows={[
            ["Active", ordersSummary.active, "active"],
            ["Completed", ordersSummary.completed, "completed"],
            ["Failed", ordersSummary.failed, "failed"],
            ["Cancelled", ordersSummary.cancelled, "cancelled"],
          ]}
          title="Delivery outcome summary"
        />
        <ReportStatusPanel
          eyebrow="PAYMENT STATUS"
          rows={[
            ["Unpaid", paymentSummary.unpaid, "unpaid"],
            ["Pending approval", paymentSummary.pendingApproval, "pending_approval"],
            ["Paid", paymentSummary.paid, "paid"],
            ["Rejected", paymentSummary.rejected, "rejected"],
            ["Refunded", paymentSummary.refunded, "refunded"],
          ]}
          title="Delivery fee payments"
        />
        <ReportStatusPanel
          eyebrow="RIDER CASH"
          rows={[
            ["Fee records", cashSummary.records, "delivery fees"],
            ["Collected by riders", money(cashSummary.riderCollected), "completed orders"],
            ["Held by riders", money(cashSummary.cashHeld), "current balance"],
          ]}
          title="Rider-collected fees"
        />
        <ReportStatusPanel
          eyebrow="GPS HEALTH"
          rows={[
            ["Fresh", gpsSummary.freshRiders, "riders"],
            ["Warning", gpsSummary.warningRiders, "31-120s"],
            ["Stale", gpsSummary.staleRiders, "over 2m"],
            ["No GPS", gpsSummary.noGpsRiders, "online riders"],
            ["Weak accuracy", gpsSummary.poorAccuracyRiders, "over 100m"],
          ]}
          title="Rider tracking operations"
        />
      </div>

      <div className="panel glass">
        <div className="panel-heading">
          <div><p className="eyebrow">RIDER ACTIVITY</p><h2>Workload and cash held</h2></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rider</th><th>Status</th><th>Area</th><th>Active</th><th>Completed</th><th>Delivery fees held</th></tr></thead>
            <tbody>
              {riderRows.map((rider) => (
                <tr key={rider.code}>
                  <td><strong>{rider.name}</strong><small>{rider.code}</small></td>
                  <td><StatusBadge status={rider.status} /></td>
                  <td>{rider.current_area || "Area unavailable"}</td>
                  <td>{rider.active_orders_count || 0}</td>
                  <td>{rider.completed_orders_count || 0}</td>
                  <td><strong>{money(rider.cash_held)}</strong></td>
                </tr>
              ))}
              {riderRows.length === 0 && (
                <tr><td colSpan="6"><span className="muted">No rider activity available yet.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function buildLocalSummary(orders, riders) {
  const trackedRiders = riders.filter((rider) => trackedRiderStatuses.has(rider.status));
  const locationsWithAccuracy = trackedRiders
    .map((rider) => rider.currentLocation)
    .filter((location) => location?.accuracy !== null && location?.accuracy !== undefined);

  return {
    orders: {
      total: orders.length,
      active: orders.filter((order) => activeStatuses.has(order.status)).length,
      completed: orders.filter((order) => order.status === "completed").length,
      failed: orders.filter((order) => order.status === "failed").length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
    },
    payments: {
      unpaid: orders.filter((order) => order.paymentStatus === "unpaid").length,
      pendingApproval: orders.filter((order) => order.paymentStatus === "pending_approval").length,
      paid: orders.filter((order) => order.paymentStatus === "paid").length,
      rejected: orders.filter((order) => order.paymentStatus === "rejected").length,
      refunded: orders.filter((order) => order.paymentStatus === "refunded").length,
      approvedAmount: orders
        .filter((order) => order.paymentStatus === "paid")
        .reduce((total, order) => total + Number(order.fee || 0), 0),
    },
    cash: {
      riderCollected: orders
        .filter((order) => order.paymentStatus === "paid")
        .reduce((total, order) => total + Number(order.fee || 0), 0),
      records: orders.filter((order) => order.paymentStatus === "paid").length,
      cashHeld: riders.reduce((total, rider) => total + Number(rider.cashHeld || 0), 0),
    },
    gps: {
      activeRiders: trackedRiders.length,
      freshRiders: trackedRiders.filter((rider) => reportLocationFreshness(rider) === "fresh").length,
      warningRiders: trackedRiders.filter((rider) => reportLocationFreshness(rider) === "warning").length,
      staleRiders: trackedRiders.filter((rider) => reportLocationFreshness(rider) === "stale").length,
      noGpsRiders: trackedRiders.filter((rider) => reportLocationFreshness(rider) === "no_gps").length,
      poorAccuracyRiders: trackedRiders.filter((rider) => Number(rider.currentLocation?.accuracy || 0) > 100).length,
      updatesLastMinute: 0,
      averageAccuracy: locationsWithAccuracy.length
        ? Math.round((locationsWithAccuracy.reduce((total, location) => total + Number(location.accuracy || 0), 0) / locationsWithAccuracy.length) * 10) / 10
        : null,
    },
  };
}

function ReportStatusPanel({ eyebrow, rows, title }) {
  return (
    <div className="panel glass report-status-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
      </div>
      <div className="report-status-list">
        {rows.map(([label, value, status]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {badgeStatuses.has(status) ? <StatusBadge status={status} /> : <small>{status}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportMetric({ label, note, value }) {
  return (
    <article className="metric-card glass">
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
