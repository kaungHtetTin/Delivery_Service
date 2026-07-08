import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { statusLabels } from "../data";
import { activeStatuses, currentDateLabel, formatDeliveryFeeLabel, money, useStoredState } from "../utils";
import { AddressBlock, MobileNav, MobileTopbar, NotificationList, StatusBadge } from "../components/shared";

const canModifyPendingOrder = (order) => order?.status === "pending";

export function ClientPortal({ addresses = [], appName, contactEmail = "", contactPhone = "", markNotificationRead, notifications = [], onLogout, orders, removeAddress, removeOrder, saveAddress, saveOrder, saveProfile, saveShop, setDefaultAddress, shops = [], submitOrder, themeProps, user }) {
  const [page, setPage] = useStoredState("flowdrop.client.page", "home");
  const [selectedId, setSelectedId] = useStoredState("flowdrop.client.selectedOrder", null);
  const activeOrder = orders.find((order) => activeStatuses.has(order.status));
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const selectedOrder = orders.find((order) => order.id === selectedId);

  const openTracking = (id) => {
    setSelectedId(id);
    setPage("tracking");
  };
  const editOrder = (id) => {
    setSelectedId(id);
    setPage("edit");
  };
  const deleteOrder = async (order) => {
    if (!canModifyPendingOrder(order) || !window.confirm(`Delete ${order.id}?`)) {
      return;
    }

    await removeOrder(order.id);
    setSelectedId(null);
    setPage("orders");
  };

  return (
    <div className="mobile-app">
      <MobileTopbar appName={appName} onNotifications={() => setPage("notifications")} themeProps={themeProps} unreadCount={unreadCount} />
      <main className="mobile-content">
        {page === "home" && (
          <ClientHome activeOrder={activeOrder} contactEmail={contactEmail} contactPhone={contactPhone} onCreate={() => setPage("new")} onTrack={openTracking} onViewAll={() => setPage("orders")} orders={orders} user={user} />
        )}
        {page === "orders" && <ClientOrders onDelete={deleteOrder} onEdit={editOrder} onTrack={openTracking} orders={orders} />}
        {page === "new" && (
          <NewRequest
            addresses={addresses}
            onCancel={() => setPage("home")}
            onSubmit={async (order) => {
              const submittedOrder = await submitOrder(order);
              openTracking(submittedOrder.id);
              return submittedOrder;
            }}
            shops={shops}
            user={user}
          />
        )}
        {page === "edit" && selectedOrder && (
          <NewRequest
            addresses={addresses}
            initialOrder={selectedOrder}
            mode="edit"
            onCancel={() => openTracking(selectedOrder.id)}
            onSubmit={async (order) => {
              const savedOrder = await saveOrder(order);
              openTracking(savedOrder.id);
              return savedOrder;
            }}
            shops={shops}
            user={user}
          />
        )}
        {page === "tracking" && (
          <TrackingView
            onDelete={deleteOrder}
            onEdit={editOrder}
            onBack={() => setPage("orders")}
            order={selectedOrder || activeOrder || orders[0]}
          />
        )}
        {page === "notifications" && <NotificationList notifications={notifications} onRead={markNotificationRead} title="Notifications" />}
        {page === "account" && (
          <ClientAccount
            addresses={addresses}
            onLogout={onLogout}
            removeAddress={removeAddress}
            saveAddress={saveAddress}
            saveProfile={saveProfile}
            saveShop={saveShop}
            setDefaultAddress={setDefaultAddress}
            shops={shops}
            user={user}
          />
        )}
      </main>
      {!["new", "edit"].includes(page) && (
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

function ClientHome({ activeOrder, contactEmail, contactPhone, onCreate, onTrack, onViewAll, orders, user }) {
  const firstName = user?.name?.split(" ")[0] || "there";
  const phoneHref = contactPhone ? `tel:${contactPhone.replace(/[^\d+]/g, "")}` : "";
  const hasContact = Boolean(contactEmail || contactPhone);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">{currentDateLabel()}</p>
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
      {hasContact && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SUPPORT</span>
              <h2>Office contact</h2>
            </div>
          </div>
          <div className="support-contact-card glass">
            <p>For complaints or emergency help, contact the delivery office directly.</p>
            <div className="support-contact-actions">
              {contactPhone && (
                <a className="btn secondary full support-contact-btn" href={phoneHref}>
                  <Icon name="phone" size={16} />
                  <span>
                    <strong>Emergency call</strong>
                    <small>{contactPhone}</small>
                  </span>
                </a>
              )}
              {contactEmail && (
                <a className="btn secondary full support-contact-btn" href={`mailto:${contactEmail}`}>
                  <Icon name="mail" size={16} />
                  <span>
                    <strong>Send complaint</strong>
                    <small>{contactEmail}</small>
                  </span>
                </a>
              )}
            </div>
          </div>
        </section>
      )}
      {activeOrder && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ACTIVE DELIVERY</span>
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
          <button className="text-btn" onClick={onViewAll} type="button">
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

function ClientOrders({ orders, onDelete, onEdit, onTrack }) {
  const [filter, setFilter] = useStoredState("flowdrop.client.orderFilter", "all");
  const [search, setSearch] = useStoredState("flowdrop.client.orderSearch", "");
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = !search || order.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && activeStatuses.has(order.status)) ||
      (filter === "completed" && ["completed", "delivered"].includes(order.status));

    return matchesSearch && matchesFilter;
  });

  return (
    <section className="page-section">
      <p className="eyebrow">ORDER HISTORY</p>
      <h1>My deliveries</h1>
      <div className="search-box">
        <Icon name="search" size={17} />
        <input onChange={(event) => setSearch(event.target.value)} placeholder="Search by order code" value={search} />
      </div>
      <div className="filter-pills">
        {[
          ["all", "All"],
          ["active", "Active"],
          ["completed", "Completed"],
        ].map(([value, label]) => (
          <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} type="button">{label}</button>
        ))}
      </div>
      <div className="delivery-list">
        {filteredOrders.length === 0 && (
          <section className="placeholder compact-placeholder">
            <span><Icon name="box" size={23} /></span>
            <h2>No deliveries found</h2>
            <p>Try another filter or order code.</p>
          </section>
        )}
        {filteredOrders.map((order) => (
          <article className="delivery-list-card glass" key={order.id}>
            <div className="card-row">
              <span className="order-code">{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <AddressBlock from={order.pickup} to={order.destination} />
            <div className="card-footer">
              <span>{order.createdAt}</span>
              <strong>{formatDeliveryFeeLabel(order)}</strong>
            </div>
            <div className="address-actions">
              <button className="btn secondary" onClick={() => onTrack(order.id)} type="button">Track</button>
              {canModifyPendingOrder(order) && <button className="btn secondary" onClick={() => onEdit(order.id)} type="button">Edit</button>}
              {canModifyPendingOrder(order) && <button className="btn danger" onClick={() => onDelete(order)} type="button">Delete</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientAccount({ addresses, onLogout, removeAddress, saveAddress, saveProfile, saveShop, setDefaultAddress, shops, user }) {
  const [profile, setProfile] = useState({
    name: user.name || "",
    phone: user.phone || "",
    email: user.email || "",
  });
  const defaultPickupShop = shops.find((shop) => shop.status === "active" && shop.isDefault) || shops.find((shop) => shop.status === "active") || shops[0];
  const [editingAddress, setEditingAddress] = useState(null);
  const [editingShop, setEditingShop] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const updateProfile = (key, value) => setProfile((current) => ({ ...current, [key]: value }));

  return (
    <section className="page-section">
      <p className="eyebrow">ACCOUNT</p>
      <h1>Your account</h1>
      <form
        className="account-panel glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSavingProfile(true);
          await saveProfile(profile);
          setSavingProfile(false);
        }}
      >
        <div className="section-heading">
          <div><span className="eyebrow">PROFILE</span><h2>Contact details</h2></div>
        </div>
        <TextField label="Full name" onChange={(value) => updateProfile("name", value)} value={profile.name} />
        <TextField inputMode="tel" label="Phone number" onChange={(value) => updateProfile("phone", value)} value={profile.phone} />
        <TextField label="Email" onChange={(value) => updateProfile("email", value)} value={profile.email} />
        <button className="btn primary full" disabled={savingProfile} type="submit">{savingProfile ? "Saving..." : "Save profile"}</button>
      </form>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">SHIPPING</span><h2>Saved addresses</h2></div>
          <button className="text-btn" onClick={() => setEditingAddress({})} type="button">Add address</button>
        </div>
        <div className="delivery-list">
          {addresses.length === 0 && (
            <button className="delivery-list-card glass" onClick={() => setEditingAddress({})} type="button">
              <div className="card-row"><strong>Add default shipping address</strong><Icon name="plus" size={17} /></div>
              <p>Save a receiver address to speed up future delivery requests.</p>
            </button>
          )}
          {addresses.map((address) => (
            <article className="delivery-list-card glass address-card" key={address.id}>
              <div className="card-row">
                <div><span className="order-code">{address.label}</span><small>{address.recipientName} - {address.phone}</small></div>
                {address.isDefault ? <StatusBadge status="default" /> : <StatusBadge status="active" />}
              </div>
              <p>{address.address}</p>
              {address.note && <small>{address.note}</small>}
              <div className="address-actions">
                {!address.isDefault && <button className="btn secondary" onClick={() => setDefaultAddress(address.id)} type="button">Set default</button>}
                <button className="btn secondary" onClick={() => setEditingAddress(address)} type="button">Edit</button>
                <button className="btn danger" onClick={() => window.confirm(`Delete ${address.label}?`) && removeAddress(address.id)} type="button">Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">PICKUP</span><h2>Default business pickup</h2></div>
          <button className="text-btn" onClick={() => setEditingShop(defaultPickupShop || {})} type="button">{defaultPickupShop ? "Edit" : "Add"}</button>
        </div>
        {defaultPickupShop ? (
          <article className="delivery-list-card glass address-card">
            <div className="card-row">
              <div><span className="order-code">{defaultPickupShop.name}</span><small>{defaultPickupShop.contactName || defaultPickupShop.phone}</small></div>
              <StatusBadge status="default" />
            </div>
            <p>{defaultPickupShop.address}</p>
            {defaultPickupShop.note && <small>{defaultPickupShop.note}</small>}
            <div className="address-actions">
              <button className="btn secondary" onClick={() => setEditingShop(defaultPickupShop)} type="button">Edit default pickup</button>
            </div>
          </article>
        ) : (
          <button className="delivery-list-card glass" onClick={() => setEditingShop({})} type="button">
            <div className="card-row"><strong>Add default pickup address</strong><Icon name="plus" size={17} /></div>
            <p>Save your shop or business location to prefill pickup details in future delivery requests.</p>
          </button>
        )}
      </section>

      <button className="btn secondary full account-logout" onClick={onLogout} type="button">
        <Icon name="lock" size={16} /> Logout
      </button>

      {editingAddress && (
        <AddressEditor
          address={editingAddress}
          close={() => setEditingAddress(null)}
          onSave={(address) => saveAddress(address).then(() => setEditingAddress(null))}
          user={user}
        />
      )}
      {editingShop && (
        <ShopEditor
          close={() => setEditingShop(null)}
          onSave={(shop) => saveShop({ ...shop, isDefault: true, status: "active" }).then(() => setEditingShop(null))}
          shop={editingShop}
          user={user}
        />
      )}
    </section>
  );
}

function AddressEditor({ address, close, onSave, user }) {
  const [form, setForm] = useState({
    _apiId: address._apiId,
    id: address.id,
    label: address.label || "Home",
    recipientName: address.recipientName || user.name || "",
    phone: address.phone || user.phone || "",
    address: address.address || "",
    isDefault: address.isDefault ?? false,
    note: address.note || "",
  });
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal compact glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">SHIPPING ADDRESS</p><h2>{form._apiId ? "Edit address" : "Add address"}</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="crud-grid">
          <TextField label="Label" onChange={(value) => update("label", value)} value={form.label} />
          <TextField label="Recipient" onChange={(value) => update("recipientName", value)} value={form.recipientName} />
          <TextField inputMode="tel" label="Phone" onChange={(value) => update("phone", value)} value={form.phone} />
          <TextField label="Address" onChange={(value) => update("address", value)} value={form.address} />
          <TextField label="Note" onChange={(value) => update("note", value)} value={form.note} />
          <label className="switch-row glass">
            <span><strong>Default shipping address</strong><small>Use this address first in future forms</small></span>
            <input checked={form.isDefault} onChange={(event) => update("isDefault", event.target.checked)} type="checkbox" />
            <i />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={saving || !form.address || !form.recipientName || !form.phone} type="submit">{saving ? "Saving..." : "Save address"}</button>
        </div>
      </form>
    </div>
  );
}

function ShopEditor({ close, onSave, shop, user }) {
  const [form, setForm] = useState({
    _apiId: shop._apiId,
    id: shop.id,
    name: shop.name || "",
    contactName: shop.contactName || user.name || "",
    phone: shop.phone || user.phone || "",
    email: shop.email || user.email || "",
    address: shop.address || "",
    status: shop.status || "active",
    isDefault: true,
    note: shop.note || "",
  });
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="modal-backdrop">
      <form
        className="operation-modal compact glass"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }}
      >
        <div className="drawer-header">
          <div><p className="eyebrow">PICKUP SHOP</p><h2>{form._apiId ? "Edit shop" : "Add shop"}</h2></div>
          <button className="icon-btn" onClick={close} type="button"><Icon name="close" /></button>
        </div>
        <div className="crud-grid">
          <TextField label="Shop name" onChange={(value) => update("name", value)} value={form.name} />
          <TextField label="Pickup contact" onChange={(value) => update("contactName", value)} value={form.contactName} />
          <TextField inputMode="tel" label="Phone" onChange={(value) => update("phone", value)} value={form.phone} />
          <TextField label="Email" onChange={(value) => update("email", value)} value={form.email} />
          <TextField label="Pickup address" onChange={(value) => update("address", value)} value={form.address} />
          <TextField label="Note" onChange={(value) => update("note", value)} value={form.note} />
          <p className="muted span-2">This is the default pickup address used first in future delivery forms.</p>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" onClick={close} type="button">Cancel</button>
          <button className="btn primary" disabled={saving || !form.name || !form.address || !form.phone} type="submit">{saving ? "Saving..." : "Save shop"}</button>
        </div>
      </form>
    </div>
  );
}

function NewRequest({ addresses = [], initialOrder = null, mode = "create", onCancel, onSubmit, shops = [], user }) {
  const defaultAddress = addresses.find((address) => address.isDefault);
  const activeShops = shops.filter((shop) => shop.status === "active");
  const defaultShop = activeShops.find((shop) => shop.isDefault) || activeShops[0];
  const isEditing = mode === "edit" && initialOrder;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    shopId: initialOrder?.shopId || defaultShop?._apiId || "",
    pickupContact: initialOrder?.pickupContact || defaultShop?.contactName || defaultShop?.name || "",
    pickupPhone: initialOrder?.pickupPhone || defaultShop?.phone || "",
    pickup: initialOrder?.pickup || defaultShop?.address || "",
    receiver: initialOrder?.receiver || defaultAddress?.recipientName || "",
    receiverPhone: initialOrder?.receiverPhone || defaultAddress?.phone || "",
    destination: initialOrder?.destination || defaultAddress?.address || "",
    product: initialOrder?.product || "",
    category: initialOrder?.category || "Package",
    quantity: initialOrder?.quantity || "1",
    fragile: Boolean(initialOrder?.fragile),
    paymentMethod: initialOrder?.paymentMethod || "Cash",
    fee: initialOrder?.fee ? String(initialOrder.fee) : "",
    codEnabled: Boolean(initialOrder?.codEnabled),
    paymentScreenshot: null,
    note: initialOrder?.note || "",
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseAddress = (address) => setForm((current) => ({
    ...current,
    receiver: address.recipientName,
    receiverPhone: address.phone,
    destination: address.address,
  }));
  const chooseShop = (shop) => setForm((current) => ({
    ...current,
    shopId: shop._apiId || "",
    pickupContact: shop.contactName || shop.name,
    pickupPhone: shop.phone,
    pickup: shop.address,
  }));

  useEffect(() => {
    if (!defaultAddress || form.receiver || form.receiverPhone || form.destination) {
      return;
    }

    chooseAddress(defaultAddress);
  }, [defaultAddress?._apiId]);
  useEffect(() => {
    if (!defaultShop || form.pickupContact || form.pickupPhone || form.pickup) {
      return;
    }

    chooseShop(defaultShop);
  }, [defaultShop?._apiId]);
  const canContinue =
    step === 1
      ? form.pickupContact && form.pickupPhone && form.pickup
      : step === 2
        ? true
        : step === 3
          ? form.product
          : true;
  const submit = async () => {
    const id = `FD-${String(Date.now()).slice(-6)}`;
    const submittedOrder = await onSubmit({
      ...(initialOrder || {}),
      ...form,
      id: initialOrder?.id || id,
      client: user.name,
      clientPhone: user.phone,
      createdAt: initialOrder?.createdAt || "Just now",
      updatedAt: "Just now",
      status: initialOrder?.status || "pending",
      paymentStatus: initialOrder?.paymentStatus || "unpaid",
      paymentScreenshot: null,
      codEnabled: Boolean(form.codEnabled),
      cod: initialOrder?.cod || 0,
      fee: Number(form.fee || 0),
      riderId: initialOrder?.riderId || null,
    });
    return submittedOrder;
  };
  const saveRequest = async () => {
    setSaving(true);
    setError("");

    try {
      await submit();
    } catch (saveError) {
      const message =
        saveError?.payload?.message ||
        Object.values(saveError?.payload?.errors || {})?.[0]?.[0] ||
        saveError?.message ||
        "Unable to save this delivery request.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="request-flow">
      <div className="request-header">
        <button className="icon-btn" onClick={onCancel} type="button"><Icon name="close" /></button>
        <div>
          <small>{isEditing ? "EDIT DELIVERY REQUEST" : "NEW DELIVERY REQUEST"}</small>
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
          </>
        )}
        {step === 2 && (
          <>
            <FormIntro icon="navigation" title="Where are we delivering?" text="Add destination details now or let the rider confirm them at pickup." />
            {addresses.length > 0 && (
              <div className="saved-address-strip">
                {addresses.map((address) => (
                  <button className={address.isDefault ? "selected" : ""} key={address.id} onClick={() => chooseAddress(address)} type="button">
                    <strong>{address.label}</strong>
                    <small>{address.address}</small>
                  </button>
                ))}
              </div>
            )}
            <TextField label="Receiver name (optional)" onChange={(value) => update("receiver", value)} placeholder="Full name" value={form.receiver} />
            <TextField inputMode="tel" label="Receiver phone number (optional)" onChange={(value) => update("receiverPhone", value)} placeholder="09 xxx xxx xxx" value={form.receiverPhone} />
            <TextField label="Delivery address (optional)" onChange={(value) => update("destination", value)} placeholder="Street, township" value={form.destination} />
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
          </>
        )}
        {step === 4 && (
          <>
            <FormIntro icon="wallet" title="Delivery fee payment" text="Choose how you want to pay the delivery fee. The rider confirms the final fee after delivery." />
            <label className="field-label">Fee payment method</label>
            <div className="payment-options">
              {["Cash", "Banking"].map((method) => (
                <button
                  className={form.paymentMethod === method ? "selected" : ""}
                  key={method}
                  onClick={() => update("paymentMethod", method)}
                  type="button"
                >
                  <Icon name="wallet" size={17} />
                  {method}
                </button>
              ))}
            </div>
            <label className="switch-row glass">
              <span><strong>COD cash on delivery</strong><small>Rider collects product payment from receiver</small></span>
              <input checked={form.codEnabled} onChange={(event) => update("codEnabled", event.target.checked)} type="checkbox" />
              <i />
            </label>
          </>
        )}
        {step === 5 && (
          <>
            <FormIntro icon="check" title="Review your delivery request" text="Confirm these details before submitting." />
            <ReviewSection label="Pickup" title={form.pickupContact} lines={[form.pickupPhone, form.pickup]} />
            <ReviewSection label="Delivery" title={form.receiver} lines={[form.receiverPhone, form.destination]} />
            <ReviewSection label="Product" title={form.product} lines={[`${form.quantity} item(s) - ${form.category}`, form.fragile ? "Fragile handling required" : "Standard handling"]} />
            <ReviewSection label="Payment" title={form.paymentMethod} lines={["Final fee set by rider after delivery", `Product COD: ${form.codEnabled ? "On" : "Off"}`]} />
          </>
        )}
      </div>
      {error && <p className="auth-error request-error">{error}</p>}
      <div className="sticky-actions glass">
        {step > 1 && <button className="btn secondary" onClick={() => setStep(step - 1)} type="button">Back</button>}
        <button
          className="btn primary grow"
          disabled={!canContinue || saving}
          onClick={async () => {
            if (step < 5) {
              setStep(step + 1);
              return;
            }

            await saveRequest();
          }}
          type="button"
        >
          {saving ? "Saving..." : step === 5 ? (isEditing ? "Save delivery request" : "Submit delivery request") : "Continue"}
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

function TrackingView({ order, onBack, onDelete, onEdit }) {
  if (!order) return null;
  const steps = ["pending", "rider_assigned", "rider_accepted", "picked_up", "delivered"];
  const trackingIndex = {
    pending: 0,
    approved: 0,
    rider_assigned: 1,
    rider_accepted: 2,
    going_to_pickup: 1,
    arrived_at_pickup: 1,
    picked_up: 3,
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
        <span className="map-static-note">Status map</span>
      </div>
      <div className="tracking-status glass">
        <p className="eyebrow">CURRENT STATUS</p>
        <h2>{statusLabels[order.status]}</h2>
        <p>{order.status === "pending" ? "The office team will review your request shortly." : "This mini version shows workflow status updates, not live GPS tracking."}</p>
        {canModifyPendingOrder(order) && (
          <div className="address-actions">
            <button className="btn secondary" onClick={() => onEdit(order.id)} type="button">Edit request</button>
            <button className="btn danger" onClick={() => onDelete(order)} type="button">Delete request</button>
          </div>
        )}
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
        <div className="card-footer"><span>Delivery fee</span><strong>{formatDeliveryFeeLabel(order)}</strong></div>
      </div>
    </section>
  );
}
