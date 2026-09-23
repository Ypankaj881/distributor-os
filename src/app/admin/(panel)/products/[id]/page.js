import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";
import ProductForm from "@/components/admin/ProductForm";
import StockAdjuster from "@/components/admin/StockAdjuster";
import DeleteProductButton from "@/components/admin/DeleteProductButton";
import { requireAdminPage } from "@/server/auth/guards";
import { getProduct } from "@/server/services/productService";
import { listBrandOptions } from "@/server/services/brandService";
import { AppError } from "@/server/http/errors";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }) {
  const auth = await requireAdminPage();
  const { id } = await params;
  const { created } = await searchParams;

  let product;
  try {
    product = await getProduct(auth.companyId, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const brands = await listBrandOptions(auth.companyId);

  return (
    <>
      <Link href="/admin/products" className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">← Products</Link>
      <PageHeader title={product.name} description={`${product.brand.name} · ${product.sku}`} />
      {created && <Alert tone="success" className="mb-4">Product created. You can add stock on the right.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ProductForm product={product} brands={brands} />
        <div className="space-y-6">
          <StockAdjuster productId={product.id} stockQuantity={product.stockQuantity} unit={product.unit} threshold={auth.company.settings?.lowStockThreshold ?? 10} />
          <Card className="p-5">
            <h2 className="mb-2 font-semibold">Danger zone</h2>
            <DeleteProductButton productId={product.id} productName={product.name} />
          </Card>
        </div>
      </div>
    </>
  );
}
