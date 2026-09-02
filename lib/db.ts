import Dexie, { Table } from "dexie";

export interface LocalItem {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  type: "vocabulary" | "grammar";
  example_sentence?: string;
  jlpt_level?: string;
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  nextReviewDate: string;
  isCustom?: boolean;
}

export interface PendingReview {
  id?: number;
  clientReviewId: string;
  itemId: string;
  rating: number;
  reviewedAt: string;
  retryCount: number;
}

export interface DLQItem extends PendingReview {
  failedAt: string;
  errorMessage: string;
}

export interface DiagnosticLog {
  id?: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export class JapaneseSRSDatabase extends Dexie {
  items!: Table<LocalItem, string>;
  pendingReviews!: Table<PendingReview, number>;
  dlq!: Table<DLQItem, number>;
  diagnosticsLog!: Table<DiagnosticLog, number>;

  constructor() {
    super("JapaneseSRS_DB");
    this.version(1).stores({
      items: "id, nextReviewDate, type, jlpt_level",
      pendingReviews: "++id, clientReviewId, itemId",
      dlq: "++id, clientReviewId, itemId",
      diagnosticsLog: "++id, timestamp, level",
    });
  }

  async addDiagnostic(log: Omit<DiagnosticLog, "id">) {
    await this.diagnosticsLog.add(log);
    const count = await this.diagnosticsLog.count();
    if (count > 500) {
      const oldest = await this.diagnosticsLog.orderBy("id").first();
      if (oldest?.id) {
        await this.diagnosticsLog.delete(oldest.id);
      }
    }
  }
}

export const db = new JapaneseSRSDatabase();
