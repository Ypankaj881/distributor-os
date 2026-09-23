import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import Icon from "@/components/ui/Icon";
import ListFilters from "@/components/admin/ListFilters";
import { requireAdminPage } from "@/server/auth/guards";
import { listCustomers } from "@/server/services/customerService";
import { customerListQuerySchema } from "@/server/validators/customer";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }) {
  const auth = await requireAdminPage();
  const query = customerListQuerySchema.parse(await searchParams);
  const { items, meta } = await listCustomers(auth.companyId, query);
  const hasFilters = Boolean(query.q || query.status !== "all");

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${meta.total} shop${meta.total === 1 ? "" : "s"}${hasFilters ? " match your filters" : ""}`}
        actions={<Button href="/admin/customers/new"><Icon name="plus" className="size-4" />Add customer</Button>}
      />

      <div className="mb-4">
        <ListFilters
          basePath="/admin/customers"
          search={{ value: query.q ?? "", placeholder: "Search shop, owner, mobile, code or city" }}
          selects={[
            {
              name: "status",
              label: "Status",
              value: query.status,
              defaultValue: "all",
              options: [
                { value: "all", label: "All customers" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          hasFilters ? (
            <EmptyState icon="search" title="No customers found" description="Try a different search." action={<Button variant="secondary" href="/admin/customers">Clear filters</Button>} />
          ) : (
            <EmptyState icon="users" title="No customers yet" description="Add the shops that order from you. Each gets a login with their mobile number." action={<Button href="/admin/customers/new">Add customer</Button>} />
          )
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-slate-900 hover:text-brand-600">{c.shopName}</Link>
                      {c.ownerName && <p className="text-xs text-slate-500">{c.ownerName}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.customerCode}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPhone(c.phone)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.city || "—"}</td>
                    <td className="px-4 py-3">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/customers/${c.id}/pricing`} className="text-sm font-medium text-brand-600 hover:underline">Prices</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center justify-between gap-3 p-4 active:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.shopName}</p>
                      <p className="text-xs text-slate-500">
                        {c.customerCode} · {formatPhone(c.phone)}
                        {c.city ? ` · ${c.city}` : ""}
                      </p>
                    </div>
                    {c.isActive ? <Icon name="chevronRight" className="size-5 text-slate-400" /> : <Badge tone="red">Inactive</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {items.length > 0 && (
        <div className="mt-4">
          <Pagination
            basePath="/admin/customers"
            params={{ q: query.q, status: query.status === "all" ? "" : query.status }}
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
          />
        </div>
      )}
    </>
  );
}
