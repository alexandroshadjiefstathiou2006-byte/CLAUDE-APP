import { Sidebar } from "@/components/sidebar";
import { requireContext } from "@/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, user } = await requireContext();
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar workspaceName={workspace.name} credits={workspace.creditBalance} plan={workspace.plan} userName={user.email} />
      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
