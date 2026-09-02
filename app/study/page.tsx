"use client";

import { useState, useEffect } from "react";
import { db, LocalItem } from "@/lib/db";
import { calculateSM2 } from "@/lib/srs";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { handleLogout } from "@/lib/auth";

export default function StudyPage() {
  const [dueCards, setDueCards] = useState<LocalItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCards() {
      setLoading(true);
      const now = new Date().toISOString();
      let items = await db.items.where("nextReviewDate").lte(now).toArray();

      if (items.length === 0 && navigator.onLine) {
        const supabase = createClient();
        const { data } = await supabase.from("due_reviews_v").select("*").limit(50);
        if (data && data.length > 0) {
          const localData: LocalItem[] = data.map((d: any) => ({
            id: d.item_id,
            japanese: d.japanese,
            reading: d.reading,
            meaning: d.meaning,
            type: d.type,
            example_sentence: d.example_sentence,
            jlpt_level: d.jlpt_level,
            interval: d.interval || 1,
            repetitionCount: d.repetition_count || 0,
            easeFactor: d.ease_factor || 2.5,
            nextReviewDate: d.next_review_date || new Date().toISOString(),
          }));
          await db.items.bulkPut(localData);
          items = localData;
        }
      }

      setDueCards(items);
      setLoading(false);
    }

    loadCards();
  }, []);

  const handleRating = async (rating: number) => {
    const currentCard = dueCards[currentIndex];
    if (!currentCard) return;

    const sm2 = calculateSM2({
      interval: currentCard.interval,
      repetitionCount: currentCard.repetitionCount,
      easeFactor: currentCard.easeFactor,
      rating,
    });

    const updatedCard: LocalItem = {
      ...currentCard,
      interval: sm2.interval,
      repetitionCount: sm2.repetitionCount,
      easeFactor: sm2.easeFactor,
      nextReviewDate: sm2.nextReviewDate.toISOString(),
    };

    await db.items.put(updatedCard);

    const clientReviewId = crypto.randomUUID();
    const reviewPayload = {
      clientReviewId,
      itemId: currentCard.id,
      rating,
      reviewedAt: new Date().toISOString(),
      retryCount: 0,
    };

    if (navigator.onLine) {
      const supabase = createClient();
      const { error } = await supabase.rpc("submit_review", {
        p_item_id: currentCard.id,
        p_client_review_id: clientReviewId,
        p_rating: rating,
        p_reviewed_at: reviewPayload.reviewedAt,
      });

      if (error) {
        await db.pendingReviews.add(reviewPayload);
      }
    } else {
      await db.pendingReviews.add(reviewPayload);
    }

    setShowAnswer(false);
    if (currentIndex + 1 < dueCards.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setDueCards([]);
    }
  };

  const current = dueCards[currentIndex];

  return (
    <div className="flex-1 flex flex-col">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur">
        <h1 className="text-xl font-bold text-emerald-400">Japanese SRS</h1>
        <nav className="flex gap-4 text-sm items-center">
          <Link href="/import" className="text-slate-300 hover:text-white">
            Import
          </Link>
          <Link href="/settings" className="text-slate-300 hover:text-white">
            Settings
          </Link>
          <button
            onClick={() => handleLogout(createClient())}
            className="text-red-400 hover:text-red-300"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {loading ? (
          <p className="text-slate-400">Loading flashcards...</p>
        ) : !current ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">
              🎉 All Catch Up!
            </h2>
            <p className="text-slate-400 mb-6">No cards due for review right now.</p>
            <Link
              href="/import"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-semibold transition"
            >
              Import Custom Cards
            </Link>
          </div>
        ) : (
          <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center min-h-[350px] justify-between shadow-2xl">
            <div className="text-center w-full">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full">
                {current.type} {current.jlpt_level && `• ${current.jlpt_level}`}
              </span>
              <h2 className="text-5xl font-extrabold mt-6 mb-2 text-white">
                {current.japanese}
              </h2>
              {showAnswer && (
                <div className="mt-6 border-t border-slate-700 pt-6 space-y-2 animate-fadeIn">
                  <p className="text-xl text-emerald-300 font-medium">
                    {current.reading}
                  </p>
                  <p className="text-lg text-slate-200">{current.meaning}</p>
                  {current.example_sentence && (
                    <p className="text-sm text-slate-400 italic mt-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                      "{current.example_sentence}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full mt-8 py-3 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-xl text-lg transition shadow-lg"
              >
                Show Answer
              </button>
            ) : (
              <div className="w-full mt-6 grid grid-cols-6 gap-2">
                {[0, 1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleRating(rating)}
                    className={`py-2 text-sm font-bold rounded-lg transition border ${
                      rating < 3
                        ? "bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/60"
                        : "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60"
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
