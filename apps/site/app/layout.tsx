import type { Metadata } from "next";
import "@mind-wiki/core/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mind Wiki AI Progress",
  description: "中文优先的 AI 进展研究索引，聚合已批准的事件、来源、轨迹与周报。"
};

const localRuntime = process.env.NODE_ENV !== "production";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let body: React.ReactNode = children;
  if (localRuntime) {
    const { AppChrome } = await import("@/components/app-chrome");
    body = <AppChrome>{children}</AppChrome>;
  }

  return (
    <html lang="zh-CN">
      <body>{body}</body>
    </html>
  );
}
