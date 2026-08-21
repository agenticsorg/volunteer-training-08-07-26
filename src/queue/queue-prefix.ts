/**
 * BullMQ namespaces every queue's Redis keys under a "prefix" (default
 * `bull`). Left at a fixed value, every Nest process that boots QueueModule
 * against the same Redis instance shares the exact same queues — harmless in
 * production (one process), but under Jest, multiple test files run in
 * parallel as separate OS processes, and more than one of them boots
 * QueueModule (directly, or indirectly via AppModule in an E2E test). Without
 * per-process isolation those processes fight over the same jobs — a worker
 * in one test file's process can steal and process a job a *different* test
 * file's assertion is waiting on, which is exactly as flaky as it sounds.
 *
 * `QUEUE_PREFIX` lets a real deployment pin an explicit value if it ever
 * needs to (e.g. blue/green queue namespaces); test runs get a unique prefix
 * per process automatically so parallel Jest workers never collide.
 */
export function getQueuePrefix(): string {
  if (process.env.QUEUE_PREFIX) {
    return process.env.QUEUE_PREFIX;
  }
  if (process.env.NODE_ENV === 'test') {
    return `bull-test-${process.pid}`;
  }
  return 'bull';
}
