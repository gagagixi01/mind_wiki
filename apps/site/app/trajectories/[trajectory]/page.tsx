import type { Trajectory } from "@mind-wiki/core/schema";
import { PublicSite } from "@/components/public-site";
import { getPublicSiteData } from "@/lib/public-content";

export async function generateStaticParams() {
  const data = await getPublicSiteData();

  return data.trajectories.map((trajectory) => ({
    trajectory: trajectory.id
  }));
}

export const dynamicParams = false;

export default async function TrajectoryPage({
  params
}: {
  params: Promise<{ trajectory: Trajectory }>;
}) {
  const [{ trajectory }, data] = await Promise.all([params, getPublicSiteData()]);

  return <PublicSite data={data} view="trajectories" selectedTrajectory={trajectory} />;
}
