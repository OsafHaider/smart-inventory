import { Request, Response, NextFunction } from "express";
import { getRedis } from "../lib/redis";

export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const key = req.headers["idempotency-key"];
  if (!key) return next();
  const redis = await getRedis();
  const cachedResponse = await redis.get(key as string);
  if (cachedResponse) {
    return res.status(200).json(JSON.parse(cachedResponse));
  }
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    redis.setEx(key as string, 300, JSON.stringify(body));
    return originalJson(body);
  };

  next();
};
