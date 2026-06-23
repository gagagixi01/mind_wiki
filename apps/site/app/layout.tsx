import type { Metadata } from "next";
import "@mind-wiki/core/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mind Wiki AI Progress",
  description: "中文优先的 AI 进展研究索引与本地策展工作台。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
