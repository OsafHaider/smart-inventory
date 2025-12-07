import { Request, Response, NextFunction } from "express";

export class CustomError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errors?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export const errorHandler = (
  err: Error | CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Error:", err);

  // Handle CustomError
  if (err instanceof CustomError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || undefined,
    });
    return;
  }

  // Handle Validation Error
  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: err.message,
    });
    return;
  }

  // Handle Cast Error (MongoDB)
  if (err.name === "CastError") {
    res.status(400).json({
      success: false,
      message: "Invalid ID format",
      errors: err.message,
    });
    return;
  }

  // Handle Duplicate Key Error (MongoDB)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    res.status(409).json({
      success: false,
      message: `${field} already exists`,
      errors: `Duplicate value for ${field}`,
    });
    return;
  }

  // Handle JWT Errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      message: "Invalid token",
      errors: err.message,
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Token expired",
      errors: err.message,
    });
    return;
  }

  // Handle Generic Errors
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    errors: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};