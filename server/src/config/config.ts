import dotenv from "dotenv";

dotenv.config();

const requiredHttpUrl = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${name} must be an absolute HTTP or HTTPS URL`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must not contain credentials, a query, or a fragment`);
  }
  return url.toString().replace(/\/+$/, "");
};

export const PORT = process.env.PORT;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const MONGODB_URI = process.env.MONGODB_URI;
export const DB_NAME = process.env.DB_NAME;
export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
export const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY;
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
export const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY;
export const FRONTEND_URL = requiredHttpUrl("FRONTEND_URL");
export const GOOGLE_CALLBACK_URL = requiredHttpUrl("GOOGLE_CALLBACK_URL");
export const NODE_ENV = process.env.NODE_ENV;
