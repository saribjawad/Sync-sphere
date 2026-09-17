import express, { Express } from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import WebSocketService from "./websocket/WebSocketService.js";
import { FRONTEND_URL, NODE_ENV } from "./config/config.js";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import passport from "passport";
import "./config/passport-setup.js";
import http from "http";
import authRouter from "./routes/auth.route.js";
import roomRouter from "./routes/room.route.js";

const app: Express = express();

// Local development uses separate frontend and backend origins.
app.use(
  cors({
    origin: new URL(FRONTEND_URL).origin,
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/room", roomRouter);

// Keep unknown API endpoints from falling through to the React app.
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

if (NODE_ENV === "production") {
  const clientDist = fileURLToPath(
    new URL("../../client/dist/", import.meta.url)
  );
  const indexFile = path.join(clientDist, "index.html");
  if (!existsSync(indexFile)) {
    throw new Error(
      "Frontend build missing. Run bash scripts/render-build.sh from the repository root."
    );
  }

  app.use(express.static(clientDist));
  // Missing assets should return 404, not the SPA document.
  app.use("/assets", (_req, res) => {
    res.sendStatus(404);
  });
  // React Router handles page URLs such as /room after index.html loads.
  app.get("*", (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexFile);
  });
}

app.use(errorHandler as express.ErrorRequestHandler);

// HTTP requests and WebSocket connections share the same server and port.
const server = http.createServer(app);

new WebSocketService(server);

export { server };
