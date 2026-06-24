export type CurationQueueOptions = {
  extractionConcurrency?: 1 | 2 | number;
  draftConcurrency?: 1 | number;
};

type QueuedTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class CurationQueue {
  private readonly extractionRunner: BoundedRunner;
  private readonly draftRunner: BoundedRunner;

  constructor(options: CurationQueueOptions = {}) {
    this.extractionRunner = new BoundedRunner(clampConcurrency(options.extractionConcurrency ?? 2, 1, 2));
    this.draftRunner = new BoundedRunner(clampConcurrency(options.draftConcurrency ?? 1, 1, 1));
  }

  addExtraction<T>(task: () => Promise<T>) {
    return this.extractionRunner.add(task);
  }

  addDraft<T>(task: () => Promise<T>) {
    return this.draftRunner.add(task);
  }
}

class BoundedRunner {
  private active = 0;
  private readonly pending: Array<QueuedTask<unknown>> = [];

  constructor(private readonly concurrency: number) {}

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run: task,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) {
        return;
      }
      this.active += 1;
      void Promise.resolve()
        .then(task.run)
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

function clampConcurrency(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return maximum;
  }
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}
