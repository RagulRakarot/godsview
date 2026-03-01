/**
 * WindowsMenu — topbar dropdown to show/hide/pin dashboard panels.
 *
 * Mounted against the "Windows" button in the header.
 * Reads panel list from DEFAULT_PANELS grouped by PANEL_CATEGORY_MAP.
 */

import { windowsManager } from '@/services/windows-manager';
import { PANEL_CATEGORY_MAP, SITE_VARIANT } from '@/config';

// Human-readable fallback category labels (for when i18n key isn't mapped here)
const CATEGORY_LABEL_FALLBACKS: Record<string, string> = {
    core: 'Core',
    intelligence: 'Intelligence',
    regionalNews: 'Regional News',
    marketsFinance: 'Markets & Finance',
    topical: 'Topical',
    dataTracking: 'Data Tracking',
    techAi: 'Tech & AI',
    startupsVc: 'Startups & VC',
    securityPolicy: 'Security & Policy',
    techMarkets: 'Markets',
    finMarkets: 'Markets',
    fixedIncomeFx: 'Fixed Income & FX',
    finCommodities: 'Commodities',
    cryptoDigital: 'Crypto & Digital',
    centralBanksEcon: 'Central Banks & Economy',
    dealsInstitutional: 'Deals & Institutional',
    gulfMena: 'Gulf & MENA',
};

export class WindowsMenu {
    private anchorBtn: HTMLElement;
    private dropdown: HTMLElement | null = null;
    private isOpen = false;
    private unsubscribe: (() => void) | null = null;
    private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

