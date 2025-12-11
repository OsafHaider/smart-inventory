import { Request, Response, NextFunction } from "express";
import User from "../user/user.model";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../middlewares/jwt";
import ENV from "../../utils/env";
import Session from "../user/session.model";
import { CustomError } from "../../middlewares/error";

// 30 minutes (matches JWT refresh token expiry)
const REFRESH_TOKEN_EXPIRY = 30 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: ENV.NODE_ENV === "production" || ENV.NODE_ENV === "development",
  sameSite: "strict" as const,
  maxAge: REFRESH_TOKEN_EXPIRY,
};

export const handleRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, avatar, role } = req.body;
    const isEmailExists = await User.findOne({ email });
    if (isEmailExists) {
      throw new CustomError(409, "Email already in use");
    }

    const saltRounds = Number(ENV.BCRYPT_SALT_ROUNDS_PASSWORD) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
      id: uuidv4(),
      name,
      password: hashedPassword,
      email,
      avatar: avatar || "",
      role: role || "user",
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        role: newUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError(400, "Email and password are required");
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomError(401, "Invalid password");
    }

    // 1. Generate tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // 2. Hash token before saving in DB
    const hashedToken = await bcrypt.hash(
      refreshToken,
      Number(ENV.BCRYPT_SALT_ROUNDS_TOKEN) || 10
    );

    // 3. Create device session
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
    const session = await Session.create({
      userId: user._id,
      refreshToken: hashedToken,
      userAgent: req.headers["user-agent"] || "Unknown",
      ip: req.ip || "Unknown",
      expiresAt,
    });

    // 4. Set cookies: refreshToken + sessionId
    res.cookie("refreshToken", refreshToken, cookieOptions);
    res.cookie("sessionId", session._id.toString(), cookieOptions);

    // 5. Response
    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    const user = await User.findOne({ id: userId }).select("-password");

    if (!user) {
      throw new CustomError(404, "User not found");
    }

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId, refreshToken: oldRefreshToken } = req.cookies;

    if (!sessionId || !oldRefreshToken) {
      throw new CustomError(400, "Missing session or refresh token", false);
    }

    // 1. Find session in DB
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new CustomError(401, "Session not found");
    }

    // 2. Check refreshToken hash match
    const isValid = await bcrypt.compare(oldRefreshToken, session.refreshToken);
    if (!isValid) {
      throw new CustomError(401, "Invalid refresh token");
    }

    // 3. Check expiry
    if (new Date() > session.expiresAt) {
      await Session.findByIdAndDelete(sessionId);
      res.clearCookie("refreshToken");
      res.clearCookie("sessionId");
      throw new CustomError(401, "Refresh token expired");
    }

    // 4. Verify refresh token validity
    const decoded = verifyRefreshToken(oldRefreshToken);

    // 5. Generate new tokens
    const newAccessToken = generateAccessToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    const newRefreshToken = generateRefreshToken({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    const hashedNewToken = await bcrypt.hash(
      newRefreshToken,
      Number(ENV.BCRYPT_SALT_ROUNDS_TOKEN) || 10
    );

    // 6. Rotate refresh token in session
    await Session.findByIdAndUpdate(sessionId, {
      refreshToken: hashedNewToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
    });

    // 7. Set new cookie
    res.cookie("refreshToken", newRefreshToken, cookieOptions);

    // 8. Send new access token
    res.status(200).json({
      success: true,
      message: "Access token refreshed",
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export const handleLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      throw new CustomError(400, "Session ID not found");
    }

    // Delete current session from DB
    await Session.findByIdAndDelete(sessionId);

    // Clear cookies
    res.clearCookie("refreshToken");
    res.clearCookie("sessionId");

    res.status(200).json({
      success: true,
      message: "Logged out successfully from this device",
    });
  } catch (error) {
    next(error);
  }
};

export const handleLogoutAllDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    // Find user's MongoDB ID
    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    // Delete all sessions for this user
    const result = await Session.deleteMany({ userId: user._id });

    // Clear cookies
    res.clearCookie("refreshToken");
    res.clearCookie("sessionId");

    res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully",
      sessionsDeleted: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    // Find user's MongoDB ID
    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    // Get all sessions for this user
    const sessions = await Session.find({ userId: user._id }).select(
      "userAgent ip deviceName createdAt expiresAt"
    );

    res.status(200).json({
      success: true,
      message: "Devices retrieved successfully",
      devices: sessions.map((session) => ({
        sessionId: session._id,
        userAgent: session.userAgent,
        ip: session.ip,
        deviceName: session.deviceName || "Unknown Device",
        loginTime: session.createdAt,
        expiresAt: session.expiresAt,
      })),
      totalDevices: sessions.length,
    });
  } catch (error) {
    next(error);
  }
};

export const handleLogoutSpecificDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.body;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    if (!sessionId) {
      throw new CustomError(400, "Session ID is required");
    }

    // Find user's MongoDB ID
    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    // Verify session belongs to this user
    const session = await Session.findById(sessionId);
    if (!session || session.userId.toString() !== user._id.toString()) {
      throw new CustomError(
        403,
        "Unauthorized: Session does not belong to this user"
      );
    }

    // Delete specific session
    await Session.findByIdAndDelete(sessionId);

    res.status(200).json({
      success: true,
      message: "Device logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
