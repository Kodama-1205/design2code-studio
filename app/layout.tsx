import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Design2Code Studio",
  description: "デザインソースから保守しやすいコードを生成します。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
