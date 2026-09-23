// Date helpers that respect the COMPANY's timezone (Asia/Kolkata for Chandrika).
// The server may run in UTC (Vercel), so "today" and "start of 25 Sep" must be
// computed in the business's timezone, not the server's.

// Minutes the timezone is ahead of UTC at a given instant (IST → 330).
function tzOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// "2026-09-25" in Asia/Kolkata → the UTC instant when that day starts there.
export function startOfDay(dateStr, timeZone) {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60000);
}

// Today's date ("YYYY-MM-DD") in the timezone.
export function todayIn(timeZone, now = new Date()) {
  return dateKey(now, timeZone);
}

// The calendar date ("YYYY-MM-DD") of an instant, in the timezone.
export function dateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "25 Sep 2026" / "25 Sep 2026, 3:05 pm" for display.
export function formatDate(date, timeZone = "Asia/Kolkata") {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function formatDateTime(date, timeZone = "Asia/Kolkata") {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}
