import { PublicSite } from "@/components/public-site";
import { getPublicSiteData } from "@/lib/public-content";

export default async function ProvidersPage() {
  const data = await getPublicSiteData();

  return <PublicSite data={data} view="providers" />;
}
