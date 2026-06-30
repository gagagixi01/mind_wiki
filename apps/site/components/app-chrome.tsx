"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { APP_NAME } from "@mind-wiki/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const localRuntime = process.env.NODE_ENV !== "production";

function buildWorkbenchHref(pathname: string) {
  const params = new URLSearchParams();
  if (pathname && pathname !== "/workbench") {
    params.set("returnTo", pathname);
  }
  const query = params.toString();
  return query ? `/workbench?${query}` : "/workbench";
}

function normalizeReturnTo(value: string | null) {
  if (!value || value === "/workbench") {
    return "/";
  }
  return value;
}

export function AppChrome({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isWorkbench = localRuntime && pathname.startsWith("/workbench");
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    setReturnTo(normalizeReturnTo(new URLSearchParams(window.location.search).get("returnTo")));
  }, [pathname]);

  const switchHref = isWorkbench ? returnTo : buildWorkbenchHref(pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="font-serif text-xl font-black italic tracking-tight">{APP_NAME}</div>
            <Badge variant={isWorkbench ? "secondary" : "outline"} className="shrink-0">
              {isWorkbench ? "当前模式" : "阅读模式"}
            </Badge>
            {localRuntime && isWorkbench ? (
              <Badge variant="outline" className="shrink-0">
                已启用
              </Badge>
            ) : null}
          </div>

          {localRuntime ? (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant={isWorkbench ? "secondary" : "outline"}>
                <Link href={switchHref}>
                  {isWorkbench ? "返回阅读" : "进入工作台"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
