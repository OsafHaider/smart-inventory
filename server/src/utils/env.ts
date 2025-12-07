function requireEnv(key: string): string {
  if (!process.env[key]) {
    throw new Error(`${key} is missing in environment variables`);
  }
  return process.env[key]!;
}

export const ENV = {
  NODE_ENV: requireEnv("NODE_ENV"),
  PORT: requireEnv("PORT"),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  BCRYPT_SALT_ROUNDS_PASSWORD: requireEnv("BCRYPT_SALT_ROUNDS_PASSWORD"),
  BCRYPT_SALT_ROUNDS_TOKEN: requireEnv("BCRYPT_SALT_ROUNDS_TOKEN"),
  ACCESS_TOKEN_SECRET: requireEnv("ACCESS_TOKEN_SECRET"),
  REFRESH_TOKEN_SECRET: requireEnv("REFRESH_TOKEN_SECRET"),
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
};

export default ENV;