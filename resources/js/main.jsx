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
