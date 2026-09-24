import PageHeader from "@/components/ui/PageHeader";
import ImportWizard from "@/components/admin/ImportWizard";
import { requireAdminPage } from "@/server/auth/guards";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="Import from Excel"
        description="Add or update many products, shops or special prices at once. Rows are checked first; nothing is saved until you confirm."
      />
      <ImportWizard />
    </>
  );
}
