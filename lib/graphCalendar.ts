import type { Booking, Room } from "./types";

// App-only (client credentials) Microsoft Graph access, reusing the same
// Azure AD App Registration already used for sign-in. Requires the
// *Application* permission "Calendars.ReadWrite" with admin consent — this
// is separate from the delegated sign-in permissions and must be granted
// explicitly in the Azure Portal (API permissions -> Add a permission ->
// Microsoft Graph -> Application permissions -> Calendars.ReadWrite ->
// Grant admin consent).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID!;
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gagal mengambil token Graph API: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// Creates an Outlook/Teams calendar event on the booker's own mailbox and
// returns its Graph event id (stored in the Bookings sheet so it can later
// be cancelled). Silently no-ops (returns undefined) if Graph credentials
// aren't configured or the booking has no bookerEmail, so this stays
// optional in dev/testing — mirrors the pattern in teamsNotify.ts.
export async function createCalendarEvent(
  booking: Booking,
  room: Room
): Promise<string | undefined> {
  if (!process.env.AZURE_AD_TENANT_ID || !booking.bookerEmail) return undefined;

  const token = await getGraphAppToken();

  const event = {
    subject: `${room.name} — ${booking.purpose || "Booking Ruangan"}`,
    body: {
      contentType: "text",
      content: booking.purpose || "Dibuat otomatis oleh sistem booking ruangan.",
    },
    start: {
      dateTime: `${booking.date}T${booking.startTime}:00`,
      timeZone: "Asia/Jakarta",
    },
    end: {
      dateTime: `${booking.date}T${booking.endTime}:00`,
      timeZone: "Asia/Jakarta",
    },
    location: { displayName: `${room.name} (${room.location})` },
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      booking.bookerEmail
    )}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    throw new Error(`Graph API gagal membuat event kalender: ${res.status}`);
  }

  const created = (await res.json()) as { id: string };
  return created.id;
}

// Cancels a previously created event. No-ops if the booking never got one
// (e.g. it was pending and rejected before approval).
export async function deleteCalendarEvent(
  bookerEmail: string,
  eventId: string
): Promise<void> {
  if (!process.env.AZURE_AD_TENANT_ID || !bookerEmail || !eventId) return;

  const token = await getGraphAppToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      bookerEmail
    )}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Graph API gagal membatalkan event kalender: ${res.status}`);
  }
}
