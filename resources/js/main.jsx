import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DeliveryApp from "./DeliveryApp";
import "./styles.css";

const root = document.getElementById("root");

createRoot(root).render(
  <StrictMode>
    <DeliveryApp apiBaseUrl={root.dataset.apiBaseUrl} initialPortal={root.dataset.portal} />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then((registration) => {
        console.info("[pwa] service_worker_registered", { scope: registration.scope });
      })
      .catch((error) => {
        console.warn("[pwa] service_worker_failed", { message: error.message });
      });
  });
}
