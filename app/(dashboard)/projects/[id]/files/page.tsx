import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default async function FilesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <TopBar title="Project Files" subtitle="Cloud storage — coming in Phase 4" />
      <div className="p-6">
        <GlassPanel glow="cyan" className="text-center py-16">
          <div className="text-5xl mb-4">◫</div>
          <h2 className="font-['Share_Tech_Mono',monospace] neon-text-cyan text-xl mb-2">
            Project Files
          </h2>
          <p className="text-[#A0A0B0]">
            File upload, download, and management will be available in Phase 4.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
