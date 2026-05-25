import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/api/query-provider";
import { AuthProvider } from "@/lib/contexts/auth-context";
import { LayoutContent } from "@/components/layout-content";
import { ToastProvider } from "@/components/ui/toast-provider";
import 'react-toastify/dist/ReactToastify.css';

export const metadata: Metadata = {
  title: "ASYA - 模联联动系统",
  description: "模拟联合国非对称联动自动化系统",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/asya-logo.png", type: "image/png" },
    ],
    shortcut: "/icon.png",
    apple: "/asya-logo.png",
  },
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
