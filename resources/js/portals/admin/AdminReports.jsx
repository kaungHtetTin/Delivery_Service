import { activeStatuses, money } from "../../utils";
import { StatusBadge } from "../../components/shared";

export function AdminReports({ orders, reportData, riders }) {
  const localSummary = {
    totalOrders: orders.length,
    activeOrders: orders.filter((order) => activeStatuses.has(order.status)).length,
    completedOrders: orders.filter((order) => order.status === "completed").length,
    unpaidFees: orders.filter((order) => order.paymentStatus === "unpaid").length,
    deliveryFeesCollected: orders
      .filter((order) => order.paymentStatus === "paid")
      .reduce((total, order) => total + Number(order.fee || 0), 0),
  };
  const summary = {
    totalOrders: reportData?.orders?.total ?? localSummary.totalOrders,
    activeOrders: reportData?.orders?.active ?? localSummary.activeOrders,
    completedOrders: reportData?.orders?.completed ?? localSummary.completedOrders,
    unpaidFees: localSummary.unpaidFees,
    deliveryFeesCollected: reportData?.cash_collections?.total_collected ?? localSummary.deliveryFeesCollected,
    cashHeld: reportData?.riders?.reduce((total, rider) => total + Number(rider.cash_held || 0), 0)
      ?? riders.reduce((total, rider) => total + Number(rider.cashHeld || 0), 0),
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
        <ReportMetric label="Total orders" value={summary.totalOrders} />
        <ReportMetric label="Active deliveries" value={summary.activeOrders} />
        <ReportMetric label="Completed" value={summary.completedOrders} />
        <ReportMetric label="Unpaid delivery fees" value={summary.unpaidFees} />
        <ReportMetric label="Delivery fees collected" value={money(summary.deliveryFeesCollected)} />
        <ReportMetric label="Cash held by riders" value={money(summary.cashHeld)} />
      </div>
      <div className="panel glass">
        <div className="panel-heading">
          <div><p className="eyebrow">RIDER ACTIVITY</p><h2>Workload and collections</h2></div>
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
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ReportMetric({ label, value }) {
  return (
    <article className="metric-card glass">
      <small>{label}</small>
      <strong>{value}</strong>
      <p>Current report range</p>
    </article>
  );
}
