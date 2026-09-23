import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Card from "@/components/ui/Card";
import ProductForm from "@/components/admin/ProductForm";
import { requireAdminPage } from "@/server/auth/guards";
import { listBrandOptions } from "@/server/services/brandService";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const auth = await requireAdminPage();
  const brands = await listBrandOptions(auth.companyId);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add product" />
      {brands.length === 0 ? (
        <Card>
          <EmptyState icon="layers" title="Add a brand first" description="Every product belongs to a brand." action={<Button href="/admin/brands">Go to brands</Button>} />
        </Card>
      ) : (
        <ProductForm brands={brands} />
      )}
    </div>
  );
}
