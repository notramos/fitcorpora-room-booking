import { NextRequest, NextResponse } from "next/server";
import {
  getBookingsDueForReminder,
  getRoomById,
  markReminderSent,
} from "@/lib/sheetsDb";
import { notifyMeetingReminder } from "@/lib/teamsNotify";

// How far ahead of a meeting's start time the reminder goes out. Call this
// endpoint more often than this window (every 5–10 min is plenty) — it's
// idempotent per booking via the `reminderSent` flag, so extra calls just
// find nothing new to send.
const REMINDER_WINDOW_MINUTES = 30;

// Meant to be triggered by an external scheduler (AWS EventBridge,
// cron-job.org, GitHub Actions cron, etc.) — this app has no built-in cron.
// Protected by a shared secret since it's a public URL: pass it as
// ?secret=... or an `Authorization: Bearer ...` header, matching
// CRON_SECRET in the environment.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // no secret configured — open (dev only)

  const fromQuery = request.nextUrl.searchParams.get("secret");
  const fromHeader = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  return fromQuery === expected || fromHeader === expected;
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const due = await getBookingsDueForReminder(REMINDER_WINDOW_MINUTES);

    let sent = 0;
    for (const booking of due) {
      const room = await getRoomById(booking.roomId);
      if (!room) continue;

      try {
        await notifyMeetingReminder(booking, room);
        await markReminderSent(booking.id);
        sent++;
      } catch {
        // Leave reminderSent false so the next run retries this booking.
      }
    }

    return NextResponse.json({ checked: due.length, sent });
  } catch {
    return NextResponse.json(
      { error: "Gagal memproses pengingat." },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
