// quality: 0 = forgot, 1 = hard, 2 = good, 3 = easy
// Simplified SM-2. easeFactor never drops below 1.3, which keeps struggling cards
// coming back often but not so often they become annoying.
export function scheduleNext({ easeFactor, intervalDays, repetitions }, quality) {
  if (quality === 0) {
    // Forgotten: restart the learning steps, but keep the ease factor mostly intact
    return {
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      intervalDays: 0, // due again today
      repetitions: 0,
    };
  }

  const nextEase = Math.max(
    1.3,
    easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
  );

  let nextInterval;
  if (repetitions === 0) nextInterval = 1;
  else if (repetitions === 1) nextInterval = 6;
  else nextInterval = Math.round(intervalDays * nextEase);

  if (quality === 1) nextInterval = Math.max(1, Math.round(nextInterval * 0.5)); // hard: shorten it

  return {
    easeFactor: Number(nextEase.toFixed(2)),
    intervalDays: nextInterval,
    repetitions: repetitions + 1,
  };
}