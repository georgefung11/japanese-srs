export interface SRSInput {
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  rating: number; // 0 - 5
}

export interface SRSResult {
  interval: number;
  repetitionCount: number;
  easeFactor: number;
  nextReviewDate: Date;
}

export function calculateSM2(input: SRSInput): SRSResult {
  let { interval, repetitionCount, easeFactor, rating } = input;

  if (rating >= 3) {
    if (repetitionCount === 0) interval = 1;
    else if (repetitionCount === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitionCount += 1;
  } else {
    repetitionCount = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  if (easeFactor > 5.0) easeFactor = 5.0;

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { interval, repetitionCount, easeFactor, nextReviewDate };
}
