import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Express } from "express";

// A shared JWT secret used across the whole test run so token verification
// works regardless of load order.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-do-not-use-in-prod";
// Deterministic OTP so verify-otp tests can pass a known code. `generateOtp`
// already returns "0000" when NODE_ENV !== "production".
process.env.NODE_ENV = "test";

let mongo: MongoMemoryServer | null = null;

export async function startTestDb(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await mongo?.stop();
  mongo = null;
}

export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

// Import lazily so the JWT_SECRET override above lands before route
// modules capture `process.env` on import.
export async function buildApp(): Promise<Express> {
  const { createApp } = await import("../../src/app.js");
  return createApp();
}
