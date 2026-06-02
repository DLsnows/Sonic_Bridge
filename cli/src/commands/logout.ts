import pc from "picocolors";
import { clearConfig, loadConfig } from "../config.js";
import { promptConfirm } from "../util/prompt.js";
import { apiFetch } from "../api.js";

interface MeResponse {
  user: { username: string; email: string };
}

export async function runLogout(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg || !cfg.token) {
    console.log("You are not logged in.");
    return;
  }

  let username = "the current account";
  try {
    const me = await apiFetch<MeResponse>("/api/user/me");
    username = me.user.username;
  } catch {
    // Fall back to a generic message if we can't reach the server.
  }

  const ok = await promptConfirm(`Log out of ${username}?`, true);
  if (!ok) {
    console.log("Cancelled.");
    return;
  }

  await clearConfig();
  console.log(pc.green("Logged out."));
}
