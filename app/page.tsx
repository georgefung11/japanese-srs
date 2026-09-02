import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold mb-4 text-emerald-400">
        日本語 SRS Flashcards
      </h1>
      <p className="text-slate-300 max-w-md mb-8">
        Offline-first Spaced Repetition System for mastering Japanese vocabulary and grammar anywhere.
      </p>
      <div className="flex gap-4">
        <Link
          href="/study"
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg transition"
        >
          Start Reviewing
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 font-semibold rounded-lg border border-slate-700 transition"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
