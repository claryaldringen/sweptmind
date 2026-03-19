# Offline-First Architecture Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make SweptMind fully offline-capable — all UI interactions instant, mutations queued and replayed on reconnect, cache persisted to IndexedDB.

**Architecture:** Apollo Client with IndexedDB-backed cache persistence, client-generated UUIDs, a mutation queue with automatic replay on reconnect (debounced), and optimistic cache updates everywhere.

**Conflict resolution:** Last-write-wins.

---

## Decisions

- **Cache storage:** IndexedDB via `idb-keyval` (replaces `apollo3-cache-persist` + `LocalStorageWrapper`)
- **Entity IDs:** `crypto.randomUUID()` generated on client, server accepts optional `id` in create inputs
- **Mutation queue:** IndexedDB-backed FIFO queue, replayed automatically on reconnect with 2s debounce
- **Sync:** After replay, refetch key queries to pull changes from other devices
- **Conflict resolution:** Last-write-wins (no conflict detection)
- **Optimistic updates:** All mutations update cache immediately, regardless of online state

## Components

### 1. Apollo Cache → IndexedDB

Replace `apollo3-cache-persist` with `LocalStorageWrapper` → `idb-keyval` storage adapter. Config stays in `src/lib/apollo/client.ts`. No 5 MB limit, non-blocking.

### 2. Client-Generated UUIDs

`crypto.randomUUID()` for tasks, lists, steps, locations, tags. Server `Create*Input` types accept optional `id` field. If provided, server uses it; if not, generates its own (backward compat). Eliminates `temp-{timestamp}` pattern in `task-input.tsx`.

### 3. Mutation Queue

New module `src/lib/apollo/mutation-queue.ts`:
- Serialized operations stored in IndexedDB: `{ id, operationName, mutation (DocumentNode serialized), variables, timestamp, status }`
- Online: mutation fires immediately + queued as "pending" → removed on success
- Offline: mutation queued only, optimistic cache update still happens
- Queue exposed as React context for UI (pending count)

### 4. Sync Manager

New module `src/lib/apollo/sync-manager.ts`:
- Listens to `online`/`offline` events
- On reconnect: 2s debounce, then FIFO replay of pending mutations
- After replay: refetch key queries (lists, tags, locations) to pull remote changes
- Exposes sync state (idle, syncing, error) for UI

### 5. Replace refetchQueries with Optimistic Cache Updates

All mutations currently using `refetchQueries` (locations, tags, some detail panel ops) must use direct cache writes instead. This eliminates server round-trips for UI updates.

### 6. Offline Indicator Upgrade

Extend `OfflineIndicator` to show:
- Pending mutation count from queue
- Sync state ("Synchronizuji..." with count)
