import { isDesktopRuntime } from '../services/runtime';
import { invokeTauri } from '../services/tauri-bridge';
import { t } from '../services/i18n';
import { h, replaceChildren, safeHtml } from '../utils/dom-utils';
import { trackPanelResized } from '@/services/analytics';
import { windowsManager } from '@/services/windows-manager';

export interface PanelOptions {
  id: string;
  title: string;
  showCount?: boolean;
  className?: string;
  trackActivity?: boolean;
  infoTooltip?: string;
}

const PANEL_SPANS_KEY = 'worldmonitor-panel-spans';

function loadPanelSpans(): Record<string, number> {
  try {
    const stored = localStorage.getItem(PANEL_SPANS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePanelSpan(panelId: string, span: number): void {
  const spans = loadPanelSpans();
  spans[panelId] = span;
  localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(spans));
}

function heightToSpan(height: number): number {
  // Much lower thresholds for responsive resizing
  // Start at 200px, so:
  // - 50px drag → span 2 (250px)
  // - 150px drag → span 3 (350px)
  // - 300px drag → span 4 (500px)
  if (height >= 500) return 4;
  if (height >= 350) return 3;
  if (height >= 250) return 2;
  return 1;
}

function setSpanClass(element: HTMLElement, span: number): void {
  element.classList.remove('span-1', 'span-2', 'span-3', 'span-4');
  element.classList.add(`span-${span}`);
  element.classList.add('resized');
}

export class Panel {
  public title: string;
  protected element: HTMLElement;
  protected content: HTMLElement;
  protected header: HTMLElement;
  protected countEl: HTMLElement | null = null;
  protected statusBadgeEl: HTMLElement | null = null;
  protected newBadgeEl: HTMLElement | null = null;
  protected panelId: string;
  private abortController: AbortController = new AbortController();
  private tooltipCloseHandler: (() => void) | null = null;
  private resizeHandle: HTMLElement | null = null;
  private isResizing = false;
  private startY = 0;
  private startHeight = 0;
  private onTouchMove: ((e: TouchEvent) => void) | null = null;
  private onTouchEnd: (() => void) | null = null;
  private onDocMouseUp: (() => void) | null = null;
  private readonly contentDebounceMs = 150;
  private pendingContentHtml: string | null = null;
  private contentDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // 3-dot context menu & pin
  private threeDotBtn: HTMLElement | null = null;
  private contextMenu: HTMLElement | null = null;
  private contextMenuCloseHandler: ((e: MouseEvent) => void) | null = null;
  private pinnedBadge: HTMLElement | null = null;
  private unsubWindowsManager: (() => void) | null = null;

  constructor(options: PanelOptions) {
    this.panelId = options.id;
    this.title = options.title;
    this.element = document.createElement('div');
    this.element.className = `panel ${options.className || ''}`;
    this.element.dataset.panel = options.id;

    this.header = document.createElement('div');
    this.header.className = 'panel-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'panel-header-left';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = options.title;
    headerLeft.appendChild(title);

    if (options.infoTooltip) {
      const infoBtn = h('button', { className: 'panel-info-btn', 'aria-label': t('components.panel.showMethodologyInfo') }, '?');

      const tooltip = h('div', { className: 'panel-info-tooltip' });
      tooltip.appendChild(safeHtml(options.infoTooltip));

      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tooltip.classList.toggle('visible');
      });

      this.tooltipCloseHandler = () => tooltip.classList.remove('visible');
      document.addEventListener('click', this.tooltipCloseHandler);

      const infoWrapper = document.createElement('div');
      infoWrapper.className = 'panel-info-wrapper';
      infoWrapper.appendChild(infoBtn);
      infoWrapper.appendChild(tooltip);
      headerLeft.appendChild(infoWrapper);
    }

    // Add "new" badge element (hidden by default)
    if (options.trackActivity !== false) {
      this.newBadgeEl = document.createElement('span');
      this.newBadgeEl.className = 'panel-new-badge';
      this.newBadgeEl.style.display = 'none';
      headerLeft.appendChild(this.newBadgeEl);
    }

    this.header.appendChild(headerLeft);

    this.statusBadgeEl = document.createElement('span');
    this.statusBadgeEl.className = 'panel-data-badge';
    this.statusBadgeEl.style.display = 'none';
    this.header.appendChild(this.statusBadgeEl);

    if (options.showCount) {
      this.countEl = document.createElement('span');
      this.countEl.className = 'panel-count';
      this.countEl.textContent = '0';
      this.header.appendChild(this.countEl);
    }

    this.content = document.createElement('div');
    this.content.className = 'panel-content';
    this.content.id = `${options.id}Content`;

    this.element.appendChild(this.header);
    this.element.appendChild(this.content);

    // Pin badge
    this.pinnedBadge = document.createElement('span');
    this.pinnedBadge.className = 'panel-pinned-badge';
    this.pinnedBadge.title = 'Pinned to top';
    this.pinnedBadge.style.display = 'none';
    headerLeft.appendChild(this.pinnedBadge);

    // 3-dot context menu button
    this.threeDotBtn = document.createElement('button');
    this.threeDotBtn.className = 'panel-three-dot-btn';
    this.threeDotBtn.title = 'Panel options';
    this.threeDotBtn.setAttribute('aria-label', 'Panel options');
    this.threeDotBtn.innerHTML = '⋮';
    this.header.appendChild(this.threeDotBtn);
    this.threeDotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openContextMenu();
    });

    // Add resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'panel-resize-handle';
    this.resizeHandle.title = t('components.panel.dragToResize');
    this.element.appendChild(this.resizeHandle);
    this.setupResizeHandlers();

    // Restore saved span
    const savedSpans = loadPanelSpans();
    const savedSpan = savedSpans[this.panelId];
    if (savedSpan && savedSpan > 1) {
      setSpanClass(this.element, savedSpan);
    }

    // Sync pin badge from persisted state
    const storedState = windowsManager.getState(this.panelId);
    if (storedState.pinned) {
      this.setPinnedBadge(true);
    }

    // Subscribe to future windowsManager changes for this panel
    this.unsubWindowsManager = windowsManager.onChange((changedId, state) => {
      if (changedId !== this.panelId) return;
      this.setPinnedBadge(state.pinned);
    });

    this.showLoading();
  }

  private setupResizeHandlers(): void {
    if (!this.resizeHandle) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.startY = e.clientY;
      this.startHeight = this.element.getBoundingClientRect().height;
      this.element.classList.add('resizing');
      this.resizeHandle?.classList.add('active');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      const deltaY = e.clientY - this.startY;
      const newHeight = Math.max(200, this.startHeight + deltaY);
      const span = heightToSpan(newHeight);
      setSpanClass(this.element, span);
    };

    const onMouseUp = () => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.element.classList.remove('resizing');
      this.resizeHandle?.classList.remove('active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const currentSpan = this.element.classList.contains('span-4') ? 4 :
        this.element.classList.contains('span-3') ? 3 :
          this.element.classList.contains('span-2') ? 2 : 1;
      savePanelSpan(this.panelId, currentSpan);
      trackPanelResized(this.panelId, currentSpan);
    };

    this.resizeHandle.addEventListener('mousedown', onMouseDown);

    // Mark element as resizing for external listeners
    this.resizeHandle.addEventListener('mousedown', () => {
      this.element.dataset.resizing = 'true';
    });

    // Double-click to reset
    this.resizeHandle.addEventListener('dblclick', () => {
      this.resetHeight();
    });

    // Touch support
    this.resizeHandle.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      if (!touch) return;
      this.isResizing = true;
      this.startY = touch.clientY;
      this.startHeight = this.element.getBoundingClientRect().height;
      this.element.classList.add('resizing');
      this.element.dataset.resizing = 'true';
      this.resizeHandle?.classList.add('active');
    }, { passive: false });

    // Use bound handlers so they can be removed in destroy()
    this.onTouchMove = (e: TouchEvent) => {
      if (!this.isResizing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touch.clientY - this.startY;
      const newHeight = Math.max(200, this.startHeight + deltaY);
      const span = heightToSpan(newHeight);
      setSpanClass(this.element, span);
    };

    this.onTouchEnd = () => {
      if (!this.isResizing) return;
      this.isResizing = false;
      this.element.classList.remove('resizing');
      delete this.element.dataset.resizing;
      this.resizeHandle?.classList.remove('active');
      const currentSpan = this.element.classList.contains('span-4') ? 4 :
        this.element.classList.contains('span-3') ? 3 :
          this.element.classList.contains('span-2') ? 2 : 1;
      savePanelSpan(this.panelId, currentSpan);
      trackPanelResized(this.panelId, currentSpan);
    };

    this.onDocMouseUp = () => {
      if (this.element.dataset.resizing) {
        delete this.element.dataset.resizing;
      }
    };

    document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('mouseup', this.onDocMouseUp);
  }


  protected setDataBadge(state: 'live' | 'cached' | 'unavailable', detail?: string): void {
    if (!this.statusBadgeEl) return;
    const labels = {
      live: t('common.live'),
      cached: t('common.cached'),
      unavailable: t('common.unavailable'),
    } as const;
    this.statusBadgeEl.textContent = detail ? `${labels[state]} · ${detail}` : labels[state];
    this.statusBadgeEl.className = `panel-data-badge ${state}`;
    this.statusBadgeEl.style.display = 'inline-flex';
  }

  protected clearDataBadge(): void {
    if (!this.statusBadgeEl) return;
    this.statusBadgeEl.style.display = 'none';
  }
  public getElement(): HTMLElement {
    return this.element;
  }

  public showLoading(message = t('common.loading')): void {
    replaceChildren(this.content,
      h('div', { className: 'panel-loading' },
        h('div', { className: 'panel-loading-radar' },
          h('div', { className: 'panel-radar-sweep' }),
          h('div', { className: 'panel-radar-dot' }),
        ),
        h('div', { className: 'panel-loading-text' }, message),
      ),
    );
  }

  public showError(message = t('common.failedToLoad')): void {
    replaceChildren(this.content, h('div', { className: 'error-message' }, message));
  }

  public showRetrying(message = t('common.retrying')): void {
    replaceChildren(this.content,
      h('div', { className: 'panel-loading' },
        h('div', { className: 'panel-loading-radar' },
          h('div', { className: 'panel-radar-sweep' }),
          h('div', { className: 'panel-radar-dot' }),
        ),
        h('div', { className: 'panel-loading-text retrying' }, message),
      ),
    );
  }

  public showConfigError(message: string): void {
    const msgEl = h('div', { className: 'config-error-message' }, message);
    if (isDesktopRuntime()) {
      msgEl.appendChild(
        h('button', {
          type: 'button',
          className: 'config-error-settings-btn',
          onClick: () => void invokeTauri<void>('open_settings_window_command').catch(() => { }),
        }, t('components.panel.openSettings')),
      );
    }
    replaceChildren(this.content, msgEl);
  }

  public setCount(count: number): void {
    if (this.countEl) {
      this.countEl.textContent = count.toString();
    }
  }

  public setErrorState(hasError: boolean, tooltip?: string): void {
    this.header.classList.toggle('panel-header-error', hasError);
    if (tooltip) {
      this.header.title = tooltip;
    } else {
      this.header.removeAttribute('title');
    }
  }

  public setContent(html: string): void {
    if (this.pendingContentHtml === html || this.content.innerHTML === html) {
      return;
    }

    this.pendingContentHtml = html;
    if (this.contentDebounceTimer) {
      clearTimeout(this.contentDebounceTimer);
    }

    this.contentDebounceTimer = setTimeout(() => {
      if (this.pendingContentHtml !== null) {
        this.setContentImmediate(this.pendingContentHtml);
      }
    }, this.contentDebounceMs);
  }

  private setContentImmediate(html: string): void {
    if (this.contentDebounceTimer) {
      clearTimeout(this.contentDebounceTimer);
      this.contentDebounceTimer = null;
    }

    this.pendingContentHtml = null;
    if (this.content.innerHTML !== html) {
      this.content.innerHTML = html;
    }
  }

  public show(): void {
    this.element.classList.remove('hidden');
  }

  public hide(): void {
    this.element.classList.add('hidden');
  }

  public toggle(visible: boolean): void {
    if (visible) this.show();
    else this.hide();
  }

  /** Animate the panel out then hide it (called by windowsManager reactions) */
  public animateHide(): void {
    this.element.classList.add('panel-is-hiding');
    const onEnd = () => {
      this.element.classList.remove('panel-is-hiding');
      this.element.classList.add('hidden');
      this.element.removeEventListener('animationend', onEnd);
    };
    this.element.addEventListener('animationend', onEnd);
  }

  /** Animate the panel in after it becomes visible */
  public animateShow(): void {
    this.element.classList.remove('hidden');
    this.element.classList.add('panel-is-showing');
    const onEnd = () => {
      this.element.classList.remove('panel-is-showing');
      this.element.removeEventListener('animationend', onEnd);
    };
    this.element.addEventListener('animationend', onEnd);
  }

  /** Show or hide the 📌 pin badge in the panel header */
  public setPinnedBadge(pinned: boolean): void {
    if (!this.pinnedBadge) return;
    if (pinned) {
      this.pinnedBadge.style.display = 'inline-flex';
      this.pinnedBadge.textContent = '📌';
      this.element.dataset.pinned = 'true';
    } else {
      this.pinnedBadge.style.display = 'none';
      delete this.element.dataset.pinned;
    }
  }

  // ── 3-dot context menu ────────────────────────────────────────────────────
  private openContextMenu(): void {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'panel-context-menu';

    const state = windowsManager.getState(this.panelId);
    const def = windowsManager.getDefinition(this.panelId);

    // Pin / Unpin
    const pinItem = document.createElement('button');
    pinItem.className = 'panel-context-item';
    pinItem.textContent = state.pinned ? '📌 Unpin Window' : '📍 Pin Window';
    pinItem.addEventListener('click', () => {
      windowsManager.setPinned(this.panelId, !state.pinned);
      this.closeContextMenu();
    });
    menu.appendChild(pinItem);

    // Hide
    if (!def || def.hideable) {
      const hideItem = document.createElement('button');
      hideItem.className = 'panel-context-item panel-context-item-danger';
      hideItem.textContent = '👁 Hide Window';
      hideItem.addEventListener('click', () => {
        windowsManager.setVisible(this.panelId, false);
        this.closeContextMenu();
        this.animateHide();
      });
      menu.appendChild(hideItem);
    }

    // Position near the 3-dot button
    if (this.threeDotBtn) {
      const rect = this.threeDotBtn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${rect.right - 140}px`;
    }

    document.body.appendChild(menu);
    this.contextMenu = menu;

    this.contextMenuCloseHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.closeContextMenu();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', this.contextMenuCloseHandler!);
    }, 0);
  }

  private closeContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
    if (this.contextMenuCloseHandler) {
      document.removeEventListener('click', this.contextMenuCloseHandler);
      this.contextMenuCloseHandler = null;
    }
  }

  /**
   * Update the "new items" badge
   * @param count Number of new items (0 hides badge)
   * @param pulse Whether to pulse the badge (for important updates)
   */
  public setNewBadge(count: number, pulse = false): void {
    if (!this.newBadgeEl) return;

    if (count <= 0) {
      this.newBadgeEl.style.display = 'none';
      this.newBadgeEl.classList.remove('pulse');
      this.element.classList.remove('has-new');
      return;
    }

    this.newBadgeEl.textContent = count > 99 ? '99+' : `${count} ${t('common.new')}`;
    this.newBadgeEl.style.display = 'inline-flex';
    this.element.classList.add('has-new');

    if (pulse) {
      this.newBadgeEl.classList.add('pulse');
    } else {
      this.newBadgeEl.classList.remove('pulse');
    }
  }

  /**
   * Clear the new items badge
   */
  public clearNewBadge(): void {
    this.setNewBadge(0);
  }

  /**
   * Get the panel ID
   */
  public getId(): string {
    return this.panelId;
  }

  /**
   * Reset panel height to default
   */
  public resetHeight(): void {
    this.element.classList.remove('resized', 'span-1', 'span-2', 'span-3', 'span-4');
    const spans = loadPanelSpans();
    delete spans[this.panelId];
    localStorage.setItem(PANEL_SPANS_KEY, JSON.stringify(spans));
  }

  protected get signal(): AbortSignal {
    return this.abortController.signal;
  }

  protected isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.contentDebounceTimer) {
      clearTimeout(this.contentDebounceTimer);
      this.contentDebounceTimer = null;
    }
    this.pendingContentHtml = null;

    if (this.tooltipCloseHandler) {
      document.removeEventListener('click', this.tooltipCloseHandler);
      this.tooltipCloseHandler = null;
    }
    if (this.onTouchMove) {
      document.removeEventListener('touchmove', this.onTouchMove);
      this.onTouchMove = null;
    }
    if (this.onTouchEnd) {
      document.removeEventListener('touchend', this.onTouchEnd);
      this.onTouchEnd = null;
    }
    if (this.onDocMouseUp) {
      document.removeEventListener('mouseup', this.onDocMouseUp);
      this.onDocMouseUp = null;
    }
    this.closeContextMenu();
    this.unsubWindowsManager?.();
    this.unsubWindowsManager = null;
  }
}
