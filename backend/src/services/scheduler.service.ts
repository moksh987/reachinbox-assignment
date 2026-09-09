/**
 * Computes each recipient's send timestamp up front, spaced `delaySeconds`
 * apart starting at `startTime`. Doing this at scheduling time (rather than
 * having the worker sleep between sends) means the minimum-delay guarantee
 * doesn't depend on worker concurrency — Redis/BullMQ enforce it purely
 * through each job's own delay.
 */
export function computeScheduledTimes(startTime: Date, count: number, delaySeconds: number): Date[] {
  const times: Date[] = [];
  for (let i = 0; i < count; i++) {
    times.push(new Date(startTime.getTime() + i * delaySeconds * 1000));
  }
  return times;
}
