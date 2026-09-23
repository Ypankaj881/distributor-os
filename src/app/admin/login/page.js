import { redirect } from "next/navigation";
import LoginScreen from "@/components/auth/LoginScreen";
import { getAuth } from "@/server/auth/current";
import { getPublicCompany } from "@/server/services/authService";
import { config } from "@/server/config";
import { ROLES } from "@/lib/constants";

export const metadata = { title: "Admin login" };

export default async function AdminLoginPage({ searchParams }) {
  const auth = await getAuth();
  if (auth) redirect(auth.role === ROLES.ADMIN ? "/admin" : "/");

  const { next } = await searchParams;
  const company = await getPublicCompany(config.defaultCompanySlug());

  return (
    <LoginScreen
      portal="admin"
      companyName={company?.name}
      title="Admin login"
      subtitle="Manage products, customers and orders."
      next={next}
    />
  );
}
