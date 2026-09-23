"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api, safeNextPath } from "@/lib/apiClient";

const COPY = {
  shop: {
    idLabel: "Mobile number",
    idPlaceholder: "10-digit mobile number",
    idProps: { type: "tel", inputMode: "numeric", autoComplete: "tel" },
  },
  admin: {
    idLabel: "Email or mobile number",
    idPlaceholder: "you@company.com",
    idProps: { type: "text", autoComplete: "username", autoCapitalize: "none" },
  },
};

export default function LoginForm({ portal, next }) {
  const router = useRouter();
  const copy = COPY[portal];
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const res = await api.post("/api/auth/login", { portal, identifier, password });

    if (!res.ok) {
      setLoading(false);
      setError(res.error.message);
      setFieldErrors(res.error.fields ?? {});
      return;
    }

    // Keep the button in its loading state while navigating away.
    const areaPrefix = portal === "admin" ? "/admin" : "/";
    const nextPath = safeNextPath(next, res.data.redirectTo);
    const inRightArea = portal === "admin" ? nextPath.startsWith("/admin") : !nextPath.startsWith("/admin");
    router.replace(inRightArea ? nextPath : areaPrefix);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <Input
        label={copy.idLabel}
        name="identifier"
        placeholder={copy.idPlaceholder}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        error={fieldErrors.identifier}
        required
        autoFocus
        {...copy.idProps}
      />

      <div>
        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {showPassword ? "Hide password" : "Show password"}
        </button>
      </div>

      <Button type="submit" size="lg" loading={loading} className="w-full">
        {loading ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
