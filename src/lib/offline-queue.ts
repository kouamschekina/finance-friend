/**
 * Offline operation queue — persists pending mutations to localStorage
 * so they survive page refreshes and sync when connectivity is restored.
 */

export type QueuedOpType =
  | 'addTransaction'
  | 'updateTransaction'
  | 'deleteTransaction'
  | 'addCategory'
  | 'updateCategory'
  | 'deleteCategory'
  | 'addGoal'
  | 'updateGoal'
  | 'deleteGoal'
  | 'updateProfile';

export interface QueuedOperation {
  id: string;
  type: QueuedOpType;
  payload: any;
  /** ISO timestamp when the op was queued */
  queuedAt: string;
  /** Temporary local ID used for optimistic updates (for insert ops) */
  tempId?: string;
}

const QUEUE_KEY = 'fenowa-offline-queue';

export function loadQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: QueuedOperation[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(op: Omit<QueuedOperation, 'id' | 'queuedAt'>): QueuedOperation {
  const queue = loadQueue();
  const entry: QueuedOperation = {
    ...op,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  saveQueue(queue);
  return entry;
}

export function dequeue(opId: string): void {
  const queue = loadQueue().filter(op => op.id !== opId);
  saveQueue(queue);
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function queueSize(): number {
  return loadQueue().length;
}
