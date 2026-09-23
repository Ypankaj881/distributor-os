import bcrypt from "bcryptjs";

// Cost factor 12 ≈ 200–300 ms per hash: slow enough to make password guessing
// expensive, fast enough that login still feels instant.
const ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// When a login uses an unknown phone/email we still run a bcrypt comparison
// against this dummy hash. Otherwise "user not found" would answer faster than
// "wrong password", letting an attacker discover which phone numbers exist.
let dummyHashPromise;
export function dummyHash() {
  dummyHashPromise ??= bcrypt.hash("timing-equalizer-not-a-real-password", ROUNDS);
  return dummyHashPromise;
}
