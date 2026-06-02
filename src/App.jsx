import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";
import {
  initialOrders,
  initialRiders,
  nextRiderActions,
  statusLabels,
} from "./data";

const money = (amount) => `${Number(amount || 0).toLocaleString()} MMK`;
const activeStatuses = new Set([
  "rider_assigned",
  "rider_accepted",
  "going_to_pickup",
  "arrived_at_pickup",
  "picked_up",
  "going_to_delivery",
  "arrived_at_delivery",
  "delivered",
]);

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function StatusBadge({ status }) {
  const family = ["completed", "delivered", "paid", "available"].includes(status)
    ? "success"
    : ["failed", "cancelled", "rejected"].includes(status)
      ? "danger"
      : ["pending", "pending_approval", "unpaid"].includes(status)
        ? "warning"
        : ["offline"].includes(status)
          ? "neutral"
          : "info";
  const label =
    statusLabels[status] ||
    status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <span className={`status status-${family}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

function Logo({ compact = false }) {
  return (
    <div className="logo">
      <span className="logo-mark">
        <Icon name="navigation" size={17} />
      </span>
      {!compact && (
        <span>
          <strong>FlowDrop</strong>
          <small>DELIVERY</small>
        </span>
      )}
    </div>
  );
}

function ThemeControl({ theme, setTheme, brand, setBrand }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="theme-control">
      <button
        aria-label="Customize appearance"
        className="icon-btn"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <Icon name="palette" />
      </button>
      {open && (
        <div className="theme-popover glass">
          <div className="popover-heading">
            <div>
              <strong>Appearance</strong>
              <small>Applied across every portal</small>
            </div>
            <button className="icon-btn small" onClick={() => setOpen(false)} type="button">
              <Icon name="close" size={15} />
            </button>
          </div>
          <label className="field-label">Theme mode</label>
          <div className="segmented">
            {[
              ["light", "sun", "Light"],
              ["dark", "moon", "Dark"],
            ].map(([value, icon, label]) => (
              <button
                className={theme === value ? "active" : ""}
                key={value}
                onClick={() => setTheme(value)}
                type="button"
              >
                <Icon name={icon} size={15} />
                {label}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="brand-color">
            Brand color
          </label>
          <div className="color-row">
            {["#087f74", "#2563eb", "#7c3aed", "#c2410c"].map((color) => (
              <button
                aria-label={`Use ${color} as brand color`}
                className={`color-swatch ${brand === color ? "selected" : ""}`}
                key={color}
                onClick={() => setBrand(color)}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
            <input
              aria-label="Custom brand color"
              id="brand-color"
              onChange={(event) => setBrand(event.target.value)}
              type="color"
              value={brand}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PortalSwitcher({ portal, setPortal }) {
  return (
    <div className="portal-switcher glass">
      {[
        ["client", "Client"],
        ["rider", "Rider"],
        ["admin", "Office"],
      ].map(([value, label]) => (
        <button
          className={portal === value ? "active" : ""}
          key={value}
          onClick={() => setPortal(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MobileTopbar({ title, themeProps }) {
  return (
    <header className="mobile-topbar glass">
      <Logo />
      {title && <span className="topbar-title">{title}</span>}
      <div className="topbar-actions">
        <ThemeControl {...themeProps} />
        <button aria-label="Notifications" className="icon-btn notification-btn" type="button">
          <Icon name="bell" />
          <span />
        </button>
      </div>
    </header>
  );
}

function MobileNav({ active, onNavigate, items }) {
  return (
    <nav className="mobile-nav glass">
      {items.map(([value, icon, label, prominent]) => (
        <button
          className={`${active === value ? "active" : ""} ${prominent ? "prominent" : ""}`}
          key={value}
          onClick={() => onNavigate(value)}
          type="button"
        >
          <span className="nav-icon">
            <Icon name={icon} size={prominent ? 21 : 18} />
          </span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}

function AddressBlock({ from, to }) {
  return (
    <div className="route">
      <span className="route-line" />
      <div>
        <span className="route-marker pickup" />
        <small>Pickup</small>
        <strong>{from}</strong>
      </div>
      <div>
        <span className="route-marker destination" />
        <small>Deliver to</small>
        <strong>{to}</strong>
      </div>
    </div>
  );
}

function ClientPortal({ orders, submitOrder, themeProps }) {
  const [page, setPage] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const activeOrder = orders.find((order) => activeStatuses.has(order.status));

  const openTracking = (id) => {
    setSelectedId(id);
    setPage("tracking");
  };

  return (
    <div className="mobile-app">
      <MobileTopbar themeProps={themeProps} />
      <main className="mobile-content">
        {page === "home" && (
          <ClientHome activeOrder={activeOrder} onCreate={() => setPage("new")} onTrack={openTracking} orders={orders} />
        )}
        {page === "orders" && <ClientOrders onTrack={openTracking} orders={orders} />}
        {page === "new" && (
          <NewRequest
            onCancel={() => setPage("home")}
            onSubmit={(order) => {
              submitOrder(order);
              openTracking(order.id);
            }}
          />
        )}
        {page === "tracking" && (
          <TrackingView
            onBack={() => setPage("orders")}
            order={orders.find((order) => order.id === selectedId) || activeOrder || orders[0]}
          />
        )}
        {page === "notifications" && <MobilePlaceholder icon="bell" title="Notifications" />}
        {page === "account" && <MobilePlaceholder icon="user" title="Your account" />}
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

function ClientHome({ activeOrder, onCreate, onTrack, orders }) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">TUESDAY, 02 JUNE</p>
        <h1>Good evening, Moe</h1>
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
                <small>{order.id} · {order.createdAt}</small>
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

function NewRequest({ onCancel, onSubmit }) {
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
          : true;
  const submit = () => {
    const id = `FD-${String(Date.now()).slice(-6)}`;
    onSubmit({
      ...form,
      id,
      client: "Moe Thandar",
      clientPhone: "09 774 221 890",
      createdAt: "Just now",
      updatedAt: "Just now",
      status: "pending",
      paymentStatus: form.paymentMethod === "Mobile banking" ? "pending_approval" : "unpaid",
      cod: Number(form.cod || 0),
      fee: 3000,
      riderId: null,
    });
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
              <small>Optional · JPG or PNG</small>
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
                <strong>Upload payment screenshot</strong>
                <small>Required for office approval</small>
                <input hidden type="file" />
              </label>
            )}
          </>
        )}
        {step === 5 && (
          <>
            <FormIntro icon="check" title="Review your delivery request" text="Confirm these details before submitting." />
            <ReviewSection label="Pickup" title={form.pickupContact} lines={[form.pickupPhone, form.pickup]} />
            <ReviewSection label="Delivery" title={form.receiver} lines={[form.receiverPhone, form.destination]} />
            <ReviewSection label="Product" title={form.product} lines={[`${form.quantity} item(s) · ${form.category}`, form.fragile ? "Fragile handling required" : "Standard handling"]} />
            <ReviewSection label="Payment" title={form.paymentMethod} lines={[`Product COD: ${money(form.cod)}`, "Estimated delivery fee: 3,000 MMK"]} />
          </>
        )}
      </div>
      <div className="sticky-actions glass">
        {step > 1 && <button className="btn secondary" onClick={() => setStep(step - 1)} type="button">Back</button>}
        <button
          className="btn primary grow"
          disabled={!canContinue}
          onClick={() => (step === 5 ? submit() : setStep(step + 1))}
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

function MobilePlaceholder({ icon, title }) {
  return (
    <section className="placeholder">
      <span><Icon name={icon} size={24} /></span>
      <h1>{title}</h1>
      <p>This area is ready for the next implementation milestone.</p>
    </section>
  );
}

function RiderPortal({ orders, riders, progressOrder, themeProps }) {
  const [page, setPage] = useState("jobs");
  const [selectedId, setSelectedId] = useState(null);
  const rider = riders[0];
  const riderOrders = orders.filter((order) => order.riderId === rider.id);
  const selectedOrder = orders.find((order) => order.id === selectedId);

  if (selectedOrder) {
    return (
      <div className="mobile-app rider-app">
        <MobileTopbar themeProps={themeProps} />
        <main className="mobile-content">
          <RiderJobDetail onBack={() => setSelectedId(null)} onProgress={progressOrder} order={selectedOrder} />
        </main>
      </div>
    );
  }
  return (
    <div className="mobile-app rider-app">
      <MobileTopbar themeProps={themeProps} />
      <main className="mobile-content">
        {page === "jobs" && <RiderJobs onOpen={setSelectedId} orders={riderOrders} rider={rider} />}
        {page === "history" && <MobilePlaceholder icon="clock" title="Job history" />}
        {page === "gps" && <GpsStatus />}
        {page === "notifications" && <MobilePlaceholder icon="bell" title="Notifications" />}
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
          <p><span className="online-dot" /> GPS active · Updated just now</p>
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
        {order.fragile && <p className="warning-note">Fragile item · Handle with care</p>}
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

function AdminPortal({ orders, riders, assignRider, selectedOrderId, setSelectedOrderId, themeProps }) {
  const [page, setPage] = useState("dashboard");
  const [assignmentOrder, setAssignmentOrder] = useState(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
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
                    <div><span className="alert-icon warning"><Icon name="card" size={15} /></span><p><strong>Payment awaiting review</strong><small>FD-240621 · 4 min ago</small></p></div>
                    <div><span className="alert-icon info"><Icon name="bike" size={15} /></span><p><strong>Rider location updated</strong><small>Aung Kyaw · 1 min ago</small></p></div>
                  </div>
                </div>
              </section>
            </>
          )}
          {page === "orders" && (
            <section className="panel glass">
              <PanelHeading title="All delivery orders" eyebrow="ORDER MANAGEMENT" action="Export" />
              <div className="table-toolbar">
                <div className="search-box"><Icon name="search" size={16} /><input placeholder="Search order or receiver" /></div>
                <button className="btn secondary" type="button"><Icon name="filter" size={15} /> Filter</button>
              </div>
              <OrderTable orders={orders} riders={riders} selectOrder={setSelectedOrderId} />
            </section>
          )}
          {page === "riders" && <RidersAdmin riders={riders} />}
          {page === "tracking" && <section className="panel full-map glass"><PanelHeading title="Live rider tracking" eyebrow="REAL-TIME MAP" /><AdminMap riders={riders} large /></section>}
          {!["dashboard", "orders", "riders", "tracking"].includes(page) && <AdminPlaceholder page={page} />}
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
                <td><strong>{order.pickup.split(",")[0]} → {order.destination.split(",")[0]}</strong><small>{money(order.cod)} COD</small></td>
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
  return <div className="rider-summary">{riders.slice(0, 4).map((rider) => <div key={rider.id}><span className="avatar">{rider.initials}</span><p><strong>{rider.name}</strong><small>{rider.area} · {rider.lastSeen}</small></p><StatusBadge status={rider.status} /></div>)}</div>;
}

function RidersAdmin({ riders }) {
  return (
    <section className="panel glass">
      <PanelHeading eyebrow="TEAM MANAGEMENT" title="Riders" action="Add rider" />
      <div className="table-toolbar"><div className="search-box"><Icon name="search" size={16} /><input placeholder="Search rider" /></div><button className="btn secondary" type="button"><Icon name="filter" size={15} /> Availability</button></div>
      <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Active orders</th><th>Current area</th><th>Last GPS update</th><th>Cash held</th></tr></thead><tbody>
        {riders.map((rider) => <tr key={rider.id}><td><span className="rider-cell"><i>{rider.initials}</i><span><strong>{rider.name}</strong><small>{rider.phone}</small></span></span></td><td><StatusBadge status={rider.status} /></td><td>{rider.activeOrders}</td><td>{rider.area}</td><td>{rider.lastSeen}</td><td><strong>{money(rider.cashHeld)}</strong></td></tr>)}
      </tbody></table></div>
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
      <section><p className="eyebrow">RIDER ASSIGNMENT</p>{rider ? <div className="assigned-rider"><span className="avatar">{rider.initials}</span><div><strong>{rider.name}</strong><small>{rider.phone} · {rider.vehicle}</small></div></div> : <p className="muted">No rider assigned yet.</p>}</section>
      <div className="drawer-actions"><button className="btn secondary" type="button">Add note</button><button className="btn primary grow" onClick={onAssign} type="button"><Icon name="bike" size={16} /> {rider ? "Change rider" : "Assign rider"}</button></div>
    </aside>
  );
}

function AssignmentModal({ order, riders, close, onAssign }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="modal-backdrop">
      <section className="assignment-modal glass">
        <div className="drawer-header"><div><p className="eyebrow">MANUAL ASSIGNMENT</p><h2>Assign rider</h2><small>{order.id} · Pickup from {order.pickup.split(",")[0]}</small></div><button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button></div>
        <div className="search-box"><Icon name="search" size={16} /><input placeholder="Search rider by name or area" /></div>
        <div className="assignment-list">
          {riders.map((rider) => (
            <button className={selected === rider.id ? "selected" : ""} disabled={rider.status === "offline"} key={rider.id} onClick={() => setSelected(rider.id)} type="button">
              <span className="avatar">{rider.initials}</span><span><strong>{rider.name}</strong><small>{rider.area} · {rider.activeOrders} active · {rider.lastSeen}</small></span><StatusBadge status={rider.status} />
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

export default function App() {
  const [portal, setPortal] = useStoredState("flowdrop.portal", "client");
  const [orders, setOrders] = useStoredState("flowdrop.orders", initialOrders);
  const [riders, setRiders] = useStoredState("flowdrop.riders", initialRiders);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [theme, setTheme] = useStoredState("flowdrop.theme", "light");
  const [brand, setBrand] = useStoredState("flowdrop.brand", "#087f74");
  const themeStyle = useMemo(() => ({ "--color-primary": brand }), [brand]);
  const themeProps = { theme, setTheme, brand, setBrand };

  const submitOrder = (order) => setOrders((current) => [order, ...current]);
  const assignRider = (orderId, riderId) => {
    setOrders((current) => current.map((order) => order.id === orderId ? { ...order, riderId, status: "rider_assigned", updatedAt: "Just now" } : order));
    setRiders((current) => current.map((rider) => rider.id === riderId ? { ...rider, status: "busy", activeOrders: rider.activeOrders + 1 } : rider));
  };
  const progressOrder = (orderId, status) => setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status, updatedAt: "Just now" } : order));

  return (
    <div className="app-root" data-theme={theme} style={themeStyle}>
      <PortalSwitcher portal={portal} setPortal={setPortal} />
      {portal === "client" && <ClientPortal orders={orders} submitOrder={submitOrder} themeProps={themeProps} />}
      {portal === "rider" && <RiderPortal orders={orders} progressOrder={progressOrder} riders={riders} themeProps={themeProps} />}
      {portal === "admin" && <AdminPortal assignRider={assignRider} orders={orders} riders={riders} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} themeProps={themeProps} />}
    </div>
  );
}
