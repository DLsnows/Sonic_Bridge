import pc from "picocolors";
import { apiFetch, formatApiError, wantsJson } from "../api.js";
import { loadConfig } from "../config.js";

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
      // Machine-readable output keeps the `projects` array for back-compat
      // with any agent already piping `whoami --json`. Prefer
      // `project ls --json` for new integrations.
      const payload = {
        user: me.user,
        projects: me.projects ?? [],
        activeProject: cfg?.activeProject ?? null,
      };
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(
      `Logged in as ${pc.bold(me.user.username)} (${me.user.email})`,
    );
    const active = cfg?.activeProject;
    if (active?.id) {
      const prefix = active.id.slice(0, 8);
      console.log(
        `Active project: ${pc.bold(active.name ?? active.id)} (${prefix})`,
      );
    }
    console.log(
      `Run \`${pc.cyan("sonicbridge project ls")}\` to see your projects.`,
    );
  } catch (err) {
    console.error(pc.red(formatApiError(err)));
    process.exit(1);
  }
}
