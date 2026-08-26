// The /display kiosk pages (wall-mounted tablets showing room status)
// always render in dark mode, regardless of the saved theme preference or
// OS setting used elsewhere in the app — there's no "user" here to have a
// preference. Scoping the `dark` class to this subtree (rather than relying
// on the root layout's localStorage-driven toggle) keeps it correct on
// first paint, with no flash and no JS required.
export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex min-h-full flex-1 flex-col bg-background text-foreground">
      {/* Outer frame border — wall-mounted tablets often crop right to the
          bezel with no visual boundary between content and the physical
          edge of the screen; this border gives the display a defined "card"
          edge instead of content bleeding straight into the bezel. */}
      <div className="m-3 flex flex-1 flex-col rounded-2xl border-4 border-foreground/15 sm:m-4">
        {children}
      </div>
    </div>
  );
}
