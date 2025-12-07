import dotenv from "dotenv";
dotenv.config();
import { app } from "./app";
import dbConnection from "./utils/db";
import { initRedis } from "./lib/redis";
import ENV from "./utils/env";
const PORT = Number(ENV.PORT) || 8000;
const serverStart = async () => {
  await dbConnection();
  await initRedis();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};
serverStart();
