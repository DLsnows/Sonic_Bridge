import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { GlassPanel } from "@/components/ui/GlassPanel";

export default async function SpacePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <TopBar title="Creative Space" subtitle="Real-time collaboration — coming in Phase 2" />
      <div className="p-6">
        <GlassPanel glow="green" className="text-center py-16">
          <div className="text-5xl mb-4">◈</div>
          <h2 className="font-['Share_Tech_Mono',monospace] neon-text text-xl mb-2">
            Creative Space
          </h2>
          <p className="text-[#A0A0B0]">
            Real-time audio streaming, screen sharing, and video calls will be available in Phase 2.
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
