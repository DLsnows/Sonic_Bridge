import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <TopBar title="Schedule" subtitle="Project timeline — coming in Phase 5" />
      <div className="p-6">
        <GlassPanel glow="purple" className="text-center py-16">
          <div className="text-5xl mb-4">◷</div>
          <h2 className="font-['Share_Tech_Mono',monospace] neon-text-purple text-xl mb-2">
            Schedule
          </h2>
          <p className="text-[#A0A0B0]">
            Calendar and event management will be available in Phase 5.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
