"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function SettingsPage() {
  const dlqItems = useLiveQuery(() => db.dlq.toArray());
  const diagnostics = useLiveQuery(() => db.diagnosticsLog.reverse().toArray());

  const handleRetryDLQ = async (item: any) => {
    if (item.id) await db.dlq.delete(item.id);
    await db.pendingReviews.add({
      clientReviewId: item.clientReviewId,
      itemId: item.itemId,
      rating: item.rating,
      reviewedAt: item.reviewedAt,
      retryCount: 0,
    });
    window.location.reload();
  };

  const handleDiscardDLQ = async (id?: number) => {
    if (id) {
      await db.dlq.delete(id);
    }
  };

  const copyDiagnostics = () => {
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    alert("Diagnostics copied to clipboard!");
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
        <h1 className="text-xl font-bold text-emerald-400">Settings & Diagnostics</h1>
        <Link href="/study" className="text-slate-300 hover:text-white text-sm">
          ← Back to Study
        </Link>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-8">
        {/* Dead Letter Queue Section */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 text-white">
            Dead Letter Queue (Failed Syncs)
          </h2>
          {!dlqItems || dlqItems.length === 0 ? (
            <p className="text-sm text-slate-400">No failed review items.</p>
          ) : (
            <div className="space-y-3">
              {dlqItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-900 border border-slate-700 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-red-400">
                      Error: {item.errorMessage}
                    </p>
                    <p className="text-xs text-slate-400">
                      Item ID: {item.itemId} • Failed At: {item.failedAt}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRetryDLQ(item)}
                      className="px-3 py-1 bg-emerald-600 text-xs font-semibold rounded hover:bg-emerald-500"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => handleDiscardDLQ(item.id)}
                      className="px-3 py-1 bg-red-800 text-xs font-semibold rounded hover:bg-red-700"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Diagnostics Ring Buffer Log Viewer */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">
              Diagnostics Log (Max 500)
            </h2>
            <button
              onClick={copyDiagnostics}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Copy Diagnostics JSON
            </button>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg max-h-80 overflow-y-auto border border-slate-800 font-mono text-xs space-y-2">
            {!diagnostics || diagnostics.length === 0 ? (
              <p className="text-slate-500">No diagnostic logs recorded.</p>
            ) : (
              diagnostics.map((log) => (
                <div key={log.id} className="text-slate-300">
                  <span className="text-slate-500">[{log.timestamp}]</span>{" "}
                  <span
                    className={
                      log.level === "error"
                        ? "text-red-400 font-bold"
                        : "text-emerald-400"
                    }
                  >
                    [{log.level.toUpperCase()}]
                  </span>{" "}
                  {log.message}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
