import type { ApolloClient } from "@apollo/client";
import { gql } from "@apollo/client";
import { MutationQueue } from "./mutation-queue";

export type SyncState = "idle" | "syncing" | "error";

type Listener = (state: SyncState, pendingCount: number) => void;

export class SyncManager {
  private queue = new MutationQueue();
  private client: ApolloClient | null = null;
  private state: SyncState = "idle";
  private listeners = new Set<Listener>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  attach(client: ApolloClient) {
    this.client = client;

    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      this.isOnline = true;
      this.scheduleReplay();
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
    });
  }

  get online() {
    return this.isOnline;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.queue.count().then((count) => {
      this.listeners.forEach((fn) => fn(this.state, count));
    });
  }

  private setState(s: SyncState) {
    this.state = s;
    this.notify();
  }

  async enqueue(
    operationName: string,
    documentStr: string,
    variables: Record<string, unknown>,
  ): Promise<void> {
    await this.queue.enqueue({ operationName, variables, documentStr });
    this.notify();

    if (this.isOnline) {
      this.scheduleReplay();
    }
  }

  private scheduleReplay() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.replay(), 2000);
  }

  private async replay() {
    if (!this.client || this.state === "syncing") return;

    const pending = await this.queue.getAll();
    if (pending.length === 0) return;

    this.setState("syncing");

    for (const mutation of pending) {
      try {
        await this.client.mutate({
          mutation: gql(mutation.documentStr),
          variables: mutation.variables,
        });
        await this.queue.remove(mutation.id);
        this.notify();
      } catch (err) {
        console.error(`[SyncManager] Failed to replay ${mutation.operationName}:`, err);
        this.setState("error");
        return;
      }
    }

    // After successful replay, refetch active queries to pull remote changes
    try {
      await this.client.refetchQueries({ include: "active" });
    } catch {
      // Non-critical
    }

    this.setState("idle");
  }

  async getPendingCount(): Promise<number> {
    return this.queue.count();
  }
}

// Singleton
export const syncManager = new SyncManager();
