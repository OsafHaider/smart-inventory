import { model, models, Schema } from "mongoose";

const SessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refreshToken: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    deviceName: { type: String },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true }
);

const Session = models.Session || model("Session", SessionSchema);
export default Session;
