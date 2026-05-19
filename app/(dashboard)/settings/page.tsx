import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { UserSettingsForm } from "./UserSettingsForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  return (
    <div>
      <TopBar title="User Settings" showBack backHref="/" />
      <div className="p-6 max-w-xl mx-auto">
        <UserSettingsForm
          userId={user.id}
          username={user.username}
          email={user.email}
        />
      </div>
    </div>
  );
}
