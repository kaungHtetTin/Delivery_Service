import { useEffect, useState } from "react";

export const money = (amount) => `${Number(amount || 0).toLocaleString()} MMK`;

export function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function currentMonthDateRange(date = new Date()) {
  return {
    date_from: dateInputValue(new Date(date.getFullYear(), date.getMonth(), 1)),
    date_to: dateInputValue(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export const currentDateLabel = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).toUpperCase();

export const activeStatuses = new Set([
  "rider_assigned",
  "rider_accepted",
  "picked_up",
  "delivered",
]);

export const cashDeliveryFeeMethods = new Set(["Cash on delivery", "Cash", "cash", "cash_on_delivery"]);

export const deliveryFeeCashDue = (order) =>
  order.status === "completed" ? Number(order.fee || 0) : 0;

export const formatDeliveryFeeLabel = (order) => {
  if (order.status === "completed" || Number(order.fee) > 0) {
    return money(order.fee);
  }

  return "Set at completion";
};

export function useStoredState(key, initialValue) {
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

export function settingsByKey(settings) {
  return settings.reduce((map, setting) => {
    map[setting.key] = setting.value;
    return map;
  }, {});
}

export function applyPublicSettings(settings, { setAppIconUrl, setAppName, setBrand, setContactEmail, setContactPhone, setFaviconUrl }) {
  const values = settingsByKey(settings);

  if (values.brand_color) {
    setBrand?.(values.brand_color);
  }

  if (values.app_name) {
    setAppName?.(values.app_name);
  }

  if (values.app_icon !== undefined) {
    setAppIconUrl?.(values.app_icon || "");
  }

  if (values.favicon !== undefined) {
    setFaviconUrl?.(values.favicon || "");
    applyFavicon(values.favicon || "");
  }

  if (values.contact_email) {
    setContactEmail?.(values.contact_email);
  }

  if (values.contact_phone) {
    setContactPhone?.(values.contact_phone);
  }
}

export function applyBrandingSettings(settings, handlers) {
  applyPublicSettings(settings, handlers);
}

export function applyFavicon(url) {
  if (typeof document === "undefined") {
    return;
  }

  let link = document.querySelector('link[rel="icon"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  if (url) {
    link.href = url;
  }
}
