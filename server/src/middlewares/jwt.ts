import { NextFunction, Request, Response } from "express";
import jsonwebtoken from "jsonwebtoken";
import ENV from "../utils/env";
import { TokenPayload } from "../utils/types/token-payload.types";
import { CustomError } from "./error";

export const generateAccessToken = (payload: TokenPayload): string => {
  return jsonwebtoken.sign(payload, ENV.ACCESS_TOKEN_SECRET, {
    expiresIn: "5m",
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jsonwebtoken.sign(payload, ENV.REFRESH_TOKEN_SECRET, {
    expiresIn: "30m",
  });
};

export const verifyAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new CustomError(401, "Access token not provided");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jsonwebtoken.verify(
      token,
      ENV.ACCESS_TOKEN_SECRET
    ) as TokenPayload;
    (req as any).user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

export const verifyRefreshToken = (refreshToken: string): TokenPayload => {
  try {
    return jsonwebtoken.verify(
      refreshToken,
      ENV.REFRESH_TOKEN_SECRET
    ) as TokenPayload;
  } catch (error) {
    console.log(error)
    throw new CustomError(401, "Invalid or expired refresh token");
  }
};
