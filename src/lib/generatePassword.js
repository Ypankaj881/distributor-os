// Easy-to-read temporary password for shopkeepers, e.g. "kmrt4827":
// 4 letters + 4 digits, no look-alike characters (l/1, o/0). Uses the browser's
// cryptographic random generator, not Math.random().
const LETTERS = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

function pick(chars, n) {
  const bytes = crypto.getRandomValues(new Uint32Array(n));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function generatePassword() {
  return pick(LETTERS, 4) + pick(DIGITS, 4);
}
