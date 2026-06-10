// Filter slot start times down to the largest non-overlapping set of the given
// duration -- i.e. the most appointments that can fit in a day. Greedy by
// earliest end time, which is optimal for fixed-duration intervals.
export function maximizeNonOverlappingSlots(
  dates: Date[],
  durationMinutes: number,
): Date[] {
  const durationMs = durationMinutes * 60 * 1000;

  // With a fixed duration, earliest start also means earliest end -- the greedy
  // interval-scheduling order.
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  const kept: Date[] = [];
  let lastEnd = -Infinity; // end (epoch ms) of the most recently kept slot

  for (const date of sorted) {
    const start = date.getTime();
    // Keep a slot only if it starts at/after the previous kept slot ends, so it
    // doesn't overlap. Keeping earliest-ending slots leaves the most room for
    // later ones, maximizing the count.
    if (start >= lastEnd) {
      kept.push(date);
      lastEnd = start + durationMs;
    }
  }

  return kept;
}
