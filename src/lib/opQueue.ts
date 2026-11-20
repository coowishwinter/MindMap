import { OpItem } from "../types.js";

export class OpQueueManager {
  private mapId: number;
  private queueKey: string;

  constructor(mapId: number) {
    this.mapId = mapId;
    this.queueKey = `mindmap_op_queue_${mapId}`;
  }

  getQueue(): OpItem[] {
    try {
      const data = localStorage.getItem(this.queueKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveQueue(queue: OpItem[]) {
    try {
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
    } catch (e) {}
  }

  enqueue(op: OpItem) {
    const queue = this.getQueue();
    queue.push(op);
    this.saveQueue(queue);
    return queue;
  }

  dequeueBatch(batchSize = 20): OpItem[] {
    const queue = this.getQueue();
    const batch = queue.slice(0, batchSize);
    return batch;
  }

  removeOps(clientOpIds: string[]) {
    const queue = this.getQueue();
    const filtered = queue.filter((item) => !clientOpIds.includes(item.clientOpId));
    this.saveQueue(filtered);
    return filtered;
  }

  clear() {
    localStorage.removeItem(this.queueKey);
  }
}
