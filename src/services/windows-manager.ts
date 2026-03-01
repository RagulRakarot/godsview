/**
 * WindowsManager — centralized module visibility & pin state.
 *
 * State shape (persisted to localStorage):
 *   { [panelId]: { visible: boolean, pinned: boolean } }
 */

export interface WindowState {
    visible: boolean;
    pinned: boolean;
}

export interface WindowDefinition {
    id: string;
    label: string;
    hideable: boolean;
}

type WindowsStateMap = Record<string, WindowState>;
type ChangeCallback = (panelId: string, state: WindowState) => void;

const STORAGE_KEY = 'godsview-windows-state';
const PROFILES_STORAGE_KEY = 'godsview-windows-profiles-state';

class WindowsManager {
    private definitions: Record<string, WindowDefinition> = {};
    private state: WindowsStateMap = {};
    private profiles: Record<string, string[]> = {};
    private subscribers: ChangeCallback[] = [];

    constructor() {
        this.loadFromStorage();
        this.loadProfilesFromStorage();
    }

    // ── Register panels to build a unified source of truth ────────────────────
    registerPanel(def: WindowDefinition, defaultVisible: boolean): void {
        this.definitions[def.id] = def;
        if (!(def.id in this.state)) {
            this.state[def.id] = { visible: defaultVisible, pinned: false };
            this.saveToStorage();
        }
    }

    getDefinition(panelId: string): WindowDefinition | undefined {
        return this.definitions[panelId];
    }

    getDefinitions(): Record<string, WindowDefinition> {
        return this.definitions;
    }

    // ── Getters ───────────────────────────────────────────────────────────────
    getState(panelId: string): WindowState {
        return this.state[panelId] ?? { visible: true, pinned: false };
    }

    getAllState(): WindowsStateMap {
        return { ...this.state };
    }

    getPinnedIds(): string[] {
        return Object.entries(this.state)
            .filter(([, s]) => s.pinned)
            .map(([id]) => id);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────
    setVisible(panelId: string, visible: boolean): void {
        const current = this.getState(panelId);
        this.state[panelId] = { ...current, visible };
        this.saveToStorage();
        this.notify(panelId, this.state[panelId]!);
    }

    setPinned(panelId: string, pinned: boolean): void {
        const current = this.getState(panelId);
        this.state[panelId] = { ...current, pinned };
        this.saveToStorage();
        this.notify(panelId, this.state[panelId]!);
    }

    resetAll(): void {
        for (const id of Object.keys(this.state)) {
            this.state[id] = { visible: true, pinned: false };
        }
        this.saveToStorage();
        for (const [id, s] of Object.entries(this.state)) {
            this.notify(id, s);
        }
    }

    // ── Profiles ──────────────────────────────────────────────────────────────
    getProfiles(): Record<string, string[]> {
        return { ...this.profiles };
    }

    saveProfile(name: string): void {
        // Find all currently visible panel IDs
        const visibleIds = Object.entries(this.state)
            .filter(([, s]) => s.visible)
            .map(([id]) => id);

        this.profiles[name] = visibleIds;
        this.saveProfilesToStorage();
    }

    deleteProfile(name: string): void {
        delete this.profiles[name];
        this.saveProfilesToStorage();
    }

    loadProfile(name: string): void {
        const profileIds = this.profiles[name];
        if (!profileIds) return;

        // Iterate over all definitions, setting visible=true if in profileIds, false otherwise.
        // Respect hideable: false (they cannot be hidden)
        for (const [id, def] of Object.entries(this.definitions)) {
            const shouldBeVisible = profileIds.includes(id) || !def.hideable;
            const current = this.getState(id);
            if (current.visible !== shouldBeVisible) {
                this.state[id] = { ...current, visible: shouldBeVisible };
                this.notify(id, this.state[id]!);
            }
        }
        this.saveToStorage();
    }

    // ── Subscriptions ─────────────────────────────────────────────────────────
    onChange(cb: ChangeCallback): () => void {
        this.subscribers.push(cb);
        return () => {
            this.subscribers = this.subscribers.filter((s) => s !== cb);
        };
    }

    // ── Private ───────────────────────────────────────────────────────────────
    private notify(panelId: string, state: WindowState): void {
        for (const cb of this.subscribers) {
            cb(panelId, state);
        }
    }

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.state = JSON.parse(raw) as WindowsStateMap;
            }
        } catch {
            this.state = {};
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch {
            // quota exceeded — continue without persistence
        }
    }

    private loadProfilesFromStorage(): void {
        try {
            const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
            if (raw) {
                this.profiles = JSON.parse(raw) as Record<string, string[]>;
            }
        } catch {
            this.profiles = {};
        }
    }

    private saveProfilesToStorage(): void {
        try {
            localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(this.profiles));
        } catch {
            // ignore
        }
    }
}

// Singleton export
export const windowsManager = new WindowsManager();
