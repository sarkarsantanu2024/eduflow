import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Not normally reached: the `beforeFiles` rewrite in next.config.ts serves the
 * marketing page (public/site.html) at "/". Kept as the fallback so removing
 * that rewrite restores the old behaviour — straight into the app.
 */
export default async function Home() {
  const profile = await getCurrentProfile();
  redirect(profile ? "/dashboard" : "/login");
}
