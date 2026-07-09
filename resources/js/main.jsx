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
    const appBaseUrl = root.dataset.appBaseUrl || window.location.origin;
    const serviceWorkerUrl = root.dataset.serviceWorkerUrl || new URL("service-worker.js", `${appBaseUrl.replace(/\/$/, "")}/`).toString();
    const serviceWorkerScope = `${appBaseUrl.replace(/\/$/, "")}/`;

    navigator.serviceWorker.register(serviceWorkerUrl, { scope: serviceWorkerScope })
      .then((registration) => {
        console.info("[pwa] service_worker_registered", { scope: registration.scope });
      })
      .catch((error) => {
        console.warn("[pwa] service_worker_failed", { message: error.message });
      });
  });
}
