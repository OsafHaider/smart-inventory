import { model, models, Schema } from "mongoose";

const productSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name must be at most 100 characters"],
    },
    description: {
      type: String,
      default: "",
      maxlength: [500, "Description must be at most 500 characters"],
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: [0.01, "Price must be at least 0.01"],
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Quantity cannot be negative"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Index for better query performance
productSchema.index({ createdBy: 1, createdAt: -1 });
productSchema.index({ name: "text", description: "text" });

const Product = models.Product || model("Product", productSchema);

export default Product;
