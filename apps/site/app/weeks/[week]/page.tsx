import { PublicSite } from "@/components/public-site";
import { getPublicSiteData } from "@/lib/public-content";

export async function generateStaticParams() {
  const data = await getPublicSiteData();

  return data.weeks.map((week) => ({
    week: week.weekStart
  }));
}

export const dynamicParams = false;

export default async function WeekPage({ params }: { params: Promise<{ week: string }> }) {
  const [{ week }, data] = await Promise.all([params, getPublicSiteData()]);

  return <PublicSite data={data} view="week-detail" selectedWeek={week} />;
}
