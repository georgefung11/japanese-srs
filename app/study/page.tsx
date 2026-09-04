"use client";

import { useState, useEffect } from "react";
import { db, LocalItem } from "@/lib/db";
import { calculateSM2 } from "@/lib/srs";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { handleLogout } from "@/lib/auth";

export default function StudyPage() {
  const [cards, setCards] = useState<LocalItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Test Mode States
  const [isTestMode, setIsTestMode] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [testFeedback, setTestFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    async function loadCards() {
      setLoading(true);
      const now = new Date().toISOString();
      let items = await db.items.where("nextReviewDate").belowOrEqual(now).toArray();

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

      setCards(items);
      setLoading(false);
    }

    loadCards();
  }, []);

  // Card Navigation Handlers
  const handleNextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetCardState();
    }
  };

  const handlePrevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetCardState();
    }
  };

  const resetCardState = () => {
    setShowAnswer(false);
    setUserAnswer("");
    setTestFeedback(null);
  };

  const toggleTestMode = () => {
    setIsTestMode(!isTestMode);
    setScore({ correct: 0, total: 0 });
    resetCardState();
  };

  // Test Answer Evaluation
  const handleCheckTestAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    const normalizedUser = userAnswer.trim().toLowerCase();
    const normalizedMeaning = currentCard.meaning.trim().toLowerCase();
    const normalizedReading = currentCard.reading.trim().toLowerCase();

    // Validates against meaning or reading accuracy
    const isCorrect =
      normalizedUser === normalizedMeaning ||
      normalizedUser === normalizedReading ||
      normalizedMeaning.includes(normalizedUser);

    if (isCorrect) {
      setTestFeedback("correct");
      setScore((prev) => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
    } else {
      setTestFeedback("incorrect");
      setScore((prev) => ({ ...prev, total: prev.total + 1 }));
    }
    setShowAnswer(true);
  };

  // SRS Rating Submission
  const handleRating = async (rating: number) => {
    const currentCard = cards[currentIndex];
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

    handleNextCard();
  };

  const current = cards[currentIndex];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-white">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 backdrop-blur">
        <h1 className="text-xl font-bold text-emerald-400">Japanese SRS</h1>
        <nav className="flex gap-4 text-sm items-center">
          <button
            onClick={toggleTestMode}
            className={`px-3 py-1 rounded-lg font-semibold transition border ${
              isTestMode
                ? "bg-purple-900/50 border-purple-500 text-purple-300"
                : "border-slate-700 text-slate-300 hover:text-white"
            }`}
          >
            {isTestMode ? "Exit Test Mode" : "Start Test"}
          </button>
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
              🎉 All Caught Up!
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
          <div className="w-full max-w-lg flex flex-col gap-4">
            {/* Header controls for Test Mode Score */}
            {isTestMode && (
              <div className="flex justify-between items-center px-2 text-sm text-slate-400">
                <span>Memory Test Mode</span>
                <span>
                  Score: {score.correct} / {score.total}
                </span>
              </div>
            )}

            {/* Main Flashcard Body */}
            <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center min-h-[360px] justify-between shadow-2xl">
              <div className="text-center w-full">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full">
                  {current.type} {current.jlpt_level && `• ${current.jlpt_level}`}
                </span>
                <h2 className="text-5xl font-extrabold mt-6 mb-2 text-white">
                  {current.japanese}
                </h2>

                {/* Test Mode Input Form */}
                {isTestMode && !showAnswer && (
                  <form onSubmit={handleCheckTestAnswer} className="mt-6 space-y-3">
                    <input
                      type="text"
                      placeholder="Type reading or meaning..."
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 font-semibold rounded-lg transition"
                    >
                      Submit Answer
                    </button>
                  </form>
                )}

                {/* Result Feedback Banner for Test Mode */}
                {isTestMode && testFeedback && (
                  <div
                    className={`mt-4 p-2 rounded-lg text-sm font-bold ${
                      testFeedback === "correct"
                        ? "bg-emerald-950/80 border border-emerald-700 text-emerald-300"
                        : "bg-red-950/80 border border-red-700 text-red-300"
                    }`}
                  >
                    {testFeedback === "correct" ? "✓ Correct!" : "✗ Incorrect"}
                  </div>
                )}

                {/* Answer Display Section */}
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

              {/* Standard Review Controls */}
              {!isTestMode && !showAnswer && (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full mt-8 py-3 bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-xl text-lg transition shadow-lg"
                >
                  Show Answer
                </button>
              )}

              {/* Standard SRS Rating Options */}
              {!isTestMode && showAnswer && (
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

            {/* Backward / Forward Card Flipping Controls */}
            <div className="flex justify-between items-center text-sm">
              <button
                onClick={handlePrevCard}
                disabled={currentIndex === 0}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ← Previous
              </button>
              <span className="text-slate-400 font-medium">
                {currentIndex + 1} of {cards.length}
              </span>
              <button
                onClick={handleNextCard}
                disabled={currentIndex === cards.length - 1}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}