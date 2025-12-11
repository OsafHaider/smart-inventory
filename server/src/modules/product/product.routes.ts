import { Router } from "express";
import {
  handleCreateProduct,
  handleGetAllProducts,
  handleGetUserProducts,
  handleGetProductById,
  handleUpdateProduct,
  handleDeleteProduct,
  handleBulkDeleteProducts,
  handleUpdateStockQuantity,
} from "./product.controller";
import { validateBody } from "../../middlewares/validation";
import { verifyAccessToken } from "../../middlewares/jwt";
import {
  createProductSchema,
  updateProductSchema,
} from "../../utils/schema/products";

export const ProductRouter = Router();

// Public routes
ProductRouter.get("/", handleGetAllProducts);
ProductRouter.get("/:id", handleGetProductById);

// Protected routes (require authentication)
ProductRouter.post(
  "/",
  verifyAccessToken,
  validateBody(createProductSchema),
  handleCreateProduct
);

ProductRouter.get(
  "/user/my-products",
  verifyAccessToken,
  handleGetUserProducts
);

ProductRouter.put(
  "/:id",
  verifyAccessToken,
  validateBody(updateProductSchema),
  handleUpdateProduct
);

ProductRouter.delete("/:id", verifyAccessToken, handleDeleteProduct);

ProductRouter.post("/bulk/delete", verifyAccessToken, handleBulkDeleteProducts);

ProductRouter.patch(
  "/:id/quantity",
  verifyAccessToken,
  handleUpdateStockQuantity
);
