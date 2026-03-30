import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = typeof resource === "string" ? resource : (resource as Request).url;
  if (url.startsWith("/api")) {
    const token = localStorage.getItem("darbby_token");
    const newConfig = { ...config } as RequestInit;
    newConfig.headers = { ...(newConfig.headers ?? {}) };
    if (token) {
      (newConfig.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
    const fullUrl = API_BASE + url;
    return originalFetch(fullUrl, newConfig);
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById("root")!).render(<App />);
