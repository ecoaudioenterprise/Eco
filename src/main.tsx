import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import { GlobalErrorBoundary } from "./components/common/GlobalErrorBoundary.tsx";

// Initialize Sentry for Capacitor and React
Sentry.init({
  dsn: "https://b2ede3e2a7625f721834a3a509300822@o4510649303105536.ingest.de.sentry.io/4510649317195856",
  integrations: [
    SentryReact.browserTracingIntegration(),
  ],
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production.
  tracesSampleRate: 1.0,
}, SentryReact.init);

createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
