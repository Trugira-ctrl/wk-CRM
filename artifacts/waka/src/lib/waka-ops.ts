// Small shared helpers for WAKA operational pages.
import type { NotificationRun, Workspace } from "@workspace/api-client-react";
import { format } from "date-fns";

/** Backend serializes legacy MANUAL_OVERRIDE as ALLOWED; treat both as allowed. */
export function isAllowed(decision: string | undefined | null): boolean {
  return decision === "ALLOWED" || decision === "MANUAL_OVERRIDE";
}

/** Never show a valid-membership reason beside a denial. */
export function denialReason(reason: string | undefined | null): string {
  if (!reason) return "Reason not recorded";
  if (/membership valid|valid membership/i.test(reason)) return "Reason not recorded";
  return reason;
}

export function kigaliToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "No membership";
  return format(new Date(d), "dd MMM yyyy");
}

export const FOLLOW_UP = "STAFF FOLLOW-UP REQUIRED";
export const UNKNOWN_LEGACY = "UNKNOWN LEGACY OUTCOME";

/** Runs straight from the backend, newest first, attempts chronological. */
export function getNotificationRuns(ws: Workspace): NotificationRun[] {
  return ws.notification_runs
    .map(r => ({ ...r, attempts: [...r.attempts].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id) }))
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export function isFollowUp(status: string): boolean {
  return status === FOLLOW_UP;
}

export function isUncertain(run: NotificationRun): boolean {
  return run.uncertain || run.final_status === UNKNOWN_LEGACY;
}

export function notificationMetrics(ws: Workspace) {
  return {
    failedChains: ws.metrics.failed_notification_chains,
    failedAttempts: ws.metrics.failed_notification_attempts,
    followups: ws.metrics.followup_count,
  };
}

export function simulatedChannel(channel: string): string {
  return /simulated/i.test(channel) ? channel : `SIMULATED ${channel}`;
}
