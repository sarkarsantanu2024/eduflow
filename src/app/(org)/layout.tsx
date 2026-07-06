import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireOrgAdmin } from "@/lib/auth";
import { FEATURES } from "@/lib/features";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

/** Head-Office console shell — franchise owner (org_admin) only, no tenant sidebar. */
export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Feature-flagged: when the Head-Office console is off, these routes 404
  // (a plain redirect could loop with the dashboard's org_admin → /org rule).
  if (!FEATURES.headOffice) notFound();

  const profile = await requireOrgAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">EduFlow · Head Office</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </header>
      <main className="nice-scroll flex-1 overflow-auto">
        <div className="w-full px-3 py-4 sm:px-8 sm:py-5">{children}</div>
      </main>
    </div>
  );
}
