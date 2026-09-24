// Static safety net: EVERY API route handler must start with the right guard.
// If someone adds a route and forgets the auth check, this test fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.resolve("src/app/api");
const PUBLIC = new Set(["auth/login", "auth/logout", "health"]); // intentionally open

function routeFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return routeFiles(full);
    return e.name === "route.js" ? [full] : [];
  });
}

function requiredGuard(route) {
  if (route.startsWith("admin/")) return "requireAdmin";
  if (route.startsWith("shop/")) return "requireRetailer";
  return "requireAuth";
}

test("every API handler checks the caller's role", () => {
  const files = routeFiles(API_DIR);
  assert.ok(files.length > 20, "found the route files");
  const problems = [];

  for (const file of files) {
    const route = path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/");
    if (PUBLIC.has(route)) continue;
    const guard = requiredGuard(route);
    const source = fs.readFileSync(file, "utf8");
    // Each "export const GET = withApi(async …) => { … }" block must call the guard.
    const handlers = source.split(/export const (?=GET|POST|PUT|PATCH|DELETE)/).slice(1);
    if (handlers.length === 0) problems.push(`${route}: no handlers found`);
    for (const h of handlers) {
      const method = h.slice(0, h.indexOf(" "));
      if (!h.includes(`await ${guard}()`)) problems.push(`${method} /api/${route} is missing ${guard}()`);
      if (!h.startsWith(`${method} = withApi(`)) problems.push(`${method} /api/${route} is not wrapped in withApi()`);
    }
  }
  assert.deepEqual(problems, []);
});

test("no raw HTML injection anywhere in the UI", () => {
  const offenders = walk(path.resolve("src")).filter((f) => f.endsWith(".js") && fs.readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));
  assert.deepEqual(offenders, []);
});

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
