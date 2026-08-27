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
    <div className="dark flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* h-dvh (not min-h-full) pins this subtree to exactly one viewport
          tall, independent of the root layout's body (which uses min-h-full
          and is meant to grow for normal scrolling pages elsewhere in the
          app). Without this, if the kiosk content is ever taller than the
          screen, the whole page — including this frame — just grows past
          the viewport instead of the agenda list scrolling internally. */}
      {/* Outer frame border — wall-mounted tablets often crop right to the
          bezel with no visual boundary between content and the physical
          edge of the screen; this border gives the display a defined "card"
          edge instead of content bleeding straight into the bezel. */}
      <div className="mx-[34px] mt-[34px] mb-[46px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-4 border-foreground/15 sm:mx-[42px] sm:mt-[42px] sm:mb-[54px]">
        {children}
      </div>
    </div>
  );
}
