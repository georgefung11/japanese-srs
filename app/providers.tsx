"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { createClient } from "@/utils/supabase/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    async function syncOfflineQueue() {
      if (!navigator.onLine) return;

      const pending = await db.pendingReviews.toArray();
      if (pending.length === 0) return;

      const supabase = createClient();

      for (const review of pending) {
        try {
          const { error } = await supabase.rpc("submit_review", {
            p_item_id: review.itemId,
            p_client_review_id: review.clientReviewId,
            p_rating: review.rating,
            p_reviewed_at: review.reviewedAt,
          });

          if (error) throw error;

          if (review.id) {
            await db.pendingReviews.delete(review.id);
          }
        } catch (err: any) {
          const retry = review.retryCount + 1;
          if (retry >= 3) {
            if (review.id) await db.pendingReviews.delete(review.id);
            await db.dlq.add({
              ...review,
              failedAt: new Date().toISOString(),
              errorMessage: err.message || "Unknown error",
            });
            await db.addDiagnostic({
              timestamp: new Date().toISOString(),
              level: "error",
              message: "Review moved to DLQ",
              details: { review, error: err.message },
            });
          } else {
            if (review.id) {
              await db.pendingReviews.update(review.id, { retryCount: retry });
            }
          }
        }
      }
    }

    window.addEventListener("online", syncOfflineQueue);
    syncOfflineQueue();

    return () => window.removeEventListener("online", syncOfflineQueue);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
