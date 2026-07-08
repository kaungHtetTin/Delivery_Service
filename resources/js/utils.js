import { useEffect, useState } from "react";

export const money = (amount) => `${Number(amount || 0).toLocaleString()} MMK`;

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

export function applyPublicSettings(settings, { setAppName, setBrand, setContactEmail, setContactPhone, setTheme }) {
  const values = settingsByKey(settings);

  if (values.brand_color) {
    setBrand?.(values.brand_color);
  }

  if (values.default_theme) {
    setTheme?.(values.default_theme);
  }

  if (values.app_name) {
    setAppName?.(values.app_name);
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
