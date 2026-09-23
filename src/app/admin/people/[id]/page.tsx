import { AdminPersonEdit } from "@/components/admin-person-edit";

export default async function PersonEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminPersonEdit id={id} />;
}
