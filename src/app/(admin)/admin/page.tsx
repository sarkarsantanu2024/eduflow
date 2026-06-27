import { listCustomers } from "@/features/admin/actions";
import { AdminConsole } from "@/features/admin/admin-console";
import { ChangePasswordCard } from "@/features/auth/change-password-card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const customers = await listCustomers();
  return (
    <div className="space-y-8">
      <AdminConsole customers={customers} />
      <ChangePasswordCard />
    </div>
  );
}