    constructor(anchorBtn: HTMLElement) {
        this.anchorBtn = anchorBtn;
        this.anchorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });


        // React to any external state changes (e.g., 3-dot hide button)
        this.unsubscribe = windowsManager.onChange((panelId, state) => {
            if (!this.dropdown) return;
            this.syncRow(panelId, state);
        });
    }

    // ── Open / Close ──────────────────────────────────────────────────────────
    open(): void {
        if (this.isOpen) return;
        this.isOpen = true;
        this.anchorBtn.classList.add('active');
        this.dropdown = this.buildDropdown();
        document.body.appendChild(this.dropdown);
        this.positionDropdown();

        // Close on outside click
        this.outsideClickHandler = (e: MouseEvent) => {
            if (
                this.dropdown &&
                !this.dropdown.contains(e.target as Node) &&
                !this.anchorBtn.contains(e.target as Node)
            ) {
                this.close();
            }
        };
        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler!);
        }, 0);
    }

    close(): void {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.anchorBtn.classList.remove('active');
        if (this.dropdown) {
            this.dropdown.classList.add('windows-dropdown-closing');
            setTimeout(() => {
                this.dropdown?.remove();
                this.dropdown = null;
            }, 150);
        }
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
            this.outsideClickHandler = null;
        }
    }

    toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    destroy(): void {
        this.close();
        this.unsubscribe?.();
        this.unsubscribe = null;
    }

    // ── Build dropdown DOM ────────────────────────────────────────────────────
    private buildDropdown(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'windows-dropdown';
        el.id = 'windowsDropdown';

        // Header row
        const header = document.createElement('div');
        header.className = 'windows-dropdown-header';
        header.innerHTML = `
      <div class="windows-dropdown-title-row">
        <span class="windows-dropdown-title">⬜ Windows</span>
        <div class="windows-save-view-container">
          <input type="text" id="windowsProfileName" placeholder="New View..." class="windows-profile-input">
          <button class="windows-save-profile-btn" id="windowsSaveProfile" title="Save current view as preset">➕</button>
        </div>
      </div>
      <div class="windows-dropdown-actions">
        <button class="windows-restore-btn" id="windowsRestoreAll">Restore All</button>
      </div>
    `;
        el.appendChild(header);

        // Profiles container
        const profilesContainer = document.createElement('div');
        profilesContainer.id = 'windowsProfilesContainer';
        el.appendChild(profilesContainer);
        this.renderProfilesSection(profilesContainer);

        // Divider
        const divider = document.createElement('div');
        divider.className = 'windows-dropdown-divider';
        el.appendChild(divider);

        // Panel list (grouped by category)
        const panelList = document.createElement('div');
        panelList.className = 'windows-panel-list';

        const seenPanels = new Set<string>();

        const panelCatMap = PANEL_CATEGORY_MAP as Record<string, { labelKey: string; panelKeys: string[]; variants?: string[] }>;

        const defs = windowsManager.getDefinitions();

        for (const [catKey, catCfg] of Object.entries(panelCatMap)) {
            // Skip categories not relevant to this variant
            if (catCfg.variants && !catCfg.variants.includes(SITE_VARIANT)) continue;

            const panelIds = catCfg.panelKeys.filter(
                (id) => id in defs && !seenPanels.has(id)
            );
            if (panelIds.length === 0) continue;

            // Category label
            const catLabel = document.createElement('div');
            catLabel.className = 'windows-category-label';
            catLabel.textContent = CATEGORY_LABEL_FALLBACKS[catKey] ?? catKey;
            panelList.appendChild(catLabel);

            for (const panelId of panelIds) {
                seenPanels.add(panelId);
                const def = defs[panelId];
                if (!def) continue;
                const state = windowsManager.getState(panelId);

                const row = this.buildRow(panelId, def.label, state.visible, state.pinned, def.hideable);
                panelList.appendChild(row);
            }
        }

        // Any panels not in category map (safety net)
        for (const [panelId, def] of Object.entries(defs)) {
            if (seenPanels.has(panelId)) continue;
            const state = windowsManager.getState(panelId);
            const row = this.buildRow(panelId, def.label, state.visible, state.pinned, def.hideable);
            panelList.appendChild(row);
        }

        el.appendChild(panelList);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'windows-dropdown-footer';
        const hiddenCount = Object.values(windowsManager.getAllState()).filter((s) => !s.visible).length;
        footer.innerHTML = `<span class="windows-hidden-count">${hiddenCount} module${hiddenCount !== 1 ? 's' : ''} hidden</span>`;
        el.appendChild(footer);

        // Event: Restore All
        el.querySelector('#windowsRestoreAll')?.addEventListener('click', () => {
            windowsManager.resetAll();
            this.rebuildRows();
            this.updateFooter();
        });

        // Event: Save Profile
        el.querySelector('#windowsSaveProfile')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const input = el.querySelector('#windowsProfileName') as HTMLInputElement;
            const name = input?.value?.trim();
            if (name) {
                windowsManager.saveProfile(name);
                input.value = ''; // clear
                const container = el.querySelector('#windowsProfilesContainer') as HTMLElement;
                if (container) this.renderProfilesSection(container);
            } else {
                input?.focus();
            }
        });

        // Event: Press Enter in input
        el.querySelector('#windowsProfileName')?.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') {
                (el.querySelector('#windowsSaveProfile') as HTMLElement)?.click();
            }
        });

        return el;
    }

    // ── Build a single row ─────────────────────────────────────────────────────
    private buildRow(
        panelId: string,
        name: string,
        visible: boolean,
        pinned: boolean,
        hideable: boolean
    ): HTMLElement {
        const row = document.createElement('div');
        row.className = `windows-row${pinned ? ' windows-row-pinned' : ''}`;
        row.dataset.panelId = panelId;

        const checkboxId = `wm-win-cb-${panelId}`;

        row.innerHTML = `
      <label class="windows-row-label" for="${checkboxId}" ${!hideable ? 'title="Core module cannot be hidden" style="cursor: not-allowed; opacity: 0.7;"' : ''}>
        <input
          type="checkbox"
          id="${checkboxId}"
          class="windows-row-checkbox"
          data-panel="${panelId}"
          ${visible ? 'checked' : ''}
          ${!hideable ? 'disabled' : ''}
        >
        <span class="windows-row-checkmark"></span>
        <span class="windows-row-name">${name}</span>
      </label>
      <button
        class="windows-pin-btn${pinned ? ' pinned' : ''}"
        data-panel="${panelId}"
        title="${pinned ? 'Unpin window' : 'Pin to top'}"
        aria-label="${pinned ? 'Unpin' : 'Pin'}"
      >${pinned ? '📌' : '📍'}</button>
    `;

        // Checkbox → toggle visibility
        row.querySelector('input[type=checkbox]')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            windowsManager.setVisible(panelId, checked);
            this.updateFooter();
        });

        // Pin button → toggle pin
        row.querySelector('.windows-pin-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const newPinned = !windowsManager.getState(panelId).pinned;
            windowsManager.setPinned(panelId, newPinned);
            this.syncRow(panelId, windowsManager.getState(panelId));
        });

        return row;
    }

    private renderProfilesSection(container: HTMLElement): void {
        container.innerHTML = '';
        const profiles = windowsManager.getProfiles();
        const profileNames = Object.keys(profiles);

        if (profileNames.length === 0) return;

        const profilesSection = document.createElement('div');
        profilesSection.className = 'windows-profiles-section';

        const profilesLabel = document.createElement('div');
        profilesLabel.className = 'windows-category-label';
        profilesLabel.textContent = 'Custom Views';
        profilesSection.appendChild(profilesLabel);

        const profilesList = document.createElement('div');
        profilesList.className = 'windows-profiles-list';

        for (const name of profileNames) {
            const pill = document.createElement('div');
            pill.className = 'windows-profile-pill';

            const btn = document.createElement('button');
            btn.className = 'windows-profile-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                windowsManager.loadProfile(name);
                this.rebuildRows();
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'windows-profile-del-btn';
            delBtn.innerHTML = '×';
            delBtn.title = 'Delete view';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                windowsManager.deleteProfile(name);
                this.renderProfilesSection(container);
            });

            pill.appendChild(btn);
            pill.appendChild(delBtn);
            profilesList.appendChild(pill);
        }

        profilesSection.appendChild(profilesList);
        container.appendChild(profilesSection);
    }

    // ── Sync a single row DOM after external state change ─────────────────────
    private syncRow(panelId: string, state: { visible: boolean; pinned: boolean }): void {
        if (!this.dropdown) return;
        const row = this.dropdown.querySelector<HTMLElement>(`.windows-row[data-panel-id="${panelId}"]`);
        if (!row) return;

        const cb = row.querySelector<HTMLInputElement>('input[type=checkbox]');
        if (cb && !cb.disabled) {
            cb.checked = state.visible;
        }

        const pinBtn = row.querySelector<HTMLElement>('.windows-pin-btn');
        if (pinBtn) {
            pinBtn.classList.toggle('pinned', state.pinned);
            pinBtn.title = state.pinned ? 'Unpin window' : 'Pin to top';
            pinBtn.textContent = state.pinned ? '📌' : '📍';
        }

        row.classList.toggle('windows-row-pinned', state.pinned);
        this.updateFooter();
    }

    private rebuildRows(): void {
        if (!this.dropdown) return;
        const list = this.dropdown.querySelector('.windows-panel-list');
        if (!list) return;
        // Re-sync every row
        const allRows = list.querySelectorAll<HTMLElement>('.windows-row');
        allRows.forEach((row) => {
            const panelId = row.dataset.panelId;
            if (!panelId) return;
            const state = windowsManager.getState(panelId);
            this.syncRow(panelId, state);
        });
    }

    private updateFooter(): void {
        if (!this.dropdown) return;
        const footer = this.dropdown.querySelector('.windows-hidden-count');
        if (!footer) return;
        const hiddenCount = Object.values(windowsManager.getAllState()).filter((s) => !s.visible).length;
        footer.textContent = `${hiddenCount} module${hiddenCount !== 1 ? 's' : ''} hidden`;
    }

    // ── Position dropdown below anchor button ─────────────────────────────────
    private positionDropdown(): void {
        if (!this.dropdown) return;
        const rect = this.anchorBtn.getBoundingClientRect();
        this.dropdown.style.top = `${rect.bottom + 6}px`;
        this.dropdown.style.left = `${Math.max(8, rect.left)}px`;
    }
}
