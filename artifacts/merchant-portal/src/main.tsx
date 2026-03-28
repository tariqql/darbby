import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = typeof resource === "string" ? resource : (resource as Request).url;
  if (url.startsWith("/api")) {
    const token = localStorage.getItem("darbby_token");
    if (token) {
      const newConfig = { ...config } as RequestInit;
      newConfig.headers = { ...newConfig.headers, Authorization: `Bearer ${token}` };
      return originalFetch(resource, newConfig);
    }
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById("root")!).render(<App />);
