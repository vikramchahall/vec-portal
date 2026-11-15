import "server-only";
import { readFile, stat } from "node:fs/promises";

/**
 * Result of the server's nightly database backup (/opt/vec/bin/backup.sh writes this file after every run).
 * Shown on the dashboard so a failing backup is noticed the next morning, not when the data is needed.
 */
export type BackupStatus =
  | { state: "ok"; at: Date; bytes: number; copies: number; hours: number }
  | { state: "old"; at: Date; hours: number }
  | { state: "failed"; at: Date; error: string }
  | { state: "none" };

export async function backupStatus(): Promise<BackupStatus> {
  const file = process.env.BACKUP_STATUS_FILE ?? "/opt/vec/shared/backup-status.json";
  try {
    const [txt, st] = await Promise.all([readFile(file, "utf8"), stat(file)]);
    const s = JSON.parse(txt) as { ok: boolean; at?: string; error?: string; bytes?: number; copies?: number };
    const at = s.at ? new Date(s.at) : st.mtime;
    const hours = (Date.now() - at.getTime()) / 3600000;
    if (!s.ok) return { state: "failed", at, error: s.error ?? "unknown error" };
    if (hours > 36) return { state: "old", at, hours };
    return { state: "ok", at, bytes: s.bytes ?? 0, copies: s.copies ?? 0, hours };
  } catch {
    return { state: "none" };
  }
}
