import "./globals.css";
import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Design2Code Studio",
  description: "Figma URL からコード生成して確認・ZIP出力まで行うMVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
