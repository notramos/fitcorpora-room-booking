import TeamsSsoBootstrap from "./TeamsSsoBootstrap";

// Must not be statically cached — the whole point of this route is to run
// the client-side silent-auth handshake on every load.
export const dynamic = "force-dynamic";

export default function TeamsEntryPage() {
  return (
    <main className="flex min-h-[100dvh] flex-1 items-center justify-center p-6">
      <TeamsSsoBootstrap />
    </main>
  );
}
