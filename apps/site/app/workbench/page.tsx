import Link from "next/link";

import { APP_NAME } from "@mind-wiki/core";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const localRuntime = process.env.NODE_ENV !== "production";

export default async function WorkbenchPage() {
  if (!localRuntime) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-6rem)] max-w-3xl items-center px-4 py-16">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Development only</CardTitle>
            <CardDescription>
              The local curation view is only available while developing {APP_NAME}. Public builds keep
              the browser shell public-only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to public reading</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { WorkbenchApp } = await import("@/components/workbench");

  return <WorkbenchApp />;
}
