import { connectDB } from "../db.js";
import { Company } from "../models/Company.js";
import { User } from "../models/User.js";
import { Customer } from "../models/Customer.js";
import { AppError, Errors } from "../http/errors.js";
import { verifyPassword, dummyHash } from "../auth/password.js";
import { encodeSession } from "../auth/session.js";
import { assertNotRateLimited, recordFailure, clearFailures } from "../auth/rateLimit.js";
import { ROLES } from "../../lib/constants.js";
import { normalizePhone } from "../../lib/phone.js";

const MAX_FAILURES_PER_ACCOUNT = 5; // per 15 min — stops guessing one account's password
const MAX_FAILURES_PER_IP = 30; // per 15 min — stops one device trying many accounts

// "admin" portal accepts email or phone; "shop" portal accepts phone only.
function parseIdentifier(portal, raw) {
  const value = raw.trim().toLowerCase();
  if (portal === "admin" && value.includes("@")) return { key: value, query: { email: value } };
  const phone = normalizePhone(value);
  return phone ? { key: phone, query: { phone } } : { key: value, query: null };
}

function invalidCredentials(portal) {
  const what = portal === "shop" ? "mobile number" : "email/mobile";
  return new AppError(`Incorrect ${what} or password.`, { status: 401, code: "INVALID_CREDENTIALS" });
}

export async function login({ companySlug, portal, identifier, password, ip }) {
  await connectDB();

  const company = await Company.findOne({ slug: companySlug, isActive: true }).select("_id").lean();
  if (!company) {
    // Misconfiguration (wrong DEFAULT_COMPANY_SLUG or company not created yet).
    console.error(`[auth] No active company with slug "${companySlug}".`);
    throw Errors.unprocessable("Login is not available right now. Please contact the distributor.", "COMPANY_NOT_FOUND");
  }

  const role = portal === "admin" ? ROLES.ADMIN : ROLES.RETAILER;
  const { key, query } = parseIdentifier(portal, identifier);
  const accountKey = `login:${company._id}:${portal}:${key}`;
  const ipKey = `login-ip:${ip}`;

  await assertNotRateLimited([
    { key: accountKey, max: MAX_FAILURES_PER_ACCOUNT },
    { key: ipKey, max: MAX_FAILURES_PER_IP },
  ]);

  const user = query
    ? await User.findOne({ companyId: company._id, role, ...query }).select("+passwordHash").lean()
    : null;

  // Always run bcrypt, even with no user, so response time doesn't reveal
  // whether the phone/email is registered.
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));

  if (!user || !passwordOk) {
    await recordFailure([accountKey, ipKey]);
    throw invalidCredentials(portal);
  }

  const inactive = Errors.forbidden("Your account is inactive. Please contact the distributor.");
  if (!user.isActive) throw inactive;

  if (role === ROLES.RETAILER) {
    const customer = await Customer.findOne({ _id: user.customerId, companyId: company._id }).select("isActive").lean();
    if (!customer?.isActive) throw inactive;
  }

  await clearFailures(accountKey);
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  return {
    token: await encodeSession(user),
    redirectTo: role === ROLES.ADMIN ? "/admin" : "/",
  };
}

// Turns a verified session payload into the "auth context" used by every
// request: who the user is and which company they belong to. Returns null if the
// user was deactivated, their password was reset (tokenVersion changed), or the
// company is inactive — so those sessions stop working immediately.
export async function loadAuthContext(session) {
  if (!session) return null;
  await connectDB();

  const user = await User.findOne({ _id: session.userId, companyId: session.companyId })
    .select("role name phone email customerId isActive tokenVersion companyId")
    .lean();

  if (!user || !user.isActive || user.role !== session.role || user.tokenVersion !== session.tokenVersion) {
    return null;
  }

  const company = await Company.findById(user.companyId).select("name slug phone isActive settings").lean();
  if (!company?.isActive) return null;

  return {
    userId: String(user._id),
    companyId: String(user.companyId),
    role: user.role,
    customerId: user.customerId ? String(user.customerId) : null,
    name: user.name,
    phone: user.phone ?? null,
    email: user.email ?? null,
    company: {
      id: String(company._id),
      name: company.name,
      slug: company.slug,
      phone: company.phone ?? null,
      settings: company.settings,
    },
  };
}

// What the browser is allowed to see about the current user (a "DTO").
// Retailers get only the company's public details, not its settings.
export function toMeDTO(auth) {
  return {
    user: { id: auth.userId, name: auth.name, role: auth.role, phone: auth.phone, email: auth.email },
    company: { name: auth.company.name, phone: auth.company.phone },
  };
}

export async function getPublicCompany(slug) {
  await connectDB();
  const company = await Company.findOne({ slug, isActive: true }).select("name phone").lean();
  return company ? { name: company.name, phone: company.phone ?? null } : null;
}
