import { Router } from "express";
import passport from "passport";
import {
  getUserInfo,
  handleGoogleLogout,
  handleGoogleLogin,
  refreshAccessToken,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.post("/refresh-token", refreshAccessToken);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  handleGoogleLogin
);
router.post("/google/logout", verifyJWT, handleGoogleLogout);
router.get("/get-user", verifyJWT, getUserInfo);

export default router;
