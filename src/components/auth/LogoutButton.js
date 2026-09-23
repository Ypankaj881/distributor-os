"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/apiClient";

export default function LogoutButton({ redirectTo, className }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await api.post("/api/auth/logout");
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={cn("inline-flex items-center gap-2 text-sm font-medium disabled:opacity-60", className)}
    >
      <Icon name="logout" className="size-5" />
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
