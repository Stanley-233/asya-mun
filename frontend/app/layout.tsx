import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/api/query-provider";
import { AuthProvider } from "@/lib/contexts/auth-context";
import { LayoutContent } from "@/components/layout-content";
import { ToastProvider } from "@/components/ui/toast-provider";
import { siteBrand, siteMetadataIcons } from "@/assets";
import 'react-toastify/dist/ReactToastify.css';

export const metadata: Metadata = {
  title: siteBrand.fullNameWithDash,
  description: siteBrand.fullNameZh,
  icons: siteMetadataIcons,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>
            <LayoutContent>{children}</LayoutContent>
            <ToastProvider />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
