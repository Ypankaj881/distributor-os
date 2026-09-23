"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { formatPhone } from "@/lib/phone";

// Shows a shop's login details once (right after they are set) with a Copy
// button, so the admin can paste them into WhatsApp. The password is never
// stored in readable form, so it can't be shown again later.
export default function LoginDetailsBox({ shopName, phone, password }) {
  const [copied, setCopied] = useState(false);
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const text = `Login details for ${shopName}\nLink: ${loginUrl}\nMobile: ${phone}\nPassword: ${password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the login details:", text);
    }
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-900">Share these login details with the shopkeeper</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-emerald-800">Mobile</dt>
        <dd className="font-mono">{formatPhone(phone)}</dd>
        <dt className="text-emerald-800">Password</dt>
        <dd className="font-mono">{password}</dd>
      </dl>
      <Button size="sm" variant="secondary" className="mt-3" onClick={copy}>
        {copied ? "Copied ✓" : "Copy login details"}
      </Button>
      <p className="mt-2 text-xs text-emerald-800">The password is shown only now. You can set a new one later if it&apos;s lost.</p>
    </div>
  );
}
