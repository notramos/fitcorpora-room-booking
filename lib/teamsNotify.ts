import type { Booking, Room } from "./types";

function formatDateLong(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Posts to the Teams "Post to a channel when a webhook request is
// received" Power Automate flow behind TEAMS_APPROVAL_WEBHOOK_URL. That
// flow's "Post card in a chat or channel" action expects the request body
// to BE a raw Adaptive Card object (root "type": "AdaptiveCard") — not
// wrapped in a MessageCard/attachments envelope, and not a plain
// {"text": ...} payload. Silently no-ops if the env var isn't set, so
// this stays optional in dev/testing.
export async function notifyPendingApproval(
  booking: Booking,
  room: Room
): Promise<void> {
  const webhookUrl = process.env.TEAMS_APPROVAL_WEBHOOK_URL;
  if (!webhookUrl) return;

  const approvalUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/approval`
    : "/approval";

  const card = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: booking.isOvertime
          ? "⚠️ Pengajuan overtime menunggu persetujuan"
          : "Booking ruangan menunggu persetujuan",
        weight: "Bolder",
        size: "Medium",
        wrap: true,
      },
      {
        type: "FactSet",
        facts: [
          ...(booking.isOvertime
            ? [{ title: "Jenis", value: "Overtime (di luar jam operasional)" }]
            : []),
          { title: "Ruangan", value: room.name },
          { title: "Tanggal", value: formatDateLong(booking.date) },
          { title: "Jam", value: `${booking.startTime}–${booking.endTime}` },
          { title: "Pemesan", value: booking.bookerName },
          ...(booking.purpose
            ? [{ title: "Keperluan", value: booking.purpose }]
            : []),
          ...(booking.overtimeNote
            ? [{ title: "Keterangan Pendukung", value: booking.overtimeNote }]
            : []),
        ],
      },
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "Buka Halaman Persetujuan",
        url: approvalUrl,
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    throw new Error(`Teams webhook responded with ${res.status}`);
  }
}

// Posts to the Teams "Post card in a chat" Power Automate flow behind
// TEAMS_REMINDER_WEBHOOK_URL — a *separate* flow/webhook from the approval
// one above, configured to DM the booker instead of posting to a channel.
// When setting that flow up, map its "Recipient" field to
// `triggerBody()?['recipientEmail']` and its "Adaptive Card" field to
// `string(triggerBody()?['card'])`. Silently no-ops if the env var isn't
// set, or if the booking has no email to DM (which is normal until Azure AD
// auth is enabled and starts populating bookerEmail automatically).
export async function notifyMeetingReminder(
  booking: Booking,
  room: Room
): Promise<void> {
  const webhookUrl = process.env.TEAMS_REMINDER_WEBHOOK_URL;
  if (!webhookUrl || !booking.bookerEmail) return;

  const card = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "Meeting Anda akan segera dimulai",
        weight: "Bolder",
        size: "Medium",
        wrap: true,
      },
      {
        type: "FactSet",
        facts: [
          { title: "Ruangan", value: room.name },
          { title: "Lokasi", value: room.location },
          { title: "Jam", value: `${booking.startTime}–${booking.endTime}` },
          ...(booking.purpose
            ? [{ title: "Keperluan", value: booking.purpose }]
            : []),
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientEmail: booking.bookerEmail, card }),
  });

  if (!res.ok) {
    throw new Error(`Teams reminder webhook responded with ${res.status}`);
  }
}
