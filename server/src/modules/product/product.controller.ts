import { Request, Response, NextFunction } from "express";
import Product from "./product.model";
import User from "../user/user.model";
import { v4 as uuidv4 } from "uuid";
import { CustomError } from "../../middlewares/error";
import { getRedis } from "../../lib/redis";

// Cache key helpers
const getCacheKey = (type: string, id?: string) => {
  if (id) return `product:${id}`;
  return `products:all`;
};

const getUserProductsCacheKey = (userId: string) => `products:user:${userId}`;

// Clear cache helpers
const invalidateProductCache = async (productId?: string) => {
  try {
    const redis = getRedis();
    if (productId) {
      await redis.del(getCacheKey("product", productId));
    }
    await redis.del(getCacheKey("products"));
  } catch (error) {
    console.log("Cache invalidation error:", error);
  }
};

const invalidateUserProductCache = async (userId: string) => {
  try {
    const redis = getRedis();
    await redis.del(getUserProductsCacheKey(userId));
    await redis.del(getCacheKey("products"));
  } catch (error) {
    console.log("Cache invalidation error:", error);
  }
};

// Create Product
export const handleCreateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    const { name, description, price, quantity } = req.body;

    // Find user by custom id field
    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    // Create product
    const product = await Product.create({
      id: uuidv4(),
      name,
      description: description || "",
      price,
      quantity,
      createdBy: user._id,
    });

    await User.findByIdAndUpdate(user._id, {
      $push: { products: product._id },
    });

    await product.populate("createdBy", "id name email avatar role");

    // Invalidate cache
    await invalidateUserProductCache(userId);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        createdBy: product.createdBy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get All Products
