import express, { Express } from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.middleware.js";
import WebSocketService from "./websocket/WebSocketService.js";
import { FRONTEND_URL } from "./config/config.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import passport from "passport";
import "./config/passport-setup.js";
import http from "http";

const app: Express = express();

// app.use(helmet());

app.use(
  cors({
    origin: new URL(FRONTEND_URL).origin,

    credentials: true,
    // methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    // allowedHeaders: [
    //   //   "Access-Control-Allow-Origin",
    //   "Content-Type",
    //   "Authorization",
    //   "Origin",
    //   "X-Requested-With",
    //   "Accept",
    // ],
    // exposedHeaders: ["Access-Control-Allow-Credentials"],
  })
);

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

//  routes

import authRouter from "./routes/auth.route.js";
import roomRouter from "./routes/room.route.js";
// import songRouter from "./routes/song.route";

//  routes declaration

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/room", roomRouter);

app.use(errorHandler as express.ErrorRequestHandler);

// websocket implementation
const server = http.createServer(app);

new WebSocketService(server);

export { server };
