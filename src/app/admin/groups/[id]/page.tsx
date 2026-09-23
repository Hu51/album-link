import { AdminGroupEdit } from "@/components/admin-group-edit";

export default async function GroupEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminGroupEdit id={id} />;
}
