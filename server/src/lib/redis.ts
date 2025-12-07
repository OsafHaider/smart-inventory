import { createClient } from "redis";
import ENV from "../utils/env";

let redisClient: ReturnType<typeof createClient> | null = null;

export const initRedis = async () => {
  try {
    redisClient = createClient({
      url: ENV.REDIS_URL,
    });

    redisClient
      .on("error", (err) => console.error("Redis Client Error:", err))
      .on("connect", () => console.log("Redis Connected"));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("Redis Connection Failed:", error);
    throw error;
  }
};

export const getRedis = () => {
  if (!redisClient) {
    throw new Error("Redis not initialized. Call initRedis() first.");
  }
  return redisClient;
};

export const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.disconnect();
    console.log("Redis Disconnected");
    redisClient = null;
  }
};
