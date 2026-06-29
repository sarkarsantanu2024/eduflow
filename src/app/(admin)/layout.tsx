import { ShieldCheck } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

/** Platform console shell — super-admin only, no tenant sidebar. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <ShieldCheck className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">EduFlow · Platform Admin</p>
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
