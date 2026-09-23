import { AdminLoginForm } from "@/components/admin-login-form";
import { AdminShell } from "@/components/admin-shell";
import { isAdminAuthenticated } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthenticated();
  if (!authed) return <AdminLoginForm appName={APP_NAME} />;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f7f3eb_0%,_#ebe4d8_50%,_#ddd4c4_100%)]">
      <AdminShell appName={APP_NAME}>{children}</AdminShell>
    </div>
  );
}
