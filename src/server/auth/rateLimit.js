import { LoginAttempt } from "../models/LoginAttempt.js";
import { Errors } from "../http/errors.js";

const WINDOW_MS = 15 * 60 * 1000;

// limits: [{ key, max }] — throws 429 if any key already has `max` failures
// within the last 15 minutes.
export async function assertNotRateLimited(limits) {
  const since = new Date(Date.now() - WINDOW_MS);
  for (const { key, max } of limits) {
    const failures = await LoginAttempt.countDocuments({ key, createdAt: { $gt: since } });
    if (failures >= max) {
      throw Errors.tooManyRequests("Too many failed login attempts. Please wait 15 minutes and try again.");
    }
  }
}

export async function recordFailure(keys) {
  await LoginAttempt.insertMany(keys.map((key) => ({ key })));
}

export async function clearFailures(key) {
  await LoginAttempt.deleteMany({ key });
}
