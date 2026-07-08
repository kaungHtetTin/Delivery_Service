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
