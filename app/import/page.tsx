"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { createClient } from "@/utils/supabase/client";
import * as wanakana from "wanakana";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Manual Form State with Wanakana
  const [japanese, setJapanese] = useState("");
  const [reading, setReading] = useState("");
  const [meaning, setMeaning] = useState("");
  const [type, setType] = useState<"vocabulary" | "grammar">("vocabulary");

  useEffect(() => {
    const readingElem = document.getElementById("reading-input");
    if (readingElem) {
      wanakana.bind(readingElem as HTMLInputElement);
    }
    return () => {
      if (readingElem) {
        wanakana.unbind(readingElem as HTMLInputElement);
      }
    };
  }, []);

  const handleFileUpload = async () => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatus("Error: File size exceeds 2 MB limit.");
      return;
    }

    setLoading(true);
    setStatus("Processing file with Web Worker...");

    const ext = file.name.split(".").pop()?.toLowerCase();
    const fileType = ext === "csv" ? "csv" : ext === "json" ? "json" : null;

    if (!fileType) {
      setStatus("Error: Only CSV and JSON files are supported.");
      setLoading(false);
      return;
    }

    const worker = new Worker("/import-worker.js");
    worker.postMessage({ file, fileType });

    worker.onmessage = async (e) => {
      const { success, items, errors, error } = e.data;
      if (!success) {
        setStatus(`Import failed: ${error}`);
      } else {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();

        const formattedItems = items.map((item: any) => ({
          ...item,
          user_id: userData.user?.id,
          is_custom: true,
        }));

        const { error: insertErr } = await supabase
          .from("study_items")
          .insert(formattedItems);

        if (insertErr) {
          setStatus(`Database insert error: ${insertErr.message}`);
        } else {
          setStatus(
            `Successfully imported ${items.length} cards! ${
              errors.length > 0 ? `(${errors.length} skipped)` : ""
            }`
          );
        }
      }
      setLoading(false);
      worker.terminate();
    };
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!japanese || !reading || !meaning) return;

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const clientImportId = crypto.randomUUID();
    const newItem = {
      japanese,
      reading,
      meaning,
      type,
      is_custom: true,
      client_import_id: clientImportId,
      user_id: userData.user?.id,
    };

    const { data, error } = await supabase
      .from("study_items")
      .insert(newItem)
      .select()
      .single();

    if (error) {
      setStatus(`Error adding card: ${error.message}`);
    } else {
      await db.items.put({
        id: data.id,
        japanese,
        reading,
        meaning,
        type,
        interval: 1,
        repetitionCount: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        isCustom: true,
      });
      setStatus("Card added successfully!");
      setJapanese("");
      setReading("");
      setMeaning("");
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
        <h1 className="text-xl font-bold text-emerald-400">Import & Create</h1>
        <Link href="/study" className="text-slate-300 hover:text-white text-sm">
          ← Back to Study
        </Link>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-8">
        {status && (
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200">
            {status}
          </div>
        )}

        {/* Bulk Upload Section */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-2 text-white">Bulk File Import</h2>
          <p className="text-sm text-slate-400 mb-4">
            Upload CSV or JSON files (max 2 MB / 1,000 rows). Required columns:{" "}
            <code className="text-emerald-400">japanese, reading, meaning</code>.
          </p>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 cursor-pointer"
            />
            <button
              onClick={handleFileUpload}
              disabled={!file || loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg text-sm transition disabled:opacity-50"
            >
              Upload
            </button>
          </div>
        </section>

        {/* Manual Card Form */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 text-white">Create Single Card</h2>
          <form onSubmit={handleManualAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Japanese Text</label>
              <input
                type="text"
                value={japanese}
                onChange={(e) => setJapanese(e.target.value)}
                required
                placeholder="漢字 / 単語"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Reading (Auto Romaji-to-Kana)
              </label>
              <input
                id="reading-input"
                type="text"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                required
                placeholder="Type in romaji (e.g. nihongo -> にほんご)"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meaning</label>
              <input
                type="text"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                required
                placeholder="English translation"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-emerald-500"
              >
                <option value="vocabulary">Vocabulary</option>
                <option value="grammar">Grammar</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg transition"
            >
              Add Flashcard
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
