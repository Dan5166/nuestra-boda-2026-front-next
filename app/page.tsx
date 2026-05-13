import { redirect } from "next/navigation";
import { getSiteSettings } from "@/lib/siteSettings";
import HomeClient from "./HomeClient";
import PostbodaPage from "./postboda/page";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const [settings, params] = await Promise.all([
    getSiteSettings(),
    searchParams,
  ]);

  if (settings.homePage === "menu") {
    redirect(params.code ? `/menu?code=${params.code}` : "/menu");
  }

  if (settings.homePage === "postboda") {
    return <PostbodaPage />;
  }

  return <HomeClient />;
}
