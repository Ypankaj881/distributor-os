// Normalizes Indian mobile numbers to 10 digits so "+91 98765-43210",
// "098765 43210" and "9876543210" are all stored and matched the same way.
// Returns null when the input isn't a valid Indian mobile number.
export function normalizePhone(input) {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function formatPhone(phone) {
  return phone && phone.length === 10 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone ?? "";
}
