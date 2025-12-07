import { connect } from "mongoose";
import ENV from "../env";

const dbConnection = async () => {
  try {
    await connect(ENV.DATABASE_URL);
    console.log("Database connected successfully");
  } catch (error) {
    console.error(
      "Database connection failed:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
};

export default dbConnection;
