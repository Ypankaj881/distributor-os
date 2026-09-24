// Central access to environment variables.
// Values are read lazily (inside functions) so `next build` doesn't fail on a
// machine without secrets, but any code that actually needs a value gets a
// clear error instead of a mysterious `undefined`.

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`);
  }
  return value.trim();
}

export const config = {
  isProd: process.env.NODE_ENV === "production",

  mongo() {
    const uri = required("MONGODB_URI");
    // Catches any leftover template value such as <db_password> or <prod_password>.
    if (/<[a-z_]+>/i.test(uri)) {
      throw new Error("MONGODB_URI still contains a <placeholder>. Replace it with the real database password.");
    }
    return { uri, dbName: process.env.MONGODB_DB?.trim() || "distributor_os" };
  },

  authSecret() {
    const secret = required("AUTH_SECRET");
    if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
    return secret;
  },

  appUrl() {
    return process.env.APP_URL?.trim() || "http://localhost:3000";
  },

  defaultCompanySlug() {
    return required("DEFAULT_COMPANY_SLUG");
  },
};
