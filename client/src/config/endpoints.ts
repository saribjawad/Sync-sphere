// Production uses the current site; local development can override the API host.
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";

const apiUrl = new URL(configuredApiUrl, window.location.origin);
if (
  !["http:", "https:"].includes(apiUrl.protocol) ||
  apiUrl.username ||
  apiUrl.password ||
  apiUrl.search ||
  apiUrl.hash
) {
  throw new Error(
    "VITE_API_BASE_URL must be an HTTP(S) URL or path without credentials, a query, or a fragment"
  );
}
export const API_URL = apiUrl.toString().replace(/\/+$/, "");

// WebSockets share the API host, but connect at / rather than /api/v1.
const socketUrl = new URL(API_URL);
socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
socketUrl.pathname = "/";
socketUrl.search = "";
socketUrl.hash = "";

export const WEBSOCKET_URL = socketUrl.toString();
