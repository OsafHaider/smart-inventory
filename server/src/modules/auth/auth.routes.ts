import { Router } from "express";
import {
  handleLogin,
  handleRegister,
  handleRefreshToken,
  handleLogout,
  handleLogoutAllDevices,
  handleGetDevices,
  handleLogoutSpecificDevice,
  handleProfile,
} from "./auth.controller";
import { validateBody } from "../../middlewares/validation";
import { userLoginSchema, userRegisterSchema } from "../../utils/schema/user";
import { verifyAccessToken } from "../../middlewares/jwt";

export const AuthRouter = Router();

AuthRouter.post("/register", validateBody(userRegisterSchema), handleRegister);
AuthRouter.post("/login", validateBody(userLoginSchema), handleLogin);
AuthRouter.get("/refresh", handleRefreshToken);
AuthRouter.get("/profile", verifyAccessToken, handleProfile);
AuthRouter.post("/logout", verifyAccessToken, handleLogout);
AuthRouter.post(
  "/logout-all-devices",
  verifyAccessToken,
  handleLogoutAllDevices
);
AuthRouter.get("/devices", verifyAccessToken, handleGetDevices);
AuthRouter.post(
  "/logout-device",
  verifyAccessToken,
  handleLogoutSpecificDevice
);
