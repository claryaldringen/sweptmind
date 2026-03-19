import { get, set } from "idb-keyval";

const QUEUE_KEY = "sweptmind-mutation-queue";

export interface QueuedMutation {
  id: string;
  operationName: string;
  variables: Record<string, unknown>;
  documentStr: string;
  timestamp: number;
}

interface EnqueueInput {
  operationName: string;
  variables: Record<string, unknown>;
  documentStr: string;
}

export class MutationQueue {
  private async load(): Promise<QueuedMutation[]> {
    return (await get(QUEUE_KEY)) ?? [];
  }

  private async save(queue: QueuedMutation[]): Promise<void> {
    await set(QUEUE_KEY, queue);
  }

  async enqueue(input: EnqueueInput): Promise<QueuedMutation> {
    const queue = await this.load();
    const entry: QueuedMutation = {
      id: crypto.randomUUID(),
      ...input,
      timestamp: Date.now(),
    };
    queue.push(entry);
    await this.save(queue);
    return entry;
  }

  async remove(id: string): Promise<void> {
    const queue = await this.load();
    await this.save(queue.filter((m) => m.id !== id));
  }

  async getAll(): Promise<QueuedMutation[]> {
    return this.load();
  }

  async count(): Promise<number> {
    return (await this.load()).length;
  }

  async clear(): Promise<void> {
    await this.save([]);
  }
}
