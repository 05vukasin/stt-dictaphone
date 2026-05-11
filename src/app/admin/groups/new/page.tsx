import { AdminShell } from "@/components/admin/admin-shell";
import { NewGroupForm } from "./new-group-form";

export const dynamic = "force-dynamic";

export default function NewGroupPage() {
  return (
    <AdminShell title="New group" description="Create a group, then edit its settings.">
      <NewGroupForm />
    </AdminShell>
  );
}
