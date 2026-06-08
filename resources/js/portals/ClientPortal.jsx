import { useState } from "react";
import { Icon } from "../icons";
import { statusLabels } from "../data";
import { activeStatuses, money } from "../utils";
import { AddressBlock, MobileNav, MobileTopbar, NotificationList, StatusBadge } from "../components/shared";

export function ClientPortal({ markNotificationRead, notifications = [], orders, submitOrder, themeProps, user }) {
  const [page, setPage] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const activeOrder = orders.find((order) => activeStatuses.has(order.status));
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const openTracking = (id) => {
    setSelectedId(id);
    setPage("tracking");
  };

  return (
    <div className="mobile-app">
      <MobileTopbar themeProps={themeProps} unreadCount={unreadCount} />
      <main className="mobile-content">
        {page === "home" && (
          <ClientHome activeOrder={activeOrder} onCreate={() => setPage("new")} onTrack={openTracking} orders={orders} user={user} />
        )}
        {page === "orders" && <ClientOrders onTrack={openTracking} orders={orders} />}
        {page === "new" && (
          <NewRequest
            onCancel={() => setPage("home")}
            onSubmit={async (order) => {
              const submittedOrder = await submitOrder(order);
              openTracking(submittedOrder.id);
              return submittedOrder;
            }}
            user={user}
          />
        )}
        {page === "tracking" && (
          <TrackingView
            onBack={() => setPage("orders")}
            order={orders.find((order) => order.id === selectedId) || activeOrder || orders[0]}
          />
        )}
        {page === "notifications" && <NotificationList notifications={notifications} onRead={markNotificationRead} title="Notifications" />}
        {page === "account" && <ClientAccount user={user} />}
      </main>
      {page !== "new" && (
        <MobileNav
          active={page === "tracking" ? "orders" : page}
          items={[
            ["home", "home", "Home"],
            ["orders", "box", "Deliveries"],
            ["new", "plus", "New", true],
            ["notifications", "bell", "Alerts"],
            ["account", "user", "Account"],
          ]}
          onNavigate={setPage}
        />
      )}
    </div>
  );
}

