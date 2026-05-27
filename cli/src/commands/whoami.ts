import pc from "picocolors";
import { apiFetch, formatApiError, wantsJson } from "../api.js";
import { loadConfig } from "../config.js";
import { renderTable } from "../util/table.js";

interface MeResponse {
  user: { id: string; username: string; email: string; avatar?: string | null };
  projects?: Array<{
    id: string;
    customId?: string | null;
    name: string;
    role: string;
  }>;
}

export interface WhoamiFlags {
  json?: boolean;
}

export async function runWhoami(flags: WhoamiFlags): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg?.token) {
    console.error(pc.red("Not logged in. Run `sonicbridge login`."));
    process.exit(1);
  }

  try {
    const me = await apiFetch<MeResponse>("/api/user/me");
    if (wantsJson(flags)) {
      console.log(JSON.stringify(me, null, 2));
      return;
    }
    console.log(`${pc.bold("Username:")} ${me.user.username}`);
    console.log(`${pc.bold("Email:   ")} ${me.user.email}`);
    if (me.projects && me.projects.length > 0) {
      console.log("");
      console.log(pc.bold("Projects:"));
      const activeId = cfg.activeProject?.id;
      const rows = me.projects.map((p) => ({
        active: p.id === activeId ? "*" : "",
        id: p.id,
        customId: p.customId ?? "",
        name: p.name,
        role: p.role,
      }));
      console.log(
        renderTable(
          [
            { header: " ", key: "active", maxWidth: 1 },
            { header: "id", key: "id" },
            { header: "customId", key: "customId" },
            { header: "name", key: "name" },
            { header: "role", key: "role" },
          ],
          rows,
        ),
      );
    } else {
      console.log(pc.dim("(no project memberships)"));
    }
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}
