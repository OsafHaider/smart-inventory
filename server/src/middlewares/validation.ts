import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CustomError } from "./error";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.reduce((acc, issue) => {
          acc[issue.path.join(".")] = issue.message;
          return acc;
        }, {} as Record<string, string>);
        throw new CustomError(400, "Validation failed", formattedErrors);
      }
      next(error);
    }
  };
}
