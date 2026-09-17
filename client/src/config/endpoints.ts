const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
if (!configuredApiUrl) {
  throw new Error("Missing required environment variable: VITE_API_BASE_URL");
}

const apiUrl = new URL(configuredApiUrl);
if (
  !["http:", "https:"].includes(apiUrl.protocol) ||
  apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash
) {
  throw new Error("VITE_API_BASE_URL must be an absolute HTTP or HTTPS URL without credentials, a query, or a fragment");
}
export const API_URL = apiUrl.toString().replace(/\/+$/, "");

const socketUrl = new URL(API_URL);
socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
socketUrl.pathname = "/";
socketUrl.search = "";
socketUrl.hash = "";

export const WEBSOCKET_URL = socketUrl.toString();
