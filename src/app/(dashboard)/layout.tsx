import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/demo";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  // In demo mode the business name comes from the browser store (header reads it).
  let instituteName: string | undefined;
  if (!DEMO_MODE && profile.institute_id) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("institutes")
      .select("name")
      .eq("id", profile.institute_id)
      .single();
    instituteName = data?.name;
  }

  return (
    <AppShell
      profile={profile}
      instituteName={instituteName}
      planLabel={DEMO_MODE ? "Demo · Growth" : "Growth plan"}
    >
      {children}
    </AppShell>
  );
}
