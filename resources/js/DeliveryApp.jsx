import { useEffect, useMemo, useState } from "react";
import {
  assignDeliveryOrder,
  createDeliveryOrder,
  fetchOrders,
  fetchReportSummary,
  fetchRiders,
  reviewPayment,
  updateDeliveryOrderStatus,
} from "./api";
import { initialOrders, initialRiders } from "./data";
import { PortalSwitcher } from "./components/shared";
import { ClientPortal } from "./portals/ClientPortal";
import { RiderPortal } from "./portals/RiderPortal";
import { AdminPortal } from "./portals/AdminPortal";
import { useStoredState } from "./utils";

export default function App() {
  const [portal, setPortal] = useStoredState("flowdrop.portal", "client");
  const [orders, setOrders] = useStoredState("flowdrop.orders", initialOrders);
  const [riders, setRiders] = useStoredState("flowdrop.riders", initialRiders);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [theme, setTheme] = useStoredState("flowdrop.theme", "light");
  const [brand, setBrand] = useStoredState("flowdrop.brand", "#087f74");
  const themeStyle = useMemo(() => ({ "--color-primary": brand }), [brand]);
  const themeProps = { theme, setTheme, brand, setBrand };

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([fetchOrders(), fetchRiders(), fetchReportSummary()])
      .then(([ordersResult, ridersResult, reportsResult]) => {
        if (cancelled) {
          return;
        }

        if (ordersResult.status === "fulfilled") {
          setOrders(ordersResult.value);
        }

        if (ridersResult.status === "fulfilled") {
          setRiders(ridersResult.value);
        }

        if (reportsResult.status === "fulfilled") {
          setReportData(reportsResult.value);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [setOrders, setRiders]);

  const submitOrder = async (order) => {
    let submittedOrder = order;

    try {
      submittedOrder = await createDeliveryOrder(order);
    } catch {
      // The local prototype remains usable without a running API server.
    }

    setOrders((current) => [
      submittedOrder,
      ...current.filter((item) => item.id !== submittedOrder.id),
    ]);

    return submittedOrder;
  };

  const assignRider = async (orderId, riderId) => {
    const order = orders.find((item) => item.id === orderId);
    const rider = riders.find((item) => item.id === riderId);
    let assignedOrder = null;

    if (order?._apiId && rider?._apiId) {
      try {
        assignedOrder = await assignDeliveryOrder(order, rider);
      } catch {
        // Fall back to local prototype state when the API is unavailable.
      }
    }

    setOrders((current) => current.map((item) => item.id === orderId ? assignedOrder || { ...item, riderId, status: "rider_assigned", updatedAt: "Just now" } : item));
    setRiders((current) => current.map((rider) => rider.id === riderId ? { ...rider, status: "busy", activeOrders: rider.activeOrders + 1 } : rider));
  };

  const progressOrder = async (orderId, status) => {
    const order = orders.find((item) => item.id === orderId);
    let updatedOrder = null;

    if (order?._apiId) {
      try {
        updatedOrder = await updateDeliveryOrderStatus(order, status);
      } catch {
        // Preserve the demo workflow when the API is unavailable.
      }
    }

    setOrders((current) => current.map((item) => item.id === orderId ? updatedOrder || { ...item, status, updatedAt: "Just now" } : item));
  };

  const reviewPaymentStatus = async (orderId, status) => {
    const order = orders.find((item) => item.id === orderId);
    let reviewedOrder = null;

    if (order?.paymentId) {
      try {
        reviewedOrder = await reviewPayment(order.paymentId, status, status === "rejected" ? "Payment proof did not match the expected amount." : "");
      } catch {
        // Keep payment review usable in the local prototype.
      }
    }

    setOrders((current) => current.map((item) => item.id === orderId ? reviewedOrder || { ...item, paymentStatus: status, updatedAt: "Just now" } : item));
  };

  return (
    <div className="app-root" data-theme={theme} style={themeStyle}>
      <PortalSwitcher portal={portal} setPortal={setPortal} />
      {portal === "client" && <ClientPortal orders={orders} submitOrder={submitOrder} themeProps={themeProps} />}
      {portal === "rider" && <RiderPortal orders={orders} progressOrder={progressOrder} riders={riders} themeProps={themeProps} />}
      {portal === "admin" && <AdminPortal assignRider={assignRider} orders={orders} reportData={reportData} reviewPaymentStatus={reviewPaymentStatus} riders={riders} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} themeProps={themeProps} />}
    </div>
  );
}
