import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0c0b0a] text-[#f4efe6]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, #3a2f22 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 90% 20%, #2a2218 0%, transparent 50%)",
        }}
      />
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-[0.35em] text-[#c4a574]">
          Album Link
        </p>
        <h1 className="mt-4 font-heading text-5xl leading-tight tracking-tight sm:text-6xl">
          Share folders.
          <br />
          Keep the NAS private.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[#b7aea0]">
          Point this app at your year/event photo tree. Guests open a token link
          and only see the albums you assigned — no UGOS login, no copied library.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="inline-flex h-10 items-center rounded-lg bg-[#c4a574] px-4 text-sm font-medium text-[#1a140e] transition hover:bg-[#d4b888]"
          >
            Open admin
          </Link>
        </div>
      </main>
    </div>
  );
}
