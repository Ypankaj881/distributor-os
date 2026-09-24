import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb, makeCompany, makeAdmin, makeShop, rejectsWith, authFor } from "./helpers.js";
import { login, loadAuthContext, changePassword } from "../src/server/services/authService.js";
import { setCustomerActive, resetCustomerPassword } from "../src/server/services/customerService.js";
import { encodeSession, decodeSession } from "../src/server/auth/session.js";
import { User } from "../src/server/models/User.js";
import { LoginAttempt } from "../src/server/models/LoginAttempt.js";

// Failed-login counters carry over between tests; clear them where it matters.
const clearAttempts = () => LoginAttempt.deleteMany({});

let co, admin, shop;
const shopLogin = (identifier, password, ip = "1.1.1.1") => login({ companySlug: co.slug, portal: "shop", identifier, password, ip });

before(async () => {
  await setupTestDb();
  co = await makeCompany("auth-co");
  admin = await makeAdmin(co);
  shop = await makeShop(co, { phone: "9811199901", password: "right-pass-1" });
});
after(teardownTestDb);

describe("login & sessions", () => {
  test("phone in any common format logs in; admin credentials don't work on the shop portal", async () => {
    const r = await shopLogin("+91 98111-99901", "right-pass-1");
    assert.ok(r.token);
    assert.equal(r.redirectTo, "/");
    await rejectsWith(login({ companySlug: co.slug, portal: "shop", identifier: admin.email, password: "admin-pass-1", ip: "2.2.2.2" }), { status: 401 });
  });

  test("unknown user and wrong password give the same error", async () => {
    const a = await rejectsWith(shopLogin("9123456789", "whatever-1", "3.3.3.3"), { status: 401 });
    const b = await rejectsWith(shopLogin("9811199901", "wrong-pass", "3.3.3.3"), { status: 401 });
    assert.equal(a.message, b.message);
  });

  test("5 wrong passwords lock the account for a while", async () => {
    await clearAttempts();
    for (let i = 0; i < 5; i++) await rejectsWith(shopLogin("9811199901", "bad", "4.4.4.4"), { status: 401 });
    await rejectsWith(shopLogin("9811199901", "right-pass-1", "4.4.4.4"), { status: 429 });
  });

  test("tampered or forged tokens are rejected", async () => {
    const user = await User.findOne({ customerId: shop.customer.id });
    const token = await encodeSession(user);
    assert.ok(await decodeSession(token));
    const [h, p, s] = token.split(".");
    const forged = JSON.parse(Buffer.from(p, "base64url").toString());
    forged.role = "ADMIN";
    assert.equal(await decodeSession(`${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`), null);
    assert.equal(await decodeSession("garbage"), null);
  });

  test("deactivating the shop or resetting its password ends existing sessions", async () => {
    const user = await User.findOne({ customerId: shop.customer.id });
    const session = await decodeSession(await encodeSession(user));
    assert.ok(await loadAuthContext(session));

    await clearAttempts();
    await resetCustomerPassword(admin.companyId, shop.customer.id, "new-pass-123");
    assert.equal(await loadAuthContext(session), null, "old session invalid after reset");

    const fresh = await authFor(await User.findOne({ customerId: shop.customer.id }));
    await setCustomerActive(admin.companyId, shop.customer.id, false);
    assert.equal(await loadAuthContext({ ...session, tokenVersion: (await User.findById(fresh.userId)).tokenVersion }), null);
    await rejectsWith(shopLogin("9811199901", "new-pass-123", "5.5.5.5"), { status: 403 });
    await setCustomerActive(admin.companyId, shop.customer.id, true);
  });

  test("changing your own password keeps this device, ends the others", async () => {
    const auth = await authFor(await User.findOne({ customerId: shop.customer.id }));
    const before = await User.findById(auth.userId);
    await rejectsWith(changePassword(auth, { currentPassword: "nope", newPassword: "another-pass-1" }), { status: 400 });
    const { token } = await changePassword(auth, { currentPassword: "new-pass-123", newPassword: "another-pass-1" });
    const after = await User.findById(auth.userId);
    assert.equal(after.tokenVersion, before.tokenVersion + 1);
    assert.ok(await loadAuthContext(await decodeSession(token)), "new token works");
  });
});
