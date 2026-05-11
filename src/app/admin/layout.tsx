import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/roles";

export const metadata = {
  title: "Admin · Dictaphone",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login?next=/admin");
  if (!isAdmin(session)) redirect("/");
  return <>{children}</>;
}
