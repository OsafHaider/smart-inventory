import { NextFunction, Request, Response } from "express";
import { CustomError } from "./error";

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = (req as any).user?.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        throw new CustomError(
          403,
          "You are not allowed to access this resource"
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};