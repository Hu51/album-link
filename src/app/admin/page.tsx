import { isAdminAuthenticated } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLoginForm } from "@/components/admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return <AdminLoginForm />;
  }
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f7f3eb_0%,_#ebe4d8_50%,_#ddd4c4_100%)]">
      <AdminDashboard />
    </div>
  );
}
