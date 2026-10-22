import type { Take } from './dataset';

/** Where takes are kept between sessions. The browser version is IndexedDB (localStorage is too small). */
export interface TakeStore {
  all(): Promise<Take[]>;
  add(t: Take): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryStore implements TakeStore {
  private items: Take[] = [];
  async all() {
    return [...this.items];
  }
  async add(t: Take) {
    this.items.push(t);
  }
  async remove(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
  }
  async clear() {
    this.items = [];
  }
}

const DB = 'signscribe-collect';
const TABLE = 'takes';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB is not available'));
  });
}

const wrap = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export class IdbStore implements TakeStore {
  private async table(mode: IDBTransactionMode) {
    const db = await open();
    return db.transaction(TABLE, mode).objectStore(TABLE);
  }
  async all() {
    const rows = await wrap((await this.table('readonly')).getAll() as IDBRequest<Take[]>);
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async add(t: Take) {
    await wrap((await this.table('readwrite')).put(t));
  }
  async remove(id: string) {
    await wrap((await this.table('readwrite')).delete(id));
  }
  async clear() {
    await wrap((await this.table('readwrite')).clear());
  }
}
