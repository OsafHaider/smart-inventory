import express, { Application, Request, Response } from "express";
import cookieParser from "cookie-parser";
import { AuthRouter } from "./modules/auth/auth.routes";
import { rateLimiter } from "./utils/rate-limiter";
import { RateLimiterOptions } from "./utils/types/rate-limiter.types";
import { errorHandler } from "./middlewares/error";

export const app: Application = express();

// Middlewares
app.use(express.json());
const options: RateLimiterOptions = {
  bucketSize: 10,
  refillRate: 1,
  expiry: 3600,
};
app.use(rateLimiter(options));
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", AuthRouter);

// Server Health Check
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: "OK",
    message: "Server is healthy",
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global Error Handler
app.use(errorHandler);
