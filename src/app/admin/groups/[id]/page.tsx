import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getGroupById, listGroupMembers } from "@/lib/settings/queries";
import { GroupForm } from "./group-form";
import { MembersSection } from "./members-section";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminGroupPage({ params }: PageProps) {
  const { id } = await params;
  const group = await getGroupById(id).catch(() => null);
  if (!group) notFound();
  const members = await listGroupMembers(id).catch(() => []);

  return (
    <AdminShell
      title={`Group · ${group.name}`}
      description={
        group.isDefault ? "Default group · new users join automatically." : group.description
      }
    >
      <GroupForm group={group} />
      <MembersSection members={members} />
    </AdminShell>
  );
}
