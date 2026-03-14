import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-warm-white flex flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl mb-6">🍽️</p>
      <h1 className="font-serif text-4xl font-black text-charcoal mb-3">
        Nothing here
      </h1>
      <p className="text-mid text-sm mb-8 max-w-xs">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="bg-clay text-white font-bold py-3 px-6 rounded-xl hover:bg-clay-dark transition-colors"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
