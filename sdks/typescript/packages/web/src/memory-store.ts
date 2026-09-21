import type { PendingLogin, WebAuthStore, WebSession } from "./index.js";

/** For local development and tests. Use a shared store in production. */
export class MemoryWebAuthStore implements WebAuthStore {
    private readonly pending = new Map<string, { value: PendingLogin; expiresAt: number }>();
    private readonly sessions = new Map<string, { value: WebSession; expiresAt: number }>();
    private readonly locks = new Map<string, Promise<void>>();

    public async putPending(key: string, value: PendingLogin, ttlSeconds: number): Promise<void> {
        this.pending.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    public async takePending(key: string, exposureKey: string): Promise<PendingLogin | undefined> {
        const found = this.pending.get(key);
        if (!found || found.expiresAt <= Date.now() || found.value.exposureKey !== exposureKey) return undefined;
        this.pending.delete(key);
        return found.value;
    }

    public async putSession(key: string, value: WebSession, ttlSeconds: number): Promise<void> {
        this.sessions.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    public async withSession<T>(key: string, update: (session: WebSession | undefined) => Promise<{ value: WebSession | undefined; result: T }>): Promise<T> {
        const previous = this.locks.get(key) ?? Promise.resolve();
        let release!: () => void;
        const next = new Promise<void>((resolve) => { release = resolve; });
        this.locks.set(key, next);
        await previous;
        try {
            const found = this.sessions.get(key);
            const current = found && found.expiresAt > Date.now() ? found.value : undefined;
            const { value, result } = await update(current);
            if (value && found) this.sessions.set(key, { value, expiresAt: found.expiresAt });
            else this.sessions.delete(key);
            return result;
        } finally {
            release();
            if (this.locks.get(key) === next) this.locks.delete(key);
        }
    }
}
