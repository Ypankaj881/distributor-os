import { redirect } from "next/navigation";
import LoginScreen from "@/components/auth/LoginScreen";
import { getAuth } from "@/server/auth/current";
import { getPublicCompany } from "@/server/services/authService";
import { config } from "@/server/config";
import { ROLES } from "@/lib/constants";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Retailer login" };

// Retailer login. searchParams is a Promise in Next.js 15+.
export default async function RetailerLoginPage({ searchParams }) {
  const auth = await getAuth();
  if (auth) redirect(auth.role === ROLES.ADMIN ? "/admin" : "/");

  const { next } = await searchParams;
  const company = await getPublicCompany(config.defaultCompanySlug());

  return (
    <LoginScreen
      portal="shop"
      companyName={company?.name}
      title="Retailer login"
      subtitle="Log in to place and track your orders."
      next={next}
      footer={
        company?.phone
          ? `Forgot your password? Call ${formatPhone(company.phone)}.`
          : "Forgot your password? Contact your distributor."
      }
    />
  );
}