function ClientHome({ activeOrder, onCreate, onTrack, orders, user }) {
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <>
      <section className="hero">
        <p className="eyebrow">TUESDAY, 02 JUNE</p>
        <h1>Good evening, {firstName}</h1>
        <p>What would you like to deliver today?</p>
        <button className="btn primary hero-btn" onClick={onCreate} type="button">
          <span>
            <Icon name="plus" />
          </span>
          Create delivery request
          <Icon name="arrowRight" />
        </button>
      </section>
      {activeOrder && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LIVE DELIVERY</span>
              <h2>Active delivery</h2>
            </div>
            <button className="text-btn" onClick={() => onTrack(activeOrder.id)} type="button">
              Track order
            </button>
          </div>
          <button className="active-delivery-card glass" onClick={() => onTrack(activeOrder.id)} type="button">
            <div className="card-row">
              <span className="order-code">{activeOrder.id}</span>
              <StatusBadge status={activeOrder.status} />
            </div>
            <AddressBlock from={activeOrder.pickup} to={activeOrder.destination} />
            <div className="card-footer">
              <span>
                <Icon name="clock" size={14} /> Updated {activeOrder.updatedAt}
              </span>
              <Icon name="chevronRight" size={17} />
            </div>
          </button>
        </section>
      )}
      <section className="section-block">
        <div className="section-heading">
          <h2>Recent deliveries</h2>
          <button className="text-btn" type="button">
            View all
          </button>
        </div>
        <div className="compact-list glass">
          {orders.slice(0, 3).map((order) => (
            <button className="compact-row" key={order.id} onClick={() => onTrack(order.id)} type="button">
              <span className="row-icon"><Icon name="box" size={17} /></span>
              <span className="row-content">
                <strong>{order.destination.split(",")[0]}</strong>
                <small>{order.id} - {order.createdAt}</small>
              </span>
              <StatusBadge status={order.status} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ClientOrders({ orders, onTrack }) {
  return (
    <section className="page-section">
      <p className="eyebrow">ORDER HISTORY</p>
      <h1>My deliveries</h1>
      <div className="search-box">
        <Icon name="search" size={17} />
        <input placeholder="Search by order code" />
      </div>
      <div className="filter-pills">
        <button className="active" type="button">All</button>
        <button type="button">Active</button>
        <button type="button">Completed</button>
      </div>
      <div className="delivery-list">
        {orders.map((order) => (
          <button className="delivery-list-card glass" key={order.id} onClick={() => onTrack(order.id)} type="button">
            <div className="card-row">
              <span className="order-code">{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <AddressBlock from={order.pickup} to={order.destination} />
            <div className="card-footer">
              <span>{order.createdAt}</span>
              <strong>{money(order.fee)}</strong>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ClientAccount({ user }) {
  return (
    <section className="page-section">
      <p className="eyebrow">ACCOUNT</p>
      <h1>Your account</h1>
      <div className="compact-list glass">
        <div className="compact-row">
          <span className="row-icon"><Icon name="user" size={17} /></span>
          <span className="row-content"><strong>{user.name}</strong><small>Client account</small></span>
        </div>
        <div className="compact-row">
          <span className="row-icon"><Icon name="phone" size={16} /></span>
          <span className="row-content"><strong>{user.phone}</strong><small>Primary phone number</small></span>
        </div>
        <div className="compact-row">
          <span className="row-icon"><Icon name="card" size={16} /></span>
          <span className="row-content"><strong>{user.email}</strong><small>Login email</small></span>
        </div>
      </div>
    </section>
  );
}

function NewRequest({ onCancel, onSubmit, user }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    pickupContact: "",
    pickupPhone: "",
    pickup: "",
    receiver: "",
    receiverPhone: "",
    destination: "",
    product: "",
    category: "Package",
    quantity: "1",
    fragile: false,
    paymentMethod: "Cash on delivery",
    paymentScreenshot: null,
    cod: "",
    note: "",
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const canContinue =
    step === 1
      ? form.pickupContact && form.pickupPhone && form.pickup
      : step === 2
        ? form.receiver && form.receiverPhone && form.destination
        : step === 3
          ? form.product
          : step === 4 && form.paymentMethod === "Mobile banking"
            ? form.paymentScreenshot
            : true;
  const submit = async () => {
    const id = `FD-${String(Date.now()).slice(-6)}`;
    const submittedOrder = await onSubmit({
      ...form,
      id,
      client: user.name,
      clientPhone: user.phone,
      createdAt: "Just now",
      updatedAt: "Just now",
      status: "pending",
      paymentStatus: form.paymentMethod === "Mobile banking" ? "pending_approval" : "unpaid",
      paymentScreenshot: form.paymentScreenshot,
      cod: Number(form.cod || 0),
      fee: 3000,
      riderId: null,
    });
    return submittedOrder;
  };

  return (
    <section className="request-flow">
      <div className="request-header">
        <button className="icon-btn" onClick={onCancel} type="button"><Icon name="close" /></button>
        <div>
          <small>NEW DELIVERY REQUEST</small>
          <h2>{["Pickup details", "Delivery details", "Product details", "Payment", "Review request"][step - 1]}</h2>
        </div>
        <span>{step}/5</span>
      </div>
      <div className="progress"><span style={{ width: `${step * 20}%` }} /></div>
      <div className="form-content">
        {step === 1 && (
          <>
            <FormIntro icon="location" title="Where should we collect the package?" text="Add the pickup contact and location." />
            <TextField label="Pickup contact or shop name" onChange={(value) => update("pickupContact", value)} placeholder="e.g. Linn Fashion" value={form.pickupContact} />
            <TextField inputMode="tel" label="Pickup phone number" onChange={(value) => update("pickupPhone", value)} placeholder="09 xxx xxx xxx" value={form.pickupPhone} />
            <TextField label="Pickup address" onChange={(value) => update("pickup", value)} placeholder="Street, township" value={form.pickup} />
            <button className="btn secondary full" type="button"><Icon name="mapPin" size={16} /> Use current GPS location</button>
          </>
        )}
        {step === 2 && (
          <>
            <FormIntro icon="navigation" title="Where are we delivering?" text="Enter the receiver's contact information." />
            <TextField label="Receiver name" onChange={(value) => update("receiver", value)} placeholder="Full name" value={form.receiver} />
            <TextField inputMode="tel" label="Receiver phone number" onChange={(value) => update("receiverPhone", value)} placeholder="09 xxx xxx xxx" value={form.receiverPhone} />
            <TextField label="Delivery address" onChange={(value) => update("destination", value)} placeholder="Street, township" value={form.destination} />
            <button className="btn secondary full" type="button"><Icon name="mapPin" size={16} /> Pin delivery location</button>
          </>
        )}
        {step === 3 && (
          <>
            <FormIntro icon="box" title="Tell us about the package" text="This helps the rider handle your item correctly." />
            <TextField label="Product name" onChange={(value) => update("product", value)} placeholder="e.g. Clothing package" value={form.product} />
            <div className="input-grid">
              <TextField label="Category" onChange={(value) => update("category", value)} value={form.category} />
              <TextField inputMode="numeric" label="Quantity" onChange={(value) => update("quantity", value)} value={form.quantity} />
            </div>
            <label className="switch-row glass">
              <span><strong>Fragile item</strong><small>Rider will see a handling warning</small></span>
              <input checked={form.fragile} onChange={(event) => update("fragile", event.target.checked)} type="checkbox" />
              <i />
            </label>
            <label className="upload-box">
              <Icon name="upload" />
              <strong>Add product photo</strong>
              <small>Optional - JPG or PNG</small>
              <input hidden type="file" />
            </label>
          </>
        )}
        {step === 4 && (
          <>
            <FormIntro icon="wallet" title="How will payment be handled?" text="Choose the payment method and COD amount." />
            <label className="field-label">Delivery fee payment</label>
            <div className="payment-options">
              {["Cash on delivery", "Mobile banking", "Prepaid", "Cash"].map((method) => (
                <button
                  className={form.paymentMethod === method ? "selected" : ""}
                  key={method}
                  onClick={() => update("paymentMethod", method)}
                  type="button"
                >
                  <Icon name={method === "Mobile banking" ? "card" : "wallet"} size={17} />
                  {method}
                </button>
              ))}
            </div>
            <TextField inputMode="numeric" label="Product COD amount" onChange={(value) => update("cod", value)} placeholder="0 MMK" value={form.cod} />
            {form.paymentMethod === "Mobile banking" && (
              <label className="upload-box">
                <Icon name="upload" />
                <strong>{form.paymentScreenshot ? form.paymentScreenshot.name : "Upload payment screenshot"}</strong>
                <small>Required for office approval</small>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => update("paymentScreenshot", event.target.files?.[0] || null)}
                  type="file"
                />
              </label>
            )}
          </>
        )}
        {step === 5 && (
          <>
            <FormIntro icon="check" title="Review your delivery request" text="Confirm these details before submitting." />
            <ReviewSection label="Pickup" title={form.pickupContact} lines={[form.pickupPhone, form.pickup]} />
            <ReviewSection label="Delivery" title={form.receiver} lines={[form.receiverPhone, form.destination]} />
            <ReviewSection label="Product" title={form.product} lines={[`${form.quantity} item(s) - ${form.category}`, form.fragile ? "Fragile handling required" : "Standard handling"]} />
            <ReviewSection label="Payment" title={form.paymentMethod} lines={[`Product COD: ${money(form.cod)}`, "Estimated delivery fee: 3,000 MMK"]} />
          </>
        )}
      </div>
      <div className="sticky-actions glass">
        {step > 1 && <button className="btn secondary" onClick={() => setStep(step - 1)} type="button">Back</button>}
        <button
          className="btn primary grow"
          disabled={!canContinue}
          onClick={async () => {
            if (step < 5) {
              setStep(step + 1);
              return;
            }

            await submit();
          }}
          type="button"
        >
          {step === 5 ? "Submit delivery request" : "Continue"}
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, placeholder, inputMode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input inputMode={inputMode} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  );
}

function FormIntro({ icon, title, text }) {
  return (
    <div className="form-intro">
      <span><Icon name={icon} /></span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </div>
  );
}

function ReviewSection({ label, title, lines }) {
  return (
    <div className="review-section glass">
      <span className="eyebrow">{label}</span>
      <strong>{title}</strong>
      {lines.map((line) => <small key={line}>{line}</small>)}
    </div>
  );
}

function TrackingView({ order, onBack }) {
  if (!order) return null;
  const steps = ["pending", "rider_assigned", "picked_up", "going_to_delivery", "delivered"];
  const trackingIndex = {
    pending: 0,
    approved: 0,
    rider_assigned: 1,
    rider_accepted: 1,
    going_to_pickup: 1,
    arrived_at_pickup: 1,
    picked_up: 2,
    going_to_delivery: 3,
    arrived_at_delivery: 3,
    delivered: 4,
    completed: 4,
  };
  const currentIndex = trackingIndex[order.status] ?? 0;
  return (
    <section className="page-section tracking">
      <button className="back-btn" onClick={onBack} type="button"><Icon name="chevronLeft" size={17} /> My deliveries</button>
      <div className="card-row">
        <div><p className="eyebrow">DELIVERY TRACKING</p><h1>{order.id}</h1></div>
        <StatusBadge status={order.status} />
      </div>
      <div className="map-preview glass">
        <div className="map-road one" /><div className="map-road two" /><div className="map-road three" />
        <span className="map-point start"><Icon name="box" size={14} /></span>
        <span className="map-point rider"><Icon name="bike" size={15} /></span>
        <span className="map-point end"><Icon name="mapPin" size={15} /></span>
      </div>
      <div className="tracking-status glass">
        <p className="eyebrow">CURRENT STATUS</p>
        <h2>{statusLabels[order.status]}</h2>
        <p>{order.status === "pending" ? "The office team will review your request shortly." : "Your delivery is moving through the workflow."}</p>
      </div>
      <div className="timeline glass">
        {steps.map((step, index) => (
          <div className={`${index <= currentIndex ? "done" : ""} ${step === order.status ? "current" : ""}`} key={step}>
            <span>{index < currentIndex ? <Icon name="check" size={12} /> : index + 1}</span>
            <div><strong>{statusLabels[step]}</strong><small>{index <= currentIndex ? (index === currentIndex ? "Current update" : "Completed") : "Waiting"}</small></div>
          </div>
        ))}
      </div>
      <div className="tracking-details glass">
        <AddressBlock from={order.pickup} to={order.destination} />
        <div className="card-footer"><span>Delivery fee</span><strong>{money(order.fee)}</strong></div>
      </div>
    </section>
  );
}
