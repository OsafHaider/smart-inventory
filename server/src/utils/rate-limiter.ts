import { NextFunction, Request, Response } from "express";
import { RateLimiterOptions } from "./types/rate-limiter.types";
import { getRedis } from "../lib/redis";

export const rateLimiter = (options: RateLimiterOptions) => {
  const { bucketSize = 5, refillRate = 1, expiry = 3600 } = options;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `bucket:${req.ip}`;
      const redis = getRedis();
      const bucket = await redis.hGetAll(key);

      let tokens = bucket.tokens ? parseFloat(bucket.tokens) : bucketSize;
      let lastRefill = bucket.lastRefill
        ? parseInt(bucket.lastRefill)
        : Date.now();

      const now = Date.now();
      const elapsedSec = (now - lastRefill) / 1000;
      const tokensToAdd = elapsedSec * refillRate;
      tokens = Math.min(bucketSize, tokens + tokensToAdd);

      if (tokens < 1) {
        return res.status(429).json({
          success: false,
          message: "Rate limit exceeded. Please try again later.",
        });
      }

      tokens -= 1;

      await redis.hSet(key, {
        tokens: tokens.toString(),
        lastRefill: now.toString(),
      });
      await redis.expire(key, expiry);
      next();
    } catch (error) {
      next();
    }
  };
};