export const handleGetAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(
      1,
      Math.min(100, parseInt(limit as string) || 10)
    );
    const skip = (pageNum - 1) * limitNum;

    // Try to get from cache (only for page 1, no search)
    if (pageNum === 1 && !search) {
      try {
        const redis = getRedis();
        const cacheKey = getCacheKey("products");
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.status(200).json(JSON.parse(cached));
          return;
        }
      } catch (error) {
        console.log("Cache read error:", error);
      }
    }

    // Build search query
    const searchQuery = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    // Get total count and products
    const [products, total] = await Promise.all([
      Product.find(searchQuery)
        .populate("createdBy", "id name email avatar role")
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      Product.countDocuments(searchQuery),
    ]);

    const response = {
      success: true,
      message: "Products retrieved successfully",
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        createdBy: product.createdBy,
        createdAt: product.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };

    // Cache response (only for page 1, no search)
    if (pageNum === 1 && !search) {
      try {
        const redis = getRedis();
        const cacheKey = getCacheKey("products");
        await redis.setEx(cacheKey, 300, JSON.stringify(response)); // 5 minutes
      } catch (error) {
        console.log("Cache write error:", error);
      }
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Get User's Products
export const handleGetUserProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(
      1,
      Math.min(100, parseInt(limit as string) || 10)
    );
    const skip = (pageNum - 1) * limitNum;

    // Try to get from cache (only for page 1)
    if (pageNum === 1) {
      try {
        const redis = getRedis();
        const cacheKey = getUserProductsCacheKey(userId);
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.status(200).json(JSON.parse(cached));
          return;
        }
      } catch (error) {
        console.log("Cache read error:", error);
      }
    }

    const [products, total] = await Promise.all([
      Product.find({ createdBy: user._id })
        .populate("createdBy", "id name email avatar role")
        .skip(skip)
        .limit(limitNum)
        .sort({ createdAt: -1 }),
      Product.countDocuments({ createdBy: user._id }),
    ]);

    const response = {
      success: true,
      message: "User products retrieved successfully",
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        createdBy: product.createdBy,
        createdAt: product.createdAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };

    // Cache response (only for page 1)
    if (pageNum === 1) {
      try {
        const redis = getRedis();
        const cacheKey = getUserProductsCacheKey(userId);
        await redis.setEx(cacheKey, 300, JSON.stringify(response)); // 5 minutes
      } catch (error) {
        console.log("Cache write error:", error);
      }
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Get Product by ID
export const handleGetProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Try to get from cache
    try {
      const redis = getRedis();
      const cacheKey = getCacheKey("product", id);
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.status(200).json(JSON.parse(cached));
        return;
      }
    } catch (error) {
      console.log("Cache read error:", error);
    }

    const product = await Product.findOne({ id }).populate(
      "createdBy",
      "id name email avatar role"
    );

    if (!product) {
      throw new CustomError(404, "Product not found");
    }

    const response = {
      success: true,
      message: "Product retrieved successfully",
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        createdBy: product.createdBy,
        createdAt: product.createdAt,
      },
    };

    // Cache response
    try {
      const redis = getRedis();
      const cacheKey = getCacheKey("product", id);
      await redis.setEx(cacheKey, 600, JSON.stringify(response)); // 10 minutes
    } catch (error) {
      console.log("Cache write error:", error);
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Update Product
export const handleUpdateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { name, description, price, quantity } = req.body;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    const product = await Product.findOne({ id });
    if (!product) {
      throw new CustomError(404, "Product not found");
    }

    // Check ownership
    if (product.createdBy.toString() !== user._id.toString()) {
      throw new CustomError(
        403,
        "You are not authorized to update this product"
      );
    }

    // Update fields
    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (quantity !== undefined) product.quantity = quantity;

    await product.save();
    await product.populate("createdBy", "id name email avatar role");

    // Invalidate cache
    await invalidateProductCache(id);
    await invalidateUserProductCache(userId);

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        quantity: product.quantity,
        createdBy: product.createdBy,
        createdAt: product.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete Product
export const handleDeleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    const product = await Product.findOne({ id });
    if (!product) {
      throw new CustomError(404, "Product not found");
    }

    // Check ownership
    if (product.createdBy.toString() !== user._id.toString()) {
      throw new CustomError(
        403,
        "You are not authorized to delete this product"
      );
    }

    // Remove product from user's products array
    await User.findByIdAndUpdate(user._id, {
      $pull: { products: product._id },
    });

    // Delete product
    await Product.findByIdAndDelete(product._id);

    // Invalidate cache
    await invalidateProductCache(id);
    await invalidateUserProductCache(userId);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      productId: id,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk Delete Products
export const handleBulkDeleteProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { ids } = req.body;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new CustomError(
        400,
        "Product IDs array is required and cannot be empty"
      );
    }

    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    // Find products to verify ownership
    const products = await Product.find({ id: { $in: ids } });

    if (products.length === 0) {
      throw new CustomError(404, "No products found");
    }

    // Verify all products belong to user
    const unauthorized = products.filter(
      (p) => p.createdBy.toString() !== user._id.toString()
    );

    if (unauthorized.length > 0) {
      throw new CustomError(
        403,
        "You are not authorized to delete some products"
      );
    }

    const productIds = products.map((p) => p._id);

    // Remove products from user's products array
    await User.findByIdAndUpdate(user._id, {
      $pull: { products: { $in: productIds } },
    });

    // Delete products
    const result = await Product.deleteMany({ _id: { $in: productIds } });

    // Invalidate cache
    for (const id of ids) {
      await invalidateProductCache(id);
    }
    await invalidateUserProductCache(userId);

    res.status(200).json({
      success: true,
      message: "Products deleted successfully",
      deletedCount: result.deletedCount,
      ids,
    });
  } catch (error) {
    next(error);
  }
};

// Update Stock Quantity
export const handleUpdateStockQuantity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      throw new CustomError(401, "User not authenticated");
    }

    if (quantity === undefined || typeof quantity !== "number") {
      throw new CustomError(400, "Valid quantity number is required");
    }

    const user = await User.findOne({ id: userId });
    if (!user) {
      throw new CustomError(404, "User not found");
    }

    const product = await Product.findOne({ id });
    if (!product) {
      throw new CustomError(404, "Product not found");
    }

    // Check ownership
    if (product.createdBy.toString() !== user._id.toString()) {
      throw new CustomError(
        403,
        "You are not authorized to update this product"
      );
    }

    product.quantity = Math.max(0, quantity);
    await product.save();
    await product.populate("createdBy", "id name email avatar role");

    // Invalidate cache
    await invalidateProductCache(id);
    await invalidateUserProductCache(userId);

    res.status(200).json({
      success: true,
      message: "Product quantity updated successfully",
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: product.quantity,
      },
    });
  } catch (error) {
    next(error);
  }
};
