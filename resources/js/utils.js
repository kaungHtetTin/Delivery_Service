import { useEffect, useState } from "react";

export const money = (amount) => `${Number(amount || 0).toLocaleString()} MMK`;

export const activeStatuses = new Set([
  "rider_assigned",
  "rider_accepted",
  "going_to_pickup",
  "arrived_at_pickup",
  "picked_up",
  "going_to_delivery",
  "arrived_at_delivery",
  "delivered",
]);

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
