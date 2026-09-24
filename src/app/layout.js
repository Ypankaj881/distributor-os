import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The company name is not hard-coded here: pages set their own titles, and
// once auth lands the layouts show the logged-in company's name from the DB.
export const metadata = {
  title: { default: "B2B Ordering Portal", template: "%s · B2B Ordering Portal" },
  description: "Private B2B ordering for retail partners.",
  robots: { index: false, follow: false }, // private app — keep it out of search engines
  // Installed on a phone's home screen (see app/manifest.js)
  icons: { icon: "/app-icon/192", apple: "/app-icon/180" },
  appleWebApp: { capable: true, statusBarStyle: "default" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2553e0",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
