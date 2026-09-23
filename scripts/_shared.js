// Helpers shared by CLI scripts.
import { connectDB, disconnectDB } from "../src/server/db.js";

export function env(name, { required = true } = {}) {
  const value = process.env[name]?.trim();
  if (required && !value) {
    console.error(`✘ Missing ${name}. Set it in .env.local or in your terminal before running this script.`);
    process.exit(1);
  }
  return value || undefined;
}

// Connects, runs the task, always disconnects, and exits non-zero on failure.
export async function runScript(task) {
  try {
    await connectDB();
    await task();
  } catch (err) {
    console.error("✘", err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}
