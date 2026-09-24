"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import LogoutButton from "@/components/auth/LogoutButton";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/brands", label: "Brands", icon: "layers" },
  { href: "/admin/customers", label: "Customers", icon: "users" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

function isActive(pathname, href) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLinks({ onNavigate }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
              )}
            >
              <Icon name={item.icon} className="size-5" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand({ companyName }) {
  return (
    <div className="px-3">
      <p className="truncate text-sm font-semibold text-white">{companyName}</p>
      <p className="text-xs text-slate-400">Admin panel</p>
    </div>
  );
}

function UserFooter({ userName }) {
  return (
    <div className="mt-auto border-t border-slate-800 px-3 pt-4">
      <p className="truncate text-sm font-medium text-white">{userName}</p>
      <LogoutButton redirectTo="/admin/login" className="mt-2 text-slate-400 hover:text-white" />
    </div>
  );
}

// Desktop: fixed dark sidebar. Tablet/phone: top bar with a slide-in drawer.
export default function AdminShell({ companyName, userName, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 bg-slate-900 px-3 py-5 lg:flex">
        <Brand companyName={companyName} />
        <NavLinks />
        <UserFooter userName={userName} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100">
          <Icon name="menu" className="size-6" />
        </button>
        <span className="truncate text-sm font-semibold">{companyName}</span>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 bg-slate-900 px-3 py-5">
            <div className="flex items-start justify-between">
              <Brand companyName={companyName} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1 text-slate-400 hover:text-white">
                <Icon name="x" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <UserFooter userName={userName} />
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
