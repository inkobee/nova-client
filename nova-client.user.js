// ==UserScript==
// @name         Nova Client - Kour.io
// @namespace    https://tampermonkey.net/
// @version      1.0.0
// @description  Minimal, developer-style client for Kour.io with quality of life improvements
// @author       inkobee
// @match        https://kour.io/*
// @match        https://*.kour.io/*
// @grant        none
// @run-at       document-start
// @require      https://raw.githubusercontent.com/amir16yp/UnityWebModkit/refs/heads/main/dist/unity-web-modkit.0a68cba3d1cd5032a745.js
// ==/UserScript==
//
// Nova Client - Developer-focused overlay and QoL toolkit for Kour.io
//
// Overview
// - Injects a lightweight control panel, chat overlay, and leaderboard UI
// - Adds a small feature system to toggle enhancements at runtime
// - Provides helper modules for DOM, storage, WebGL hooks, Firebase, and Unity messaging
//
// Quick Start
// - Install in Tampermonkey/Violentmonkey and visit kour.io
// - Press Right Shift (`ShiftRight`) to toggle the Nova panel
// - Use the Features tab to enable/disable built-in tools
// - Chat overlay: press Enter to focus, Escape to unfocus
// - Leaderboard and chat show only while a map is playing
//
// Public API (window.NovaAPI)
// - registerFeature(def): Register a feature shown in the panel
// - setFeatureEnabled(id, enabled): Toggle and persist
// - isFeatureEnabled(id): Check persisted/active state
// - listFeatures(): Return shallow copy of registered features
// - renderFeatures([tab]): Ask UI to re-render (optional tab filter)
// - webgl.install(): Install WebGL hooks (idempotent)
// - webgl.register(featureId, method, handler): Hook GL method
// - webgl.unregister(featureId, method): Remove a hook
// - notify/info/success/error(messageOrOpts[, durationMs]): Toasts
//
// Example: Register a simple feature
// NovaAPI.registerFeature({
//   id: 'demo.feature',
//   name: 'Demo Feature',
//   tab: 'general',
//   onEnable: () => { NovaAPI.success('Demo on'); },
//   onDisable: () => { NovaAPI.info('Demo off'); }
// });
// // Persisted state is restored on refresh; use setFeatureEnabled to toggle:
// // NovaAPI.setFeatureEnabled('demo.feature', true)
//
// Hotkeys
// - Toggle UI: Right Shift (configurable in NovaConfig.hotkeys)
// - Optional feature-specific hotkeys are declared in their settings
//
// Architecture
// - Logger: consistent logging utilities
// - ChatUIModule: in-page chat overlay with input and history
// - Dom / Storage / EventUnblocker: general utilities
// - FeatureRegistry: registration + persistence + activation lifecycle for features
// - WebGLHooks: proxy selected WebGL calls for feature-bound instrumentation
// - FirebaseModule / UnityModule: bridges to page-provided SDKs
// - NovaLeaderboard: always-on leaderboard overlay
// - NovaClient: bootstraps, exposes NovaAPI, wires hotkeys and core flows
// - NovaUI: main panel for features with tabs and controls
//
// Conventions
// - Public APIs documented using JSDoc
// - All try/catch blocks swallow errors intentionally to preserve game perf
// - Use `NovaAPI` for external feature registration and notifications


(function() {
    'use strict';

    /**
     * @typedef {Object} FeatureDefinition
     * @property {string} id Unique identifier (stable across sessions)
     * @property {string} name Human‑readable label for the UI
     * @property {string} [tab] Tab/category id (e.g. 'general', 'visual', 'gameplay')
     * @property {string[]} [incompatibleWith] Other feature ids to auto‑disable when enabling this feature
     * @property {() => (boolean|void|Promise<boolean|void>)} [onEnable] Return false to signal retry later
     * @property {() => (void|Promise<void>)} [onDisable]
     */

    /**
     * @typedef {Object} WebGLHookArgs
     * @property {Function} target Original WebGL method
     * @property {WebGLRenderingContext|WebGL2RenderingContext} gl GL context (`this`)
     * @property {any[]} args Current argument list (may be replaced via return value)
     * @property {string} method Method name (e.g. 'drawElements')
     * @property {typeof Reflect} Reflect Native Reflect API for safe apply
     */

    /**
     * @typedef {Object} ToastOptions
     * @property {string} message Text to display
     * @property {'info'|'success'|'error'} [type] Visual style
     * @property {number} [durationMs] Auto‑dismiss time in ms
     */

    /**
     * @typedef {Object} NovaAPI
     * @property {(def: FeatureDefinition) => void} registerFeature Register a new feature
     * @property {(id: string, enabled: boolean) => Promise<void>} setFeatureEnabled Toggle and persist
     * @property {(id: string) => boolean} isFeatureEnabled Query current state
     * @property {() => FeatureDefinition[]} listFeatures List registered feature definitions
     * @property {(tab?: string) => void} renderFeatures Force UI to re‑render
     * @property {{install: () => void, register: (featureId: string, method: string, handler: (args: WebGLHookArgs) => void|{args?: any[], skip?: boolean}) => void, unregister: (featureId: string, method: string) => void}} webgl WebGL hooks
     * @property {(msg: string|ToastOptions, type?: 'info'|'success'|'error', durationMs?: number) => void} notify Show a toast
     * @property {(msg: string, durationMs?: number) => void} info Info toast
     * @property {(msg: string, durationMs?: number) => void} success Success toast
     * @property {(msg: string, durationMs?: number) => void} error Error toast
     */

    // =============================================================
    // Core Boot Guard & Utilities
    // - Ensures single instance per page
    // - Establishes global namespace and core helpers
    // =============================================================
    if (window.__NOVA_CLIENT_ACTIVE__) {
        console.warn('[Nova Client] Already active on this page. Skipping init.');
        return;
    }
    window.__NOVA_CLIENT_ACTIVE__ = true;

    // Establish global namespace for modular structure
    window.Nova = window.Nova || {};

    const uwm = UnityWebModkit.Runtime.createPlugin({ name: "Nova Client", version: "1.0.0", referencedAssemblies: ["GameAssembly.dll", "System.Runtime.InteropServices.dll", "mscorlib.dll", "PhotonUnityNetworking.dll", "Assembly-CSharp.dll"]})

    window.Nova.UnityWebModkit = uwm;

    /**
     * Centralized logger with a consistent prefix for all client logs.
     * Static-only utility.
     *
     * @example
     * Logger.log('Booting...');
     */
    class Logger {
        static prefix = '[Nova Client]';
        static log(...args) { console.log(Logger.prefix, ...args); }
        static warn(...args) { console.warn(Logger.prefix, ...args); }
        static error(...args) { console.error(Logger.prefix, ...args); }
    }

    /**
     * ChatUIModule
     * Lightweight chat overlay that mirrors in-game chat history
     * and provides a focused text input to send messages.
     *
     * Data sources/sinks:
     * - Reads history from `ChatModule.getHistory()`
     * - Sends via `WebSocketModule.sendChatMessage()`
     *
     * Usage
     * - Created and mounted by NovaClient when the game becomes available.
     * - Press Enter to focus and type; Escape to unfocus.
     */
    class ChatUIModule {
        constructor(gameModule) {
            this.game = gameModule;
            this.container = null;
            this.listEl = null;
            this.inputEl = null;
            this.formEl = null;
            this.interval = null;
            this.visible = true;
            this._lastLen = 0;
            this._ensureStyles();
        }

        _ensureStyles() {
            try {
                if (document.getElementById('nova-chatui-styles')) return;
                const style = document.createElement('style');
                style.id = 'nova-chatui-styles';
                style.textContent = `
                    .nova-chatui {
                        position: fixed;
                        bottom: 5.5%;
                        left: 0.25%;
                        width: 15.4%;
                        z-index: 9999;
                        font-family: ${NovaConfig.fonts.primary};
                        color: ${NovaConfig.theme.text};
                        background: ${NovaConfig.theme.background};
                        border: 1px solid ${NovaConfig.theme.border};
                        border-radius: 10px;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                        display: flex;
                        padding: 8px 10px;
                        flex-direction: column;
                        overflow: hidden;
                        pointer-events: auto;
                    }
                    .nova-chatui-body {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    .nova-chatui-list {
                        height: 450px;
                        overflow-y: auto;
                        overflow-x: hidden;
                        scrollbar-width: none;
                        border: none;
                        font-size: 12px;
                        line-height: 1.3;
                    }
                    .nova-chatui-item {
                        margin: 2px 0;
                        padding: 8px;
                        word-break: break-word;
                    }
                    .nova-chatui-form {
                        display: flex;
                        gap: 8px;
                        padding: 0 8px 8px 8px;
                    }
                    .nova-chatui-input {
                        flex: 1;
                        background: transparent;
                        border: none;
                        color: ${NovaConfig.theme.text};
                        font-family: ${NovaConfig.fonts.primary};
                        font-size: 12px;
                        outline: none;
                    }
                `;
                document.head.appendChild(style);
            } catch (_e) { /* ignore */ }
        }

        /** Mount the chat UI into the page and wire events. */
        mount() {
            try {
                if (this.container) return;
                this.container = document.createElement('div');
                this.container.className = 'nova-chatui';
                this.container.innerHTML = `
                    <div class="nova-chatui-body">
                        <div class="nova-chatui-list"></div>
                        <form class="nova-chatui-form">
                            <input class="nova-chatui-input" type="text" maxlength="200" placeholder="Type message…" />
                        </form>
                    </div>
                `;
                document.body.appendChild(this.container);
                // Start hidden; will show only when a map is playing
                this.container.style.display = 'none';

                this.listEl = this.container.querySelector('.nova-chatui-list');
                this.inputEl = this.container.querySelector('.nova-chatui-input');
                this.formEl = this.container.querySelector('.nova-chatui-form');

                // Global Enter-to-focus/Escape-to-unfocus handler (capture to avoid game consuming it)
                this._onKeyDown = (e) => {
                    try {
                        if (e.key === 'Enter') {
                            if (this.inputEl && document.activeElement !== this.inputEl) {
                                e.preventDefault();
                                e.stopPropagation();
                                document.exitPointerLock();
                                this.inputEl.focus();
                            }
                        } else if (e.key === 'Escape') {
                            if (this.inputEl && document.activeElement === this.inputEl) {
                                e.preventDefault();
                                e.stopPropagation();
                                this.inputEl.blur();
                            }
                        }
                    } catch (_e) { /* ignore */ }
                };
                document.addEventListener('keydown', this._onKeyDown, true);

                // Submit handler
                this.formEl.addEventListener('submit', (e) => {
                    try {
                        e.preventDefault();
                        let text = String(this.inputEl.value || '').trim();
                        if (!text) return;
                        text = `<color=white>${WebSocketModule.localPlayer.rawName}</color>: <color=#e8e8e8>${text}`;
                        try { WebSocketModule.sendChatMessage(text); } catch (_e2) {}
                        this.inputEl.value = '';
                        this.inputEl.blur();
                    } catch (_e) { /* ignore */ }
                });

                // Periodic updates
                this.interval = setInterval(() => this.update(), 800);
                this.update();
            } catch (_e) { /* ignore */ }
        }

        /** Remove chat UI and its listeners. */
        unmount() {
            try {
                if (this.interval) { clearInterval(this.interval); this.interval = null; }
                if (this._onKeyDown) {
                    try { document.removeEventListener('keydown', this._onKeyDown, true); } catch (_e) {}
                    this._onKeyDown = null;
                }
                if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
                this.container = null;
                this.listEl = null;
                this.inputEl = null;
                this.formEl = null;
            } catch (_e) { /* ignore */ }
        }

        /**
         * Refresh the chat list from ChatModule history.
         * Cheap polling with diff guard based on history length.
         */
        update() {
            try {
                if (!this.listEl) return;
                const playing = !!(this.game && this.game.isMapPlaying);
                this._setVisible(playing);
                if (!playing) {
                    this.listEl.innerHTML = '';
                    return;
                }
                const history = (ChatModule && typeof ChatModule.getHistory === 'function') ? ChatModule.getHistory() : [];
                if (!Array.isArray(history)) return;
                if (history.length === this._lastLen) return;
                this._lastLen = history.length;
                const html = history.map(s => `<div class="nova-chatui-item">${this._colorizeText(s)}</div>`).join('');
                this.listEl.innerHTML = html;
                // Scroll to bottom
                this.listEl.scrollTop = this.listEl.scrollHeight + 1000;
            } catch (_e) { /* ignore */ }
        }

        /** Update display state without reflowing content. */
        _setVisible(visible) {
            if (!this.container) return;
            if (this.visible === visible) return;
            this.visible = visible;
            this.container.style.display = visible ? 'block' : 'none';
        }

        /**
         * Render Unity-like <color=...> markup to safe HTML.
         * Applies contrast-aware background for dark colors.
         */
        _colorizeText(raw) {
            try {
                const escapeHtml = (s) => String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const renderPlainWithSprites = (s) => {
                    const input = String(s);
                    let out = '';
                    let i = 0;
                    const re = /<sprite=(\d+)>/gi;
                    let m;
                    while ((m = re.exec(input)) !== null) {
                        const start = m.index;
                        const end = start + m[0].length;
                        out += escapeHtml(input.slice(i, start));
                        const id = parseInt(m[1], 10);
                        let color = (NovaConfig && NovaConfig.theme && NovaConfig.theme.blue) || '#1da1f2';
                        if (id === 1) color = (NovaConfig && NovaConfig.theme && NovaConfig.theme.yellow) || '#ffa500';
                        if (id === 2) color = (NovaConfig && NovaConfig.theme && NovaConfig.theme.success) || '#00c853';
                        out += `<span style="background: ${color}; border-radius: 4px; padding: 0 4px; color: ${NovaConfig.theme.background};"><strong>✔</strong></span> `;
                        i = end;
                    }
                    out += escapeHtml(input.slice(i));
                    return out;
                };
                const nameToHex = {
                    red: 'ff0000', green: '00ff00', blue: '0000ff', yellow: 'ffff00', orange: 'ffa500',
                    white: 'ffffff', black: '000000', purple: '800080', magenta: 'ff00ff', cyan: '00ffff',
                    pink: 'ffc0cb', gray: '808080', grey: '808080'
                };
                const normalizeColor = (colorSpecRaw) => {
                    const colorSpec = String(colorSpecRaw || '').trim();
                    let cssColor = colorSpec;
                    let r = 255, g = 255, b = 255;
                    let hasRgb = false;
                    if (colorSpec.startsWith('#')) {
                        let h = colorSpec.slice(1);
                        if (h.length === 3) h = h.split('').map(c => c + c).join('');
                        if (h.length === 8) h = h.slice(0, 6);
                        if (h.length === 6) {
                            cssColor = `#${h}`;
                            try { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); hasRgb = true; } catch (_e) {}
                        }
                    } else {
                        const lower = colorSpec.toLowerCase();
                        if (nameToHex[lower]) {
                            const h = nameToHex[lower];
                            cssColor = `#${h}`;
                            try { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); hasRgb = true; } catch (_e) {}
                        }
                    }
                    if (!hasRgb) { r = 255; g = 255; b = 255; }
                    return { cssColor, r, g, b };
                };
                const renderFrom = (input, startIndex) => {
                    let out = '';
                    let i = startIndex || 0;
                    const len = input.length;
                    while (i < len) {
                        const openIdx = input.indexOf('<color=', i);
                        const closeIdx = input.indexOf('</color>', i);
                        if (openIdx === -1 && closeIdx === -1) {
                            out += renderPlainWithSprites(input.slice(i));
                            i = len;
                            break;
                        }
                        if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
                            out += renderPlainWithSprites(input.slice(i, openIdx));
                            const openMatch = /^<color=([^>]+)>/i.exec(input.slice(openIdx));
                            if (!openMatch) {
                                out += '&lt;';
                                i = openIdx + 1;
                                continue;
                            }
                            const colorSpecRaw = openMatch[1];
                            const tagEnd = openIdx + openMatch[0].length;
                            let depth = 1;
                            let j = tagEnd;
                            while (j < len && depth > 0) {
                                const nextOpen = input.indexOf('<color=', j);
                                const nextClose = input.indexOf('</color>', j);
                                if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
                                    const m2 = /^<color=([^>]+)>/i.exec(input.slice(nextOpen));
                                    if (m2) { depth++; j = nextOpen + m2[0].length; continue; }
                                    j = nextOpen + 1; continue;
                                } else if (nextClose !== -1) {
                                    depth--;
                                    if (depth === 0) {
                                        const innerStart = tagEnd;
                                        const innerEnd = nextClose;
                                        const innerRaw = input.slice(innerStart, innerEnd);
                                        const { cssColor, r, g, b } = normalizeColor(colorSpecRaw);
                                        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                        const bracket = innerRaw.match(/^\s*\[([^\]]{1,64})\]\s*$/);
                                        const isDark = brightness < 0.45;
                                        const useBg = isDark || !!bracket;
                                        let style = `color: ${cssColor};`;
                                        if (useBg) {
                                            const bg = isDark ? NovaConfig.theme.text : NovaConfig.theme.border;
                                            style += ` background: ${bg}; border-radius: 4px; padding: 0 4px;`;
                                        }
                                        const innerHtml = bracket ? renderPlainWithSprites(bracket[1]) : renderFrom(innerRaw, 0);
                                        let segment = `<span style="${style}"><strong>` + innerHtml + `</strong></span>`;
                                        if (bracket) segment += ' ';
                                        out += segment;
                                        j = nextClose + '</color>'.length;
                                        i = j;
                                        break;
                                    } else {
                                        j = nextClose + '</color>'.length;
                                    }
                                } else {
                                    break;
                                }
                            }
                            if (depth > 0) {
                                const innerRaw = input.slice(tagEnd);
                                const { cssColor, r, g, b } = normalizeColor(colorSpecRaw);
                                const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                const bracket = innerRaw.match(/^\s*\[([^\]]{1,64})\]\s*$/);
                                const isDark = brightness < 0.45;
                                const useBg = isDark || !!bracket;
                                let style = `color: ${cssColor};`;
                                if (useBg) {
                                    const bg = isDark ? NovaConfig.theme.text : NovaConfig.theme.border;
                                    style += ` background: ${bg}; border-radius: 4px; padding: 0 4px;`;
                                }
                                const innerHtml = bracket ? renderPlainWithSprites(bracket[1]) : renderFrom(innerRaw, 0);
                                let segment = `<span style="${style}"><strong>` + innerHtml + `</strong></span>`;
                                if (bracket) segment += ' ';
                                out += segment;
                                i = len;
                            }
                            continue;
                        } else if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
                            out += renderPlainWithSprites(input.slice(i, closeIdx));
                            i = closeIdx + '</color>'.length;
                            continue;
                        }
                    }
                    return out;
                };
                return renderFrom(String(raw || ''), 0);
            } catch (_e) {
                return String(raw || '');
            }
        }
    }

    /**
     * DOM helper utilities to reduce boilerplate when interacting with elements.
     * Static-only utility.
     */
    class Dom {
        static qs(selector, root = document) { return root.querySelector(selector); }
        static qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
        static on(element, event, handler, options) { if (element) element.addEventListener(event, handler, options); }
        static onClick(selectorOrElement, handler) {
            const el = typeof selectorOrElement === 'string' ? Dom.qs(selectorOrElement) : selectorOrElement;
            if (el) el.addEventListener('click', handler);
        }
        static create(tagName, props = {}) { return Object.assign(document.createElement(tagName), props); }
    }

    /**
     * Lightweight in-page notification manager (toast system).
     * Provides show/info/success/error APIs and auto-dismiss behavior.
     */
    /**
     * NotificationManager: very small toast system used by NovaAPI.notify/info/success/error.
     * Falls back to GM_notification if DOM container cannot be created.
     */
    class NotificationManager {
        constructor(config) {
            this.config = config || {};
            this.container = null;
            this.defaultDurationMs = 5000;
            this.maxVisible = 6;
        }

        ensureContainer() {
            try {
                if (this.container && document.body.contains(this.container)) return this.container;
                let el = document.getElementById('nova-toast-container');
                if (!el) {
                    el = document.createElement('div');
                    el.id = 'nova-toast-container';
                    el.className = 'nova-toast-container';
                    document.body.appendChild(el);
                }
                this.container = el;
                return el;
            } catch (_e) {
                return null;
            }
        }

        /**
         * Show a toast. Accepts a string message or an options object.
         * @param {string|ToastOptions} input Message or options
         * @param {'info'|'success'|'error'} [type] Variant when `input` is string
         * @param {number} [durationMs] Auto‑dismiss delay override
         */
        show(input, type, durationMs) {
            let message;
            let variant = type || 'info';
            let timeout = Number.isFinite(durationMs) ? durationMs : this.defaultDurationMs;
            if (input && typeof input === 'object') {
                message = String(input.message || '');
                variant = input.type || variant;
                if (Number.isFinite(input.durationMs)) timeout = input.durationMs;
            } else {
                message = String(input || '');
            }
            if (!message) return;

            const container = this.ensureContainer();
            if (!container) {
                try { if (typeof GM_notification === 'function') GM_notification({ text: message, timeout: Math.ceil(timeout / 1000) }); } catch (_e) {}
                return;
            }

            // Enforce a soft cap on visible toasts
            try {
                const toasts = Array.from(container.getElementsByClassName('nova-toast'));
                if (toasts.length >= this.maxVisible) {
                    const excess = toasts.length - this.maxVisible + 1;
                    for (let i = 0; i < excess; i++) {
                        const t = toasts[i];
                        if (t && typeof t.remove === 'function') t.remove();
                    }
                }
            } catch (_e) {}

            const toast = document.createElement('div');
            toast.className = 'nova-toast';

            const msg = document.createElement('div');
            msg.className = `nova-toast-message ${variant || 'info'}`;
            msg.textContent = message;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'nova-toast-close';
            closeBtn.textContent = 'X';

            let hideTimer = null;
            const remove = () => {
                try {
                    toast.classList.remove('visible');
                    toast.style.filter = 'brightness(0.8)';
                    setTimeout(() => { try { toast.remove(); } catch (_e) {} }, 180);
                } catch (_e) { try { toast.remove(); } catch (_e2) {} }
            };

            closeBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (hideTimer) { try { clearTimeout(hideTimer); } catch (_e) {} hideTimer = null; }
                remove();
            });

            toast.appendChild(msg);
            toast.appendChild(closeBtn);
            container.prepend(toast);

            // Animate in
            requestAnimationFrame(() => {
                try { toast.classList.add('visible'); } catch (_e) {}
            });

            // Auto-dismiss
            if (timeout > 0) {
                hideTimer = setTimeout(remove, timeout);
                // Pause on hover
                toast.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
                toast.addEventListener('mouseleave', () => { if (!hideTimer && timeout > 0) hideTimer = setTimeout(remove, 800); });
            }
        }

        info(message, durationMs) { this.show({ message, type: 'info', durationMs }); }
        success(message, durationMs) { this.show({ message, type: 'success', durationMs }); }
        error(message, durationMs) { this.show({ message, type: 'error', durationMs }); }
        clearAll() {
            try {
                const container = this.ensureContainer();
                if (!container) return;
                Array.from(container.getElementsByClassName('nova-toast')).forEach(el => { try { el.remove(); } catch (_e) {} });
            } catch (_e) {}
        }
    }

    // ===== Keyboard Event Unblocker =====
    /**
     * Prevents the page/game from suppressing keyboard input intended for
     * inputs inside the Nova Client UI. Installs capturing listeners and
     * safely overrides preventDefault for relevant events.
     */
    /**
     * EventUnblocker: Allows keyboard/input events within Nova UI to bypass
     * aggressive in‑page preventDefault/stopPropagation used by the game.
     *
     * Installed once during NovaClient.init(). Safe to call multiple times.
     */
    class EventUnblocker {
        static _installed = false;

        static install() {
            if (EventUnblocker._installed) return;
            EventUnblocker._installed = true;
            try {
                const originalPreventDefault = Event.prototype.preventDefault;

                Event.prototype.preventDefault = function() {
                    try {
                        if ((this instanceof KeyboardEvent || this.type === 'beforeinput' || this.type === 'input') && EventUnblocker.isFocusInPanelInput()) {
                            // Do not block keys meant for inputs inside Nova panel
                            return;
                        }
                    } catch (_e) { /* fall through to original */ }
                    return originalPreventDefault.call(this);
                };

                const captureTypes = ['keydown', 'keypress', 'keyup', 'beforeinput'];
                const captureHandler = function(ev) {
                    try {
                        const ae = document.activeElement;
                        const isEditable = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
                        if (!isEditable) return;
                        if (EventUnblocker.isFocusInPanelInput() && ev.target !== ae) {
                            ev.stopImmediatePropagation();
                        }
                    } catch (_e) { /* ignore */ }
                };
                captureTypes.forEach(t => document.addEventListener(t, captureHandler, true));

                Logger.log('EventUnblocker installed');
            } catch (e) {
                Logger.warn('EventUnblocker install failed', e);
            }
        }

        static isFocusInPanelInput() {
            try {
                const panelClasses = ['nova-client', 'nova-chatui', 'nova-leaderboard'];
                const activeElement = document.activeElement;
                if (!activeElement) return false;
                const isEditable = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;
                if (!isEditable) return false;
                for (const cls of panelClasses) {
                    const panels = document.getElementsByClassName(cls);
                    for (let i = 0; i < panels.length; i++) {
                        if (panels[i] && panels[i].contains(activeElement)) return true;
                    }
                }
                return false;
            } catch (_e) {
                return false;
            }
        }
    }

    /**
     * Safe localStorage wrapper with JSON serialization and error handling.
     * Static-only utility.
     */
    class Storage {
        static get(key, fallback = null) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (error) {
                Logger.warn('Storage get failed', key, error);
                return fallback;
            }
        }
        static set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                Logger.warn('Storage set failed', key, error);
            }
        }
        static remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (_e) {}
        }
    }

    const StorageKeys = {
        position: 'nova-client-position',
        features: 'nova-client-features',
        featureValues: 'nova-client-feature-values'
    };

    /**
     * Locate the primary game canvas. Kour.io may vary the id/name,
     * so we attempt a targeted query first, then a generic fallback.
     */
    const findGameCanvas = () => document.querySelector('#gameCanvas') || document.querySelector('canvas');

    /**
     * Simple feature system: register toggleable features with on/off handlers.
     * Each feature definition provides an id, display name, tab placement,
     * and async onEnable/onDisable handlers.
     *
     * Lifecycle:
     * - register(): add feature definitions
     * - setEnabled(): toggle at runtime and persist state
     * - activateEnabled(): apply persisted states after boot
     */
    /**
     * FeatureRegistry: registers feature definitions, persists toggle state and
     * arbitrary control values, enforces incompatibilities, and handles delayed
     * activation retries for features that must wait on game state.
     */
    class FeatureRegistry {
        constructor() {
            this.features = [];
            this.state = Storage.get(StorageKeys.features, {});
            this.values = Storage.get(StorageKeys.featureValues, {});
            this.applied = {};
            this._retryTimer = null;
        }

        /**
         * Register a feature definition.
         * @param {{id:string,name:string,tab?:string,onEnable?:Function,onDisable?:Function,incompatibleWith?:string[]}} def
         */
        register(def) {
            if (!def || !def.id) return;
            const exists = this.features.find(f => f.id === def.id);
            if (exists) return;
            this.features.push(def);
        }

        /**
         * Get a stored value for a sub-feature/control.
         * @param {string} featureId
         * @param {string} controlId
         * @param {*} defaultValue
         */
        getValue(featureId, controlId, defaultValue = null) {
            try {
                const key = `${featureId}::${controlId}`;
                return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : defaultValue;
            } catch (_e) {
                return defaultValue;
            }
        }

        /**
         * Set and persist a value for a sub-feature/control.
         * @param {string} featureId
         * @param {string} controlId
         * @param {*} value
         */
        setValue(featureId, controlId, value) {
            try {
                const key = `${featureId}::${controlId}`;
                this.values[key] = value;
                Storage.set(StorageKeys.featureValues, this.values);
            } catch (_e) {}
        }

        /**
         * Determine if a feature is persisted as enabled.
         * @param {string} id
         * @returns {boolean}
         */
        isEnabled(id) {
            return !!this.state[id];
        }

        /**
         * Toggle a feature and persist the new state.
         * Invokes onEnable/onDisable and schedules retries if necessary.
         * @param {string} id
         * @param {boolean} enabled
         */
        async setEnabled(id, enabled) {
            const def = this.features.find(f => f.id === id);
            if (!def) return;
            try {
                // If enabling, ensure incompatible features are turned off first
                if (enabled) {
                    await this._disableIncompatible(def);
                }
                if (enabled) {
                    const result = await def.onEnable?.();
                    if (result === false) {
                        this.applied[id] = false;
                        this.scheduleRetry();
                    } else {
                        this.applied[id] = true;
                    }
                } else {
                    await def.onDisable?.();
                    this.applied[id] = false;
                }
                this.state[id] = !!enabled;
                Storage.set(StorageKeys.features, this.state);
                // Ask UI to refresh so any incompatibility changes reflect immediately
                try { window.NovaAPI && window.NovaAPI.renderFeatures && window.NovaAPI.renderFeatures(); } catch (_e) {}
            } catch (e) {
                Logger.warn('Feature toggle failed', id, e);
                if (enabled) this.scheduleRetry();
            }
        }

        /** Activate all features that are persisted as enabled (idempotent). */
        async activateEnabled() {
            for (const f of this.features) {
                await this.activateIfEnabled(f.id);
            }
        }

        /**
         * Activate a specific feature if persisted as enabled (idempotent).
         * @param {string} id
         */
        async activateIfEnabled(id) {
            try {
                const def = this.features.find(f => f.id === id);
                if (!def) return;
                if (this.isEnabled(id) && !this.applied[id]) {
                    // Enforce incompatibilities before enabling
                    await this._disableIncompatible(def);
                    const result = await def.onEnable?.();
                    if (result === false) {
                        this.applied[id] = false;
                        this.scheduleRetry();
                    } else {
                        this.applied[id] = true;
                    }
                }
            } catch (e) {
                Logger.warn('Feature activation failed', id, e);
            }
        }

        /** Try enabling a specific feature now and mark applied on success. */
        async tryEnable(id) {
            const def = this.features.find(f => f.id === id);
            if (!def) return;
            const result = await def.onEnable?.();
            if (result === false) {
                this.applied[id] = false;
            } else {
                this.applied[id] = true;
            }
        }

        /** Retry enabling any enabled-but-not-applied features until success. */
        scheduleRetry() {
            if (this._retryTimer) return;
            this._retryTimer = setInterval(async () => {
                const pending = this.features.filter(f => this.isEnabled(f.id) && !this.applied[f.id]);
                if (pending.length === 0) {
                    clearInterval(this._retryTimer);
                    this._retryTimer = null;
                    return;
                }
                for (const f of pending) {
                    try {
                        await this.tryEnable(f.id);
                    } catch (_e) { /* keep trying */ }
                }
            }, 1500);
        }

        /** Disable any features marked incompatible with the provided feature definition. */
        async _disableIncompatible(def) {
            try {
                const incompatibleIds = Array.isArray(def.incompatibleWith) ? def.incompatibleWith : [];
                if (incompatibleIds.length === 0) return;
                for (const otherId of incompatibleIds) {
                    if (!otherId || otherId === def.id) continue;
                    if (this.isEnabled(otherId)) {
                        await this.setEnabled(otherId, false);
                    }
                }
            } catch (_e) { /* ignore */ }
        }
    }

    /**
     * WebGLHooks: Lightweight runtime hook system for WebGL methods.
     * - Wraps selected WebGL methods via Proxy once per page
     * - Allows registering handlers bound to a featureId
     * - Handlers only run when the associated feature is enabled
     */
    /**
     * WebGLHooks: wraps a small set of WebGL methods (draw* and shaderSource)
     * with a Proxy and dispatches to handlers registered per feature id. A
     * handler runs only when its feature is currently enabled.
     *
     * Register with: `NovaAPI.webgl.register('my.feature', 'drawElements', (ctx) => { ... })`
     */
    class WebGLHooks {
        static _installed = false;
        static _featureRegistry = null;
        static _registry = new Map(); // methodName -> Array<{featureId, handler}>
        static _originals = new Map(); // `${which}:${method}` -> Function

        /** Install hook proxies (idempotent). */
        static install(featureRegistry) {
            if (WebGLHooks._installed) return;
            WebGLHooks._installed = true;
            WebGLHooks._featureRegistry = featureRegistry;
            try {
                const targets = [];
                if (typeof WebGL2RenderingContext !== 'undefined') targets.push({ which: 'WebGL2', proto: WebGL2RenderingContext.prototype });
                if (typeof WebGLRenderingContext !== 'undefined') targets.push({ which: 'WebGL1', proto: WebGLRenderingContext.prototype });

                const methodsToWrap = ['drawElements', 'drawElementsInstanced', 'drawArrays', 'shaderSource'];
                for (const { which, proto } of targets) {
                    for (const method of methodsToWrap) {
                        if (typeof proto[method] !== 'function') continue;
                        const key = `${which}:${method}`;
                        if (WebGLHooks._originals.has(key)) continue;
                        const original = proto[method];
                        WebGLHooks._originals.set(key, original);
                        if (method === 'shaderSource') {
                            proto[method] = new Proxy(original, {
                                apply(target, thisArgs, args) {
                                    let nextArgs = args;
                                    const handlers = WebGLHooks._registry.get('shaderSource') || [];
                                    for (const h of handlers) {
                                        try {
                                            if (!WebGLHooks._isEnabled(h.featureId)) continue;
                                            const r = h.handler && h.handler({ target, gl: thisArgs, args: nextArgs, method: 'shaderSource', Reflect });
                                            if (r && Array.isArray(r.args)) nextArgs = r.args;
                                        } catch (_e) { /* ignore */ }
                                    }
                                    return Reflect.apply(target, thisArgs, nextArgs);
                                }
                            });
                        } else {
                            proto[method] = new Proxy(original, {
                                apply(target, thisArgs, args) {
                                    let nextArgs = args;
                                    let skipOriginal = false;
                                    let result;
                                    const handlers = WebGLHooks._registry.get(method) || [];
                                    for (const h of handlers) {
                                        try {
                                            if (!WebGLHooks._isEnabled(h.featureId)) continue;
                                            const r = h.handler && h.handler({ target, gl: thisArgs, args: nextArgs, method, Reflect });
                                            if (r && Array.isArray(r.args)) nextArgs = r.args;
                                            if (r && r.skipOriginal) { skipOriginal = true; result = r.result; }
                                        } catch (_e) { /* ignore handler error */ }
                                    }
                                    if (skipOriginal) return result;
                                    return Reflect.apply(target, thisArgs, nextArgs);
                                }
                            });
                        }
                    }
                }
                window._webGLHooksSetup = true;
                Logger.log('WebGL hooks installed');
            } catch (e) {
                Logger.warn('WebGLHooks install failed', e);
            }
        }

        static _isEnabled(featureId) {
            try { return !!WebGLHooks._featureRegistry && WebGLHooks._featureRegistry.isEnabled(featureId); } catch (_e) { return false; }
        }

        /** Register a handler for a method (e.g., 'drawElements', 'shaderSource'). */
        static register(featureId, methodName, handler) {
            if (!featureId || typeof methodName !== 'string' || typeof handler !== 'function') return;
            const list = WebGLHooks._registry.get(methodName) || [];
            list.push({ featureId, handler });
            WebGLHooks._registry.set(methodName, list);
        }

        /** Unregister handlers for a feature; optionally only for one method. */
        static unregister(featureId, methodName) {
            for (const [m, list] of WebGLHooks._registry.entries()) {
                if (methodName && m !== methodName) continue;
                const next = list.filter(h => h.featureId !== featureId);
                if (next.length === 0) WebGLHooks._registry.delete(m);
                else WebGLHooks._registry.set(m, next);
            }
        }
    }

    /**
     * Firebase helper for reading/writing under /users/${uid}
     * Assumes the page provides firebase (v8 namespaced SDK) in window.
     */
    /**
     * FirebaseModule: thin helpers around page‑injected Firebase SDK used by Kour.io.
     * All methods are no‑ops if Firebase is not present. Used for username restore.
     */
    class FirebaseModule {
        static isAvailable() {
            try {
                return typeof window.firebase !== 'undefined' && !!window.firebase.apps && window.firebase.apps.length > 0;
            } catch (_e) {
                return false;
            }
        }
        static getUid() {
            try {
                return window.firebase.auth().currentUser && window.firebase.auth().currentUser.uid || null;
            } catch (_e) {
                return null;
            }
        }
        static ensureReady() {
            if (!FirebaseModule.isAvailable()) throw new Error('Firebase not available on page');
            const uid = FirebaseModule.getUid();
            if (!uid) throw new Error('No authenticated user');
            return uid;
        }
        static ref(relativePath = '') {
            const uid = FirebaseModule.ensureReady();
            const clean = (relativePath || '').replace(/^\/+/, '');
            const fullPath = clean ? `users/${uid}/${clean}` : `users/${uid}`;
            return window.firebase.database().ref(fullPath);
        }
        static async read(relativePath = '') {
            const snapshot = await FirebaseModule.ref(relativePath).once('value');
            return snapshot.val();
        }
        static async write(relativePath = '', value) {
            await FirebaseModule.ref(relativePath).set(value);
            // Guard potential side-effect hook if it exists on the page
            try {
                if (typeof window.showUserDetails === 'function' && window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
                    window.showUserDetails(window.firebase.auth().currentUser.email, window.firebase.auth().currentUser);
                }
            } catch (_e) { /* ignore */ }
        }
    }

    /**
     * Unity helper to safely send messages to the embedded Unity instance.
     */
    /**
     * UnityModule: bridge to the page’s Unity instance. Provides send helpers
     * and best‑effort retry wrappers for common calls used by Nova features.
     */
    class UnityModule {
        static isAvailable() {
            try {
                return !!window.unityInstance && typeof window.unityInstance.SendMessage === 'function';
            } catch (_e) {
                return false;
            }
        }
        /** Attempt SendMessage; return true on success, false on failure. */
        static send(gameObject, method, arg = '') {
            try {
                if (!UnityModule.isAvailable()) return false;
                window.unityInstance.SendMessage(gameObject, method, arg);
                return true;
            } catch (e) {
                Logger.warn('Unity SendMessage failed', { gameObject, method, arg, e });
                return false;
            }
        }
        /** Retry a few times with a delay if Unity may not be ready yet. */
        static async sendWithRetry(gameObject, method, arg = '', attempts = 5, delayMs = 300) {
            for (let i = 0; i < attempts; i++) {
                if (UnityModule.send(gameObject, method, arg)) return true;
                await new Promise(r => setTimeout(r, delayMs));
            }
            return false;
        }
    }

    // =============================================================
    // Chat Module: Minimal chat history collector (binary typed-string scan)
    // =============================================================
    /**
     * ChatModule
     * Collects recent chat messages decoded from network traffic.
     * Exposes a simple history buffer consumed by ChatUIModule.
     */
    /**
     * ChatModule: parses typed string payloads from server chat frames and
     * keeps a short rolling history for ChatUIModule to render.
     */
    const ChatModule = {
        history: [],
        max: 300,
        _add(text) {
            try {
                if (!text) return;
                this.history.push(String(text));
                if (this.history.length > this.max) this.history.splice(0, this.history.length - this.max);
            } catch (_e) {}
        },
        clear() {
            try { this.history.length = 0; } catch (_e) { this.history = []; }
        },
        getHistory() { return this.history.slice(); },
        // Typed string format: 0x07, varint(len), then len bytes
        _readVarInt(u8, start) {
            let value = 0; let shift = 0; let i = start;
            while (i < u8.length) {
                const b = u8[i++];
                value |= (b & 0x7f) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7; if (shift > 28) break;
            }
            return { value, length: i - start };
        },
        _bytesToText(bytes) {
            try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (_e) {
                try { return String.fromCharCode.apply(null, Array.from(bytes)); } catch (_e2) { return ''; }
            }
        },
        _isMostlyPrintable(s) {
            if (!s) return false;
            const clean = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            return clean.length / s.length > 0.85;
        },
        _extractTypedStrings(u8, limit = 4) {
            const out = [];
            if (!u8) return out;
            let i = 0;
            while (i < u8.length && out.length < limit) {
                if (u8[i] !== 0x07) { i++; continue; }
                const { value: len, length: l } = this._readVarInt(u8, i + 1);
                const start = i + 1 + l; const end = start + len;
                if (l <= 0 || len <= 0 || end > u8.length) { i++; continue; }
                const slice = u8.subarray(start, end);
                const text = this._bytesToText(slice);
                if (text && this._isMostlyPrintable(text)) {
                    const t = text.trim();
                    if (t.length >= 2 && /[A-Za-z]/.test(t)) out.push(t);
                }
                i = end;
            }
            return out;
        },
        ingestFrame(u8) {
            try {
                if (!(u8 && u8.length)) return;
                // Only consider server chat frames: 0xf3 0x04 0x00 0x02
                if (!(u8.length >= 4 && u8[0] === 0xf3 && u8[1] === 0x04 && u8[2] === 0x00 && u8[3] === 0x02)) return;
                const strings = this._extractTypedStrings(u8, 6);
                if (strings && strings.length) {
                    for (const s of strings) {
                        this._add(s);
                    };
                }
            } catch (_e) {}
        }
    };

    // =============================================================
    // Binary Protocol Module: Handles all parsing of incoming and outgoing messages
    // =============================================================

    // Represents a typed value, used for serialization/deserialization
    class TypedValue {
        type = 0;
        value = null;

        constructor(type, value) {
            this.type = type;
            this.value = value;
        }

        // Factory method to create a TypedValue from a raw value
        static from(rawValue) {
            switch (typeof rawValue) {
                case "number":
                    return this.fromNumber(rawValue);
                case "string":
                    return this.fromString(rawValue);
                default:
                    // If it already has a 'type' property, assume it's a TypedValue instance
                    if (rawValue !== undefined && rawValue.type !== undefined) {
                        return rawValue;
                    }
                    // Handle null specifically
                    if (rawValue === null) {
                        return this.fromString(null);
                    }
                    throw Error("Unsupported raw value type: " + typeof rawValue);
            }
        }

        // Factory method for numbers, assigning specific types based on range
        static fromNumber(num) {
            if (num === null) return new TypedValue(0x1e, null); // Null number
            if (isNaN(num)) return new TypedValue(0x1c, null); // NaN number

            if (num > 0xffff) return new TypedValue(0x9, num); // Large integer
            if (num > 0xff) return new TypedValue(0xd, num); // Medium integer (2 bytes)
            if (num >= 0x0) return new TypedValue(0xb, num); // Small positive integer (1 byte)

            if (num < -0xffff) return new TypedValue(0x9, num); // Large negative integer
            if (num < -0xff) return new TypedValue(0xe, num); // Medium negative integer (2 bytes)
            if (num < 0x0) return new TypedValue(0xc, num); // Small negative integer (1 byte)

            throw Error("Unsupported number: " + num);
        }

        // Factory method for strings
        static fromString(str) {
            return str === null
                ? new TypedValue(0x8, null)
                : new TypedValue(0x7, str);
        }

        toString() {
            return this.value.toString();
        }

        valueOf() {
            return this.value;
        }

        equals(other) {
            if (other instanceof TypedValue) {
                return other.type === this.type && other.value === this.value;
            }
            return this.value === other;
        }

        // Allows implicit conversion to primitive types
        [Symbol.toPrimitive](hint) {
            return hint === "string" ? this.value.toString() : this.value;
        }

        toJSON() {
            return {
                type: this.type,
                value: this.value,
            };
        }
    }

    // Extends Map to add a name and signature, used for message parsing
    class KeyMap extends Map {
        name = "Unknown";
        signature = null;

        constructor(name, signature) {
            super();
            this.name = name;
            this.signature = signature;
        }

        static EMPTY = new KeyMap(null, null); // A static empty KeyMap instance

        toString() {
            return `KeyMap: ${this.name} (${this.size} entries)`;
        }

        toJSON() {
            return Object.fromEntries(this.entries());
        }
    }

    // Extends Map to handle TypedValue keys correctly (using .equals() for comparison)
    class TypedKeyMap extends Map {
        type = 0x15; // Specific type identifier for this map

        set(key, value) {
            // Check if an equivalent TypedValue key already exists
            for (const existingKey of this.keys()) {
                if (existingKey instanceof TypedValue && existingKey.equals(key)) {
                    super.set(existingKey, value); // Update existing entry
                    return this;
                }
            }
            super.set(key, value); // Add new entry
            return this;
        }

        get(key) {
            for (const [existingKey, value] of this.entries()) {
                if (existingKey instanceof TypedValue && existingKey.equals(key)) {
                    return value;
                }
            }
            return super.get(key); // Fallback to default Map.get
        }

        has(key) {
            for (const existingKey of this.keys()) {
                if (existingKey instanceof TypedValue && existingKey.equals(key)) {
                    return true;
                }
            }
            return super.has(key); // Fallback to default Map.has
        }

        toJSON() {
            return Object.fromEntries(this.entries());
        }
    }

    // Base class for reading and writing binary data
    /**
     * BinaryStream: base for reading/writing the custom binary protocol used
     * by Kour.io messages. High‑level helpers read/write typed primitives
     * (strings, numbers, arrays, maps) with explicit marker bytes.
     */
    class BinaryStream {
        buffer = null; // Uint8Array to hold the data
        position = 0; // Current read/write position

        constructor(initialBuffer = null) {
            this.buffer = initialBuffer || new Uint8Array(0x40); // Default size 64 bytes
            this.position = 0;
        }

        get data() {
            return this.buffer.subarray(0, this.position);
        }

        get remainingCapacity() {
            return this.buffer.length - this.position;
        }

        get isEndOfStream() {
            return this.position >= this.buffer.length;
        }

        get totalLength() {
            return this.buffer.length;
        }

        hasEnoughCapacity(length) {
            // 'Length must be non-negative' (original comment)
            return this.position + length <= this.buffer.length;
        }

        // Placeholder for validation/error handling (original 'U' method)
        _validateRead(length) {
            // if (!this.hasEnoughCapacity(length)) {
            //   throw new Error(`Stream EOF: tried to read ${length} bytes, but only ${this.remainingCapacity} available.`);
            // }
        }

        get hexText() {
            return Array.from(this.data)
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join(" ");
        }

        toString() {
            return this.hexText;
        }

        seek(offset) {
            // Original comments: 'Seek position out of bounds: ' + this.position + ' (length: ' + this.buffer.length + ')'
            this.position += offset;
        }

        peekByte() {
            this._validateRead(1);
            return this.buffer[this.position];
        }

        readByte() {
            this._validateRead(1);
            return this.buffer[this.position++];
        }

        writeByte(value) {
            this._ensureCapacity(1);
            this.buffer[this.position++] = 0xff & value;
        }

        readBytes(length) {
            this._validateRead(length);
            const bytes = this.buffer.subarray(this.position, this.position + length);
            this.position += length;
            return bytes;
        }

        writeBytes(byteArray) {
            this._ensureCapacity(byteArray.length);
            this.buffer.set(byteArray, this.position);
            this.position += byteArray.length;
        }

        readUInt16() {
            this._validateRead(2);
            const value =
                (this.buffer[this.position + 1] << 8) | this.buffer[this.position];
            this.position += 2;
            return value;
        }

        writeUInt16(value) {
            this._ensureCapacity(2);
            this.buffer[this.position++] = 0xff & value;
            this.buffer[this.position++] = (value >> 8) & 0xff;
        }

        readUInt32() {
            this._validateRead(4);
            const value =
                (this.buffer[this.position + 3] << 24) |
                (this.buffer[this.position + 2] << 16) |
                (this.buffer[this.position + 1] << 8) |
                this.buffer[this.position];
            this.position += 4;
            return value;
        }

        writeUInt32(value) {
            this._ensureCapacity(4);
            this.buffer[this.position++] = 0xff & value;
            this.buffer[this.position++] = (value >> 8) & 0xff;
            this.buffer[this.position++] = (value >> 16) & 0xff;
            this.buffer[this.position++] = (value >> 24) & 0xff;
        }

        readUInt64() {
            this._validateRead(8);
            // Note: JavaScript numbers are 64-bit floats, so large integers might lose precision.
            const low =
                (this.buffer[this.position + 3] << 24) |
                (this.buffer[this.position + 2] << 16) |
                (this.buffer[this.position + 1] << 8) |
                this.buffer[this.position];
            const high =
                (this.buffer[this.position + 7] << 24) |
                (this.buffer[this.position + 6] << 16) |
                (this.buffer[this.position + 5] << 8) |
                this.buffer[this.position + 4];
            this.position += 8;
            return high * 0x100000000 + low; // Combine two 32-bit parts
        }

        writeUInt64(value) {
            this._ensureCapacity(8);
            const low = 0xffffffff & value;
            const high = Math.floor(value / 0x100000000);
            this.buffer[this.position++] = 0xff & low;
            this.buffer[this.position++] = (low >> 8) & 0xff;
            this.buffer[this.position++] = (low >> 16) & 0xff;
            this.buffer[this.position++] = (low >> 24) & 0xff;
            this.buffer[this.position++] = 0xff & high;
            this.buffer[this.position++] = (high >> 8) & 0xff;
            this.buffer[this.position++] = (high >> 16) & 0xff;
            this.buffer[this.position++] = (high >> 24) & 0xff;
        }

        readFloat32() {
            this._validateRead(4);
            const value = new DataView(
                this.buffer.buffer,
                this.buffer.byteOffset
            ).getFloat32(this.position, false);
            this.position += 4;
            return value;
        }

        writeFloat32(value) {
            this._ensureCapacity(4);
            new DataView(this.buffer.buffer, this.buffer.byteOffset).setFloat32(
                this.position,
                value,
                false
            );
            this.position += 4;
        }

        readFloat64() {
            this._validateRead(8);
            const value = new DataView(
                this.buffer.buffer,
                this.buffer.byteOffset
            ).getFloat64(this.position, true);
            this.position += 8;
            return value;
        }

        writeFloat64(value) {
            this._ensureCapacity(8);
            new DataView(this.buffer.buffer, this.buffer.byteOffset).setFloat64(
                this.position,
                value,
                true
            );
            this.position += 8;
        }

        readString(length) {
            const bytes = this.readBytes(length);
            return String.fromCharCode(...bytes);
        }

        writeString(str) {
            const bytes = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                bytes[i] = 0xff & str.charCodeAt(i);
            }
            this.writeBytes(bytes);
        }

        // Ensures the buffer has enough space, resizing if needed
        _ensureCapacity(requiredLength) {
            if (this.position + requiredLength > this.buffer.length) {
                const newBuffer = new Uint8Array(
                    Math.max(2 * this.buffer.length, this.position + requiredLength)
                );
                newBuffer.set(this.buffer);
                this.buffer = newBuffer;
            }
        }

        // Trims the buffer to the actual data length
        trimBuffer() {
            if (this.buffer.length > this.position) {
                this.buffer = this.buffer.slice(0, this.position);
            }
        }

        // Placeholder for validation (original 'V' method)
        _validateMarker(expectedMarker, errorMessage = "") {
            // if (this.readByte() !== expectedMarker) {
            //   throw new Error(errorMessage || `Unexpected marker: expected ${expectedMarker}`);
            // }
            this.position++; // Advance position even if not validated
        }
    }

    // Extends BinaryStream to handle custom TypedValue objects and arrays
    class CustomDataStream extends BinaryStream {
        constructor(initialBuffer = null) {
            super(initialBuffer);
        }

        // Read a string (can be null)
        readTypedString() {
            const marker = this.readByte();
            if (marker === 0x7) {
                // String marker
                return this.readString(this.readVarInt());
            }
            if (marker === 0x8) {
                // Null string marker
                return null;
            }
            throw Error(
                `Invalid string marker ${marker} at pos ${this.position - 1}`
            );
        }

        // Write a string (can be null)
        writeTypedString(str) {
            if (str !== null) {
                this.writeByte(0x7); // String marker
                this.writeVarInt(str.length);
                this.writeString(str);
            } else {
                this.writeByte(0x8); // Null string marker
            }
        }

        // Read a number (as TypedValue)
        readTypedNumber() {
            const marker = this.readByte();
            switch (marker) {
                case 0x3: // 1-byte unsigned int
                case 0xb: // 1-byte unsigned int
                    return new TypedValue(marker, this.readByte());
                case 0xc: // 1-byte negative int
                    return new TypedValue(marker, 0x0 - this.readByte());
                case 0xd: // 2-byte unsigned int
                    return new TypedValue(marker, this.readUInt16());
                case 0xe: // 2-byte negative int
                    return new TypedValue(marker, 0x0 - this.readUInt16());
                case 0x5: // 4-byte unsigned int
                    return new TypedValue(marker, this.readUInt32());
                case 0x6: // 8-byte float (double)
                    return new TypedValue(marker, this.readFloat64());
                case 0x9: // Varint (signed or unsigned, depends on context)
                    return this.readSignedVarInt();
                case 0x1b: // Special null/empty values
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    return new TypedValue(marker, null);
                default:
                    throw Error(
                        `Invalid number marker ${marker} at ${this.position - 1}`
                    );
            }
        }

        // Write a number (from TypedValue or raw number)
        writeTypedNumber(num) {
            let typedNum;
            if (num instanceof TypedValue) {
                typedNum = num;
            } else {
                typedNum = TypedValue.fromNumber(num);
            }

            this.writeByte(typedNum.type);
            switch (typedNum.type) {
                case 0x3:
                case 0xb:
                    this.writeByte(typedNum.value);
                    break;
                case 0xc:
                    this.writeByte(0x0 - typedNum.value);
                    break;
                case 0xd:
                    this.writeUInt16(typedNum.value);
                    break;
                case 0xe:
                    this.writeUInt16(0x0 - typedNum.value);
                    break;
                case 0x5:
                    this.writeUInt32(typedNum.value);
                    break;
                case 0x6:
                    this.writeFloat64(typedNum.value);
                    break;
                case 0x9:
                    this.writeSignedVarInt(typedNum.value);
                    break;
                case 0x1b:
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    // No value to write for these types
                    break;
                default:
                    throw Error(`Invalid number type ${typedNum.type}`);
            }
        }

        // Read unsigned variable-length integer (Varint)
        readVarInt() {
            let value = 0;
            let shift = 0;
            while (true) {
                const byte = this.readByte();
                value |= (byte & 0x7f) << shift;
                if (!(byte & 0x80)) {
                    // If MSB is not set, it's the last byte
                    break;
                }
                shift += 7;
            }
            return new TypedValue(0x9, value >>> 0); // Return as unsigned 32-bit
        }

        // Write unsigned variable-length integer (Varint)
        writeVarInt(value) {
            while (true) {
                let byte = value & 0x7f;
                value >>>= 7;
                if (value === 0) {
                    this.writeByte(byte);
                    break;
                }
                this.writeByte(byte | 0x80); // Set MSB to indicate more bytes follow
            }
        }

        // Read signed variable-length integer (ZigZag encoding)
        readSignedVarInt() {
            let value = 0;
            let shift = 0;
            let byte;
            while (true) {
                byte = this.readByte();
                value |= (byte & 0x7f) << shift;
                if (!(byte & 0x80)) {
                    break;
                }
                shift += 7;
            }
            // Apply ZigZag decoding
            if (shift < 32 && byte & 0x40) {
                // If sign bit is set
                value |= -1 << shift;
            }
            return new TypedValue(0x8, value); // Return as signed integer
        }

        // Write signed variable-length integer (ZigZag encoding)
        writeSignedVarInt(value) {
            value |= 0; // Ensure it's a 32-bit integer
            while (true) {
                let byte = value & 0x7f;
                value >>= 7;
                if (value === 0 || value === -1) {
                    // If value is 0 or -1 (all ones in 2's complement)
                    this.writeByte(byte);
                    break;
                }
                this.writeByte(byte | 0x80);
            }
        }

        // Read a "tag" marker (TypedValue)
        readTag() {
            this._validateMarker(0x22, "Bad tag marker");
            return this.readTypedNumber();
        }

        // Write a "tag" marker (TypedValue)
        writeTag(value) {
            this.writeByte(0x22);
            this.writeTypedNumber(value);
        }

        // Read an "id" marker (TypedValue)
        readId() {
            this._validateMarker(0xfe, "Bad id marker");
            return this.readTypedNumber();
        }

        // Write an "id" marker (TypedValue)
        writeId(value) {
            this.writeByte(0xfe);
            this.writeTypedNumber(value);
        }

        // Write a timestamp (using a specific TypedValue for timestamp)
        writeTimestamp() {
            this.writeTypedNumber(MESSAGE_FIELD_IDS.timestamp);
            this.writeTypedNumber(0xcafe); // Magic number for timestamp
        }

        // Read a TypedKeyMap (dictionary)
        readTypedKeyMap() {
            this._validateMarker(0x15, "Bad dictionary marker");
            const size = this.readByte();
            const map = new TypedKeyMap();
            for (let i = 0; i < size; i++) {
                const key = this.readAnyTypedValue();
                const value = this.readAnyTypedValue();
                map.set(key, value);
            }
            return map;
        }

        // Write a TypedKeyMap (dictionary)
        writeTypedKeyMap(map) {
            this.writeByte(0x15);
            this.writeByte(map.size);
            map.forEach((value, key) => {
                this.writeAnyTypedValue(key);
                this.writeAnyTypedValue(value);
            });
        }

        // Read a KeyMap (message structure)
        readKeyMap(name, signature) {
            const keyMap = new KeyMap(name, signature);
            this.seek(signature.length); // Advance past the signature bytes
            while (!this.isEndOfStream) {
                const key = this.readByte(); // Key is a single byte
                if (this.isEndOfStream) {
                    continue; // Avoid reading past end if key was last byte
                }
                const value = this.readAnyTypedValue();
                keyMap.set(key, value);
            }
            return keyMap;
        }

        // Write a KeyMap (message structure)
        writeKeyMap(keyMap) {
            this.writeBytes(keyMap.signature);
            keyMap.forEach((value, key) => {
                this.writeByte(key);
                this.writeAnyTypedValue(value);
            });
        }

        // Read a string array
        readStringArray() {
            this._validateMarker(0x47, "Bad string array marker");
            const size = this.readByte();
            const array = [];
            array.type = 0x47; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const str = this.readString(this.readByte()); // Read length then string
                array.push(str);
            }
            return array;
        }

        // Write a string array
        writeStringArray(array) {
            this.writeByte(0x47);
            this.writeByte(array.length);
            array.forEach((str) => {
                this.writeByte(str.length);
                this.writeString(str);
            });
        }

        // Read a Varint array
        readVarIntArray() {
            this._validateMarker(0x49, "Bad Varint array marker");
            const size = this.readByte();
            const array = new Array(size);
            array.type = 0x49; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const value = this.readSignedVarInt();
                array[i] = value;
            }
            return array;
        }

        // Write a Varint array
        writeVarIntArray(array) {
            this.writeByte(0x49);
            this.writeByte(array.length);
            for (let i = 0; i < array.length; i++) {
                this.writeSignedVarInt(array[i]);
            }
        }

        // Read an "any" array (array of mixed TypedValues)
        readAnyArray() {
            this._validateMarker(0x17, "Bad any array marker");
            const size = this.readByte();
            const array = [];
            array.type = 0x17; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const value = this.readAnyTypedValue();
                array.push(value);
            }
            return array;
        }

        // Write an "any" array
        writeAnyArray(array) {
            this.writeByte(0x17);
            this.writeByte(array.length);
            for (let i = 0; i < array.length; i++) {
                this.writeAnyTypedValue(array[i]);
            }
        }

        // Read an "array-array" (array of arrays)
        readArrayOfArrays() {
            this._validateMarker(0x40, "Bad array-array marker");
            const size = this.readByte();
            const array = [];
            array.type = 0x40; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                const value = this.readAnyTypedValue(); // Each element is an "any" type
                array.push(value);
            }
            return array;
        }

        // Write an "array-array"
        writeArrayOfArrays(array) {
            this.writeByte(0x40);
            this.writeByte(array.length);
            for (let i = 0; i < array.length; i++) {
                this.writeAnyTypedValue(array[i]);
            }
        }

        // Read a raw byte array (length prefixed)
        readLengthPrefixedByteArray() {
            const length = this.readByte();
            return this.readBytes(length);
        }

        // Write a raw byte array (length prefixed)
        writeLengthPrefixedByteArray(byteArray) {
            this.writeByte(byteArray.length);
            this.writeBytes(byteArray);
        }

        // Read a specific 5-byte array (type 0xDA)
        readSpecial5ByteArray() {
            this._validateMarker(0xda);
            const bytes = this.readBytes(5);
            bytes.type = 0xda; // Custom property to indicate type
            return bytes;
        }

        // Write a specific 5-byte array (type 0xDA)
        writeSpecial5ByteArray(byteArray) {
            // Original comments: 'Strange 40 array must be exactly 5 bytes long, got ' + byteArray.length
            this.writeByte(0xda);
            this.writeBytes(byteArray);
        }

        // Read a 3-float array (Point3, type 0xD6)
        readPoint3Array() {
            this._validateMarker(0xd6);
            this._validateMarker(0xc); // Marker for 12 bytes (3 floats * 4 bytes/float)
            const array = [null, null, null]; // Initialize with nulls
            for (let i = 0; i < 3; i++) {
                const floatValue = this.readFloat32();
                array[i] = floatValue;
            }
            array.type = 0xd6; // Custom property to indicate type
            return array;
        }

        // Write a 3-float array (Point3)
        writePoint3Array(array) {
            this.writeByte(0xd6);
            this.writeByte(0xc); // Marker for 12 bytes
            // Original comments: 'Point3 array must be exactly 3 floats long, got ' + array.length
            for (let i = 0; i < 3; i++) {
                // Original comments: 'Point3 array must contain only numbers, got ' + array[i] + ' at index ' + i
                this.writeFloat32(array[i]);
            }
        }

        // Read a 4-float array (Point4, type 0xD1)
        readPoint4Array() {
            this._validateMarker(0xd1);
            this._validateMarker(0x10); // Marker for 16 bytes (4 floats * 4 bytes/float)
            const array = [null, null, null, null]; // Initialize with nulls
            for (let i = 0; i < 4; i++) {
                const floatValue = this.readFloat32();
                array[i] = floatValue;
            }
            array.type = 0xd1; // Custom property to indicate type
            return array;
        }

        // Write a 4-float array (Point4)
        writePoint4Array(array) {
            this.writeByte(0xd1);
            this.writeByte(0x10); // Marker for 16 bytes
            // Original comments: 'Point4 array must be exactly 4 floats long, got ' + array.length
            for (let i = 0; i < 4; i++) {
                // Original comments: 'Point4 array must contain only numbers, got ' + array[i] + ' at index ' + i
                this.writeFloat32(array[i]);
            }
        }

        // Read a 3D point array (array of [x,y,z] float arrays, type 0x53)
        read3DPointArray() {
            this._validateMarker(0x53, "Bad 3d point array marker");
            const size = this.readByte();
            this._validateMarker(0x56); // Another marker
            const array = [];
            array.type = 0x53; // Custom property to indicate type
            for (let i = 0; i < size; i++) {
                this._validateMarker(0xc); // Marker for 12 bytes (3 floats)
                const x = this.readFloat32();
                const y = this.readFloat32();
                const z = this.readFloat32();
                array.push([x, y, z]);
            }
            return array;
        }

        // Write a 3D point array
        write3DPointArray(array) {
            this.writeByte(0x53);
            this.writeByte(array.length);
            this.writeByte(0x56);
            for (const point of array) {
                // Original comments: 'Point3 array must contain arrays of 3 floats, got ' + point.length
                // Original comments: 'Point3 array must contain only numbers, got ' + point[0] + ', ' + point[1] + ', ' + point[2]
                this.writeByte(0xc); // Marker for 12 bytes
                this.writeFloat32(point[0]);
                this.writeFloat32(point[1]);
                this.writeFloat32(point[2]);
            }
        }

        // Read any TypedValue based on its marker byte
        readAnyTypedValue() {
            const marker = this.peekByte(); // Peek to determine type
            switch (marker) {
                case 0x3:
                case 0x5:
                case 0x6:
                case 0x9:
                case 0xb:
                case 0xc:
                case 0xd:
                case 0xe:
                case 0x1b:
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    return this.readTypedNumber();
                case 0x7:
                case 0x8:
                    return this.readTypedString();
                case 0x15:
                    return this.readTypedKeyMap();
                case 0x17:
                    return this.readAnyArray();
                case 0x40:
                    return this.readArrayOfArrays();
                case 0x47:
                    return this.readStringArray();
                case 0x49:
                    return this.readVarIntArray();
                case 0x53:
                    return this.read3DPointArray();
                case 0xd1:
                    return this.readPoint4Array();
                case 0xd6:
                    return this.readPoint3Array();
                case 0xda:
                    return this.readSpecial5ByteArray();
                default:
                    throw Error(
                        `Unknown any type ${marker} at position ${this.position}`
                    );
            }
        }

        // Write any TypedValue based on its 'type' property
        writeAnyTypedValue(value) {
            // Ensure value is a TypedValue instance if it's not already
            if (!value || value.type === undefined) {
                value = TypedValue.from(value);
            }

            switch (value.type) {
                case 0x3:
                case 0x5:
                case 0x6:
                case 0x9:
                case 0xb:
                case 0xc:
                case 0xd:
                case 0xe:
                case 0x1b:
                case 0x1c:
                case 0x1e:
                case 0x20:
                case 0x22:
                    this.writeTypedNumber(value);
                    break;
                case 0x7:
                case 0x8:
                    this.writeTypedString(value);
                    break;
                case 0x15:
                    this.writeTypedKeyMap(value);
                    break;
                case 0x17:
                    this.writeAnyArray(value);
                    break;
                case 0x40:
                    this.writeArrayOfArrays(value);
                    break;
                case 0x47:
                    this.writeStringArray(value);
                    break;
                case 0x49:
                    this.writeVarIntArray(value);
                    break;
                case 0x53:
                    this.write3DPointArray(value);
                    break;
                case 0xd1:
                    this.writePoint4Array(value);
                    break;
                case 0xd6:
                    this.writePoint3Array(value);
                    break;
                case 0xda:
                    this.writeSpecial5ByteArray(value);
                    break;
                default:
                    throw Error(
                        `Unhandled any type ${value.type} when writing at position ${this.position}`
                    );
            }
        }
    }

    /**
     * Parse an incoming binary message based on leading byte signatures.
     *
     * @param {Record<string,Uint8Array>} signatureMap - map of message type -> signature bytes
     * @param {Uint8Array} rawData - raw network payload
     * @returns {TypedKeyMap|object} Parsed payload based on matched signature
     * @throws {Error} when signature is unknown
     */
    function parseBinaryMessage(signatureMap, rawData) {
        const isSignatureMatch = (expectedSignature, actualData) => {
            if (expectedSignature.length > actualData.length) {
                return false;
            }
            for (let i = 0; i < expectedSignature.length; i++) {
                if (expectedSignature[i] !== actualData[i]) {
                    return false;
                }
            }
            return true;
        };

        for (const key of Object.keys(signatureMap)) {
            const signature = signatureMap[key];
            if (isSignatureMatch(signature, rawData)) {
                return new CustomDataStream(rawData).readKeyMap(key, signature);
            }
        }
        throw Error("Unknown signature");
    }

    // =============================================================
    // WebSocket Signatures & Constants
    // - Known message signatures used to pattern-match server/client packets
    // - Magic numbers and utility constants
    // =============================================================
    /** Miscellaneous constants and magic numbers used across modules. */
    const GAME_CONSTANTS = {
        MAGIC_NUMBER_1: 0xcafe,
        MAGIC_NUMBER_2: 0xbabe,
        WEAPON_EXCLUSION_IDS: [0xcafe, 0xbabe, 0xdead],
    };

    /** Known server → client message signatures. */
    /** Known server → client message signatures used to match payloads. */
    const SERVER_MESSAGE_SIGNATURES = {
        PLAYER_UPDATE: new Uint8Array([0xf3, 0x4, 0xc9, 0x2]),
        PLAYER_MOVE: new Uint8Array([0xf3, 0x4, 0xce, 0x2]),
        PLAYER_ACTION: new Uint8Array([0xf3, 0x4, 0xc8, 0x2]),
        PLAYER_INFO: new Uint8Array([0xf3, 0x4, 0xca, 0x2]),
        PLAYER_LEAVE: new Uint8Array([0xf3, 0x4, 0xcc, 0x2]),
        ROOM_INFO: new Uint8Array([0xf3, 0x4, 0xfd, 0x3]),
        ROOM_STATE_UPDATE_1: new Uint8Array([0xf3, 0x3, 0xfc, 0x0, 0x0, 0x8, 0x0]),
        ROOM_STATE_UPDATE_2: new Uint8Array([0xf3, 0x3, 0xfd, 0x0, 0x0, 0x8, 0x0]),
        TIME_SYNC: new Uint8Array([0xf3, 0x7, 0x1, 0x0, 0x0, 0x8, 0x2]),
        PLAYER_SPAWN: new Uint8Array([0xf3, 0x4, 0xe2, 0x3]),
        UNKNOWN_MESSAGE_1: new Uint8Array([0xf3, 0x4, 0x3, 0x2]),
        PLAYER_JOIN: new Uint8Array([0xf3, 0x4, 0xff, 0x3]),
        PLAYER_REMOVE_1: new Uint8Array([0xf3, 0x4, 0xfe, 0x3]),
        PLAYER_REMOVE_2: new Uint8Array([0xf3, 0x4, 0xfe, 0x4]),
        UNKNOWN_MESSAGE_2: new Uint8Array([0xf3, 0x4, 0x2, 0x2]),
        UNKNOWN_MESSAGE_3: new Uint8Array([0xf3, 0x4, 0x6, 0x2]),
        UNKNOWN_MESSAGE_4: new Uint8Array([0xf3, 0x4, 0x7, 0x2]),
        UNKNOWN_MESSAGE_5: new Uint8Array([0xf3, 0x4, 0xd4, 0x2]),
        UNKNOWN_MESSAGE_6: new Uint8Array([0xf3, 0x4, 0xd1, 0x2]),
        UNKNOWN_MESSAGE_7: new Uint8Array([0xf3, 0x4, 0xd2, 0x2]),
        RESET_STATE_1: new Uint8Array([0xf3, 0x1, 0x0]),
        RESET_STATE_2: new Uint8Array([0xf3, 0x3, 0xe6, 0x0, 0x0, 0x8, 0x0]),
        RESET_STATE_3: new Uint8Array([0xf3, 0x3, 0xfe, 0x0, 0x0, 0x8, 0x0]),
        SERVER_STATE: new Uint8Array([0xf3, 0x3, 0xe2, 0x0, 0x0, 0x8, 0x5]),
        PLAYER_JOIN_ROOM: new Uint8Array([0xf3, 0x3, 0xe2, 0x0, 0x0, 0x8, 0x2]),
        PLAYER_LEAVE_ROOM: new Uint8Array([0xf3, 0x3, 0xe3, 0x0, 0x0, 0x8, 0x3]),
        UNKNOWN_MESSAGE_8: new Uint8Array([0xf3, 0x3, 0xe6, 0x0, 0x0, 0x8, 0x2]),
        UNKNOWN_MESSAGE_9: new Uint8Array([0xf3, 0x4, 0xdf, 0x1]),
        UNKNOWN_MESSAGE_10: new Uint8Array([0xf3, 0x3, 0xd9, 0x0, 0x0, 0x8, 0x1]),
        PLAYER_JOIN_ROOM_2: new Uint8Array([0xf3, 0x3, 0xe3, 0x0, 0x0, 0x8, 0x4]),
        UNKNOWN_MESSAGE_11: new Uint8Array([0xf3, 0x3, 0xe2, 0xf6]),
        UNKNOWN_MESSAGE_12: new Uint8Array([0xf3, 0x3, 0xe2, 0xfc]),
        UNKNOWN_MESSAGE_13: new Uint8Array([0xf3, 0x3, 0xe2, 0xfd]),
        UNKNOWN_MESSAGE_14: new Uint8Array([0xf3, 0x3, 0xe3, 0xfe]),
        UNKNOWN_MESSAGE_15: new Uint8Array([0xf3, 0x3, 0xfd, 0xfe]),
        UNKNOWN_MESSAGE_16: new Uint8Array([0xf3, 0x3, 0xe6, 0xf1]),
    };

    /** Known client → server message signatures. */
    /** Known client → server message signatures used to match payloads. */
    const CLIENT_MESSAGE_SIGNATURES = {
        PLAYER_ACTION_1: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xc9]),
        PLAYER_ACTION_2: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xce]),
        PLAYER_ACTION_3: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xc8]),
        PLAYER_ACTION_4: new Uint8Array([0xf3, 0x2, 0xfd, 0x2, 0xf4, 0x3, 0xcc]),
        GENERIC_ACTION: new Uint8Array([0xf3, 0x2, 0xfd, 0x2]),
        PLAYER_SPAWN: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf7, 0x3, 0x4, 0xf4, 0x3, 0xc8,
        ]),
        PLAYER_KILL: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf7, 0x3, 0x4, 0xf4, 0x3, 0xca,
        ]),
        PLAYER_DAMAGE: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf7, 0x3, 0x6, 0xf4, 0x3, 0xc8,
        ]),
        CHAT_MESSAGE: new Uint8Array([
            0xf3, 0x2, 0xfd, 0x3, 0xf6, 0x3, 0x1, 0xf4, 0x22,
        ]),
        UNKNOWN_ACTION_1: new Uint8Array([0xf3, 0x2, 0xfd, 0x3]),
        UNKNOWN_ACTION_2: new Uint8Array([0xf3, 0x2, 0xfd, 0x4]),
        SET_LOBBY_SKIN: new Uint8Array([0xf3, 0x2, 0xfc, 0x3]),
        UNKNOWN_ACTION_3: new Uint8Array([0xf3, 0x6, 0x1, 0x1]),
        JOIN_ROOM: new Uint8Array([0xf3, 0x2, 0xfe, 0x0]),
        UNKNOWN_ACTION_4: new Uint8Array([0xf3, 0x2, 0xe6, 0x1]),
        UNKNOWN_ACTION_5: new Uint8Array([0xf3, 0x2, 0xe3, 0x3]),
        UNKNOWN_ACTION_6: new Uint8Array([0xf3, 0x2, 0xe3, 0x9]),
        UNKNOWN_ACTION_7: new Uint8Array([0xf3, 0x2, 0xe3, 0x8]),
        SET_NICKNAME: new Uint8Array([0xf3, 0x2, 0xe2, 0x1]),
        UNKNOWN_ACTION_8: new Uint8Array([0xf3, 0x2, 0xd9, 0x3]),
        ROOM_STATE_REQUEST: new Uint8Array([0xf3, 0x2, 0xfc, 0x2]),
        UNKNOWN_ACTION_9: new Uint8Array([0xf3, 0x2, 0xe3, 0x1]),
        UNKNOWN_ACTION_10: new Uint8Array([0xf3, 0x2, 0xe2, 0x7]),
        UNKNOWN_ACTION_11: new Uint8Array([0xf3, 0x2, 0xfc, 0x4]),
    };

    // Identifiers for common message fields
    const MESSAGE_FIELD_IDS = {
        messageType: 0xf3,
        id: 0xfe,
        name: 0xff,
        content: 0xf5,
        playerData: 0xf9, // 'Js'
        roomData: 0xfb, // 'zs'
        playerState: 0xf8, // 'Zs'
        playerType: new TypedValue(0x22, null), // 'js'
        tag: new TypedValue(0x3, 0x7), // 'tag'
        action: new TypedValue(0x3, 0x5), // 'action'
        timestamp: new TypedValue(0x3, 0x2), // 'timestamp'
    };

    const CLASSES = {
        NONE: -1,
        SOLDIER: 0x0,
        HITMAN: 0x1,
        GUNNER: 0x2,
        HEAVY: 0x3,
        ROCKETEER: 0x4,
        AGENT: 0x5,
        BRAWLER: 0x6,
        INVESTOR: 0x7,
        ASSASSIN: 0x8,
        JUGGERNAUT: 0x9,
        RECON: 0xa,
        PYRO: 0xb,
        RAYBLADER: 0xc,

        getId(name) {
            switch (name.toLowerCase()) {
                case "soldier":
                    return this.SOLDIER;
                case "hitman":
                    return this.HITMAN;
                case "gunner":
                    return this.GUNNER;
                case "heavy":
                    return this.HEAVY;
                case "rocketeer":
                    return this.ROCKETEER;
                case "agent":
                    return this.AGENT;
                case "brawler":
                    return this.BRAWLER;
                case "investor":
                    return this.INVESTOR;
                case "assassin":
                    return this.ASSASSIN;
                case "juggernaut":
                    return this.JUGGERNAUT;
                case "recon":
                    return this.RECON;
                case "pyro":
                    return this.PYRO;
                case "rayblader":
                    return this.RAYBLADER;
                default:
                    return this.NONE;
            }
        },

        getName(id) {
            switch (id) {
                case this.SOLDIER:
                    return "Soldier";
                case this.HITMAN:
                    return "Hitman";
                case this.GUNNER:
                    return "Gunner";
                case this.HEAVY:
                    return "Heavy";
                case this.ROCKETEER:
                    return "Rocketeer";
                case this.AGENT:
                    return "Agent";
                case this.BRAWLER:
                    return "Brawler";
                case this.INVESTOR:
                    return "Investor";
                case this.ASSASSIN:
                    return "Assassin";
                case this.JUGGERNAUT:
                    return "Juggernaut";
                case this.RECON:
                    return "Recon";
                case this.PYRO:
                    return "Pyro";
                case this.RAYBLADER:
                    return "Rayblader";
                default:
                    return "None";
            }
        },
    };

    const MAPS = {
        NONE: -1,
        HAVANA: 0x1,
        SNOWSTORM: 0x2,
        NEWTOWN: 0x3,
        KOURHOUSE: 0x4,
        GHOST_TOWN: 0x5,
        LEGION_HQ: 0x6,
        KOUR_SURF: 0x7,
        KOUR2: 0x8,
        OLDSTORM: 0x9,
        BATTLE_ROYALE: 0xa,
        KOUR3: 0xb,
        SKYLINE: 0xc,
        MOON_SNIPE: 0xd,
        KOUR_CRAFT: 0xe,
        PARKOUR: 0xf,
        UNDERKOUR: 0x10,

        getName(id) {
            switch (id) {
                case this.HAVANA:
                    return "Havana";
                case this.SNOWSTORM:
                    return "Snowstorm";
                case this.NEWTOWN:
                    return "Newtown";
                case this.KOURHOUSE:
                    return "Kourhouse";
                case this.GHOST_TOWN:
                    return "Ghost Town";
                case this.LEGION_HQ:
                    return "Legion HQ";
                case this.KOUR_SURF:
                    return "Kour Surf";
                case this.KOUR2:
                    return "Kour2";
                case this.OLDSTORM:
                    return "OldStorm";
                case this.BATTLE_ROYALE:
                    return "Battle Royale";
                case this.KOUR3:
                    return "Kour3";
                case this.SKYLINE:
                    return "Skyline";
                case this.MOON_SNIPE:
                    return "Moon Snipe";
                case this.KOUR_CRAFT:
                    return "Kour Craft";
                case this.PARKOUR:
                    return "Parkour";
                case this.UNDERKOUR:
                    return "Underkour";
                default:
                    return "Unknown";
            }
        },
    };

    const GAME_MODES = {
        NONE: -1,
        FFA: 0x1,
        TDM: 0x2,
        GUN_GAME: 0x3,
        FFA35: 0x4,
        HARDPOINT: 0x6,
        KOUR_SURF: 0x7,
        KOUR_STRIKE: 0x8,
        BATTLE_ROYALE: 0x9,
        MOON_SNIPE: 0xa,
        KOUR_CRAFT: 0xb,
        PARKOUR: 0xc,

        getName(id) {
            switch (id) {
                case this.FFA:
                    return "FFA";
                case this.TDM:
                    return "TDM";
                case this.GUN_GAME:
                    return "Gun Game";
                case this.FFA35:
                    return "FFA35";
                case this.HARDPOINT:
                    return "Hardpoint";
                case this.KOUR_SURF:
                    return "Kour Surf";
                case this.KOUR_STRIKE:
                    return "Kour Strike";
                case this.BATTLE_ROYALE:
                    return "Battle Royale";
                case this.MOON_SNIPE:
                    return "Moon Snipe";
                case this.KOUR_CRAFT:
                    return "Kour Craft";
                case this.PARKOUR:
                    return "Parkour";
                default:
                    return "Unknown";
            }
        },
    };

    // =============================================================
    // Player Module: Handles all player data and state
    // =============================================================

    class Player {
        id = 0;
        tag = 0; // In-game entity tag
        uid = null; // Firebase User ID
        kills = 0;
        deaths = 0;
        score = 0;
        skinIndex = 0;
        hatIndex = 0;
        isCheater = 0; // Flag for detected cheats
        lastDeathTime = null; // Timestamp of last death
        bounty = 0; // Points for killing this player
        isInvisible = false; // Cheat detection flag
        invisibleCount = 0; // Count of invisibility detections
        isInstakilling = false; // Cheat detection flag
        instakillCount = 0; // Count of instakill detections
        isMoonSniping = false; // Cheat detection flag
        moonSnipeCount = 0; // Count of moon snipe detections
        lastActionTime = 0; // Timestamp of last action
        lastDamageTime = 0; // Timestamp of last damage
        lastWeaponId = 0;
        lastActionId = 0;
        lastTimestamp = 0; // Last timestamp from server message
        isDead = false;

        constructor(id) {
            this.id = id;
            this.setName(null); // Initialize name
        }

        setName(name) {
            if (!(name !== null && name !== "")) {
                name = `Guest_${this.id}`;
            }
            this.rawName = name; // Original name, potentially with HTML tags
            let cleanName = name.replace(/<[^>]+>/g, ""); // Remove HTML tags
            if (!cleanName) {
                name += `Noob_${this.id}`;
                cleanName = `Noob_${this.id}`;
            }
            this.displayName = cleanName; // Cleaned name for display
            this.searchableName = this.prepareSearchableName(cleanName); // Lowercase, no special chars for search
        }

        // Calculates total cheat detections
        get totalCheatDetections() {
            return (
                this.invisibleCount +
                this.instakillCount +
                this.moonSnipeCount
            );
        }

        // Checks if any cheat flags are active
        get hasActiveCheats() {
            return (
                this.isInvisible ||
                this.isInstakilling ||
                this.isMoonSniping
            );
        }

        // Resets all cheat detection flags
        resetCheatFlags() {
            this.isInvisible = false;
            this.isInstakilling = false;
            this.isMoonSniping = false;
        }

        // Prepares a name for searching/matching (removes special chars, converts to lowercase)
        prepareSearchableName(name) {
            const replacements = {
                0: "o",
                1: "i",
                3: "e",
                4: "a",
                5: "s",
                7: "t",
            };
            return (name = (name = (name = (name = (name = (name = (name = (name =
                (name = name
                    .replace(/[\n\r]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()).replace(
                        /^\[[a-zA-Z0-9]{1,4}\]/,
                        ""
                    )).replace(/\.[a-zA-Z0-9]{1,4}$/, "")).replace(
                        /(?<=[a-zA-Z])[013457](?=[a-zA-Z])/g,
                        (char) => replacements[+char]
                    )).replace(/([a-z])([A-Z])/g, "$1 $2")).replace(
                        /([a-zA-Z])([0-9])/g,
                        "$1 $2"
                    )).replace(/([0-9])([a-zA-Z])/g, "$1 $2")).replace(/[_\.,]/g, " "))
                .replace(/\s+/g, " ")
                .trim())
                .toLowerCase()
                .replace("kour", "kour ");
        }
    }

    // =============================================================
    // Web Socket Module: Handles all intercepting for incoming and outgoing messages
    // =============================================================

    // Lightweight helper to manage server time sync and lag compensation
    class LagCompensator {
        constructor() {
            this.rate = null; // e.g., 2 or -2
            this.offset = 0; // last known server timestamp
            this.lastSyncClientTs = 0; // Date.now() at last sync
        }

        reset() {
            this.rate = null;
            this.offset = 0;
            this.lastSyncClientTs = 0;
        }

        handleTimeSync(serverTimestamp) {
            try {
                if (this.offset && !this.rate) {
                    this.rate = serverTimestamp > this.offset ? 2 : -2;
                }
                this.offset = serverTimestamp;
                this.lastSyncClientTs = Date.now();
            } catch (_e) { /* ignore */ }
        }

        getLagCompensation(messageTimestamp) {
            try {
                if (!this.lastSyncClientTs || !this.rate) return 0;
                const localElapsedMs = Date.now() - this.lastSyncClientTs;
                const estimatedServerTs = this.offset + localElapsedMs * this.rate;
                return Math.abs(estimatedServerTs - messageTimestamp);
            } catch (_e) {
                return 0;
            }
        }
    }

    // Centralizes cheat detection logic with clear, testable methods
    class CheatDetector {
        static detectInvisibility(player, timestamp, lagCompensation) {
            try {
                if (
                    !GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp) &&
                    player.lastDamageTime + lagCompensation <= Date.now() &&
                    player.lastDeathTime
                ) {
                    if (2000 > Date.now() - player.lastDeathTime - lagCompensation) {
                        return; // still in grace period
                    }
                    player.invisibleCount++;
                    if (!player.isInvisible) {
                        player.isInvisible = true;
                        if (player.isCheater === 0) player.isCheater = 1;
                        try { window.NovaAPI && window.NovaAPI.error && window.NovaAPI.error(`${player.displayName} is invisible`); } catch (_e) {}
                    }
                }
            } catch (_e) { /* ignore */ }
        }

        static detectInstakill(player, actionId, timestamp, lagCompensation) {
            try {
                if (
                    !(
                        GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp) ||
                        player.lastDamageTime + lagCompensation > Date.now()
                    )
                ) {
                    if (player.lastActionId === actionId && player.lastWeaponId === timestamp) {
                        player.instakillCount++;
                        if (!player.isInstakilling) {
                            player.isInstakilling = true;
                            if (player.isCheater === 0) player.isCheater = 1;
                            try { window.NovaAPI && window.NovaAPI.error && window.NovaAPI.error(`${player.displayName} is instakilling`); } catch (_e) {}
                        }
                    }
                }
            } catch (_e) { /* ignore */ }
        }

        static detectMoonSnipe(player, currentGameModeId, horizontalSpeed, horizontalDistance, verticalSpeed, verticalDistance, unknownValue, timestamp, lagCompensation) {
            try {
                if (GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp)) return;
                switch (currentGameModeId) {
                    case GAME_MODES.MOON_SNIPE:
                    case GAME_MODES.KOUR_CRAFT:
                        return; // expected high movement
                }
                if (!(player.lastActionTime + lagCompensation > Date.now())) {
                    if (
                        (horizontalSpeed > 45 && horizontalDistance > 2) ||
                        horizontalDistance > 18 ||
                        (verticalSpeed > 35 && verticalDistance > 2) ||
                        verticalDistance > 3 ||
                        unknownValue > 210
                    ) {
                        player.moonSnipeCount++;
                        if (!player.isMoonSniping) {
                            player.isMoonSniping = true;
                            if (player.isCheater === 0) player.isCheater = 1;
                            try { window.NovaAPI && window.NovaAPI.error && window.NovaAPI.error(`${player.displayName} is moon sniping`); } catch (_e) {}
                        }
                    }
                }
            } catch (_e) { /* ignore */ }
        }
    }

    /**
     * WebSocketModule: intercepts the game WebSocket, parses known binary
     * message signatures, tracks Player entities and room state, and relays
     * chat frames to ChatModule. Exposes convenient helpers like
     * sendChatMessage and flags like isMapPlaying for UI modules.
     */
    const WebSocketModule = {
        currentUser: null,
        isGameWebSocketActive: false,
        localPlayer: new Player(0x1), // Represents the current user's player object
        otherPlayers: new Map(), // Map of other players in the game (id -> Player object)
        isMapPlaying: false, // True if a game map is currently active
        skinCycleIntervalId: 0, // Interval ID for skin/hat cycling
        danceTimerId: 0, // Timeout ID for dance duration
        playerWhoKilledMe: null, // Player who last killed the local player
        currentMapId: null,
        currentGameModeId: null,
        unknownGameValue1: 0,
        unknownGameValue2: 0,
        timeSyncOffset: 0, // Offset for time synchronization
        lastTimeSyncTimestamp: 0, // Last timestamp from time sync message
        timeSyncRate: null, // Rate of time sync (e.g., 2 or -2)
        menuDisplayTimeoutId: 0, // Timeout for menu display
        lag: new LagCompensator(),

        // Getters for current user status
        get isLoggedIn() { return true; },
        get userId() { return "local"; },

        // Intercepts game WebSocket messages (binary)
        interceptGameWebSocket(ws) {
            this.isGameWebSocketActive = true;
            const originalSend = ws.send;
            const originalOnMessage = ws.onmessage;

            ws.onmessage = (event) => {
                const data = new Uint8Array(event.data);
                // Only process if data exists, user is logged in, and tamper check passes
                if (data.length === 0) {
                    return originalOnMessage.call(ws, event);
                }
                try {
                    // Feed raw frame to ChatModule for typed-string extraction
                    try { ChatModule.ingestFrame(data); } catch (_e) {}
                    const processedData = this.processIncomingGameMessage(data);
                    if (processedData !== null) {
                        if (processedData.length === 0) {
                            return; // Message was consumed/filtered
                        }
                        // Create a new MessageEvent with processed data
                        const newEvent = new MessageEvent("message", {
                            data: processedData,
                            origin: event.origin,
                            lastEventId: event.lastEventId,
                            source: event.source,
                            ports: event.ports,
                        });
                        return originalOnMessage.call(ws, newEvent);
                    }
                } catch (error) {
                    // Log error but still pass original message
                }
                return originalOnMessage.call(ws, event); // Pass original message if processing fails
            };

            ws.send = (data) => {
                const byteArray = new Uint8Array(data);
                // Only process if data exists, user is logged in, and tamper check passes
                if (byteArray.length === 0) {
                    return originalSend.call(ws, data);
                }
                try {
                    const processedData = this.processOutgoingGameMessage(byteArray);
                    if (processedData !== null) {
                        if (processedData.length === 0) {
                            return; // Message was consumed/filtered
                        }
                        return originalSend.call(ws, processedData.buffer); // Send processed data
                    }
                } catch (error) {
                    // Log error but still pass original message
                }
                return originalSend.call(ws, data); // Pass original message if processing fails
            };
        },

        // Cleans up game WebSocket interception
        cleanupGameWebSocket(ws) {
            this.isGameWebSocketActive = false;
        },

        // Processes incoming game binary messages
        processIncomingGameMessage(data) {
            const parsedMessage = parseBinaryMessage(SERVER_MESSAGE_SIGNATURES, data);
            let result = null;

            try {
                switch (parsedMessage.signature) {
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_UPDATE:
                        result = this.handlePlayerUpdate(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_MOVE:
                        result = this.handlePlayerMove(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_ACTION:
                        result = this.handlePlayerAction(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.ROOM_INFO:
                        result = this.handleRoomInfo(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_INFO:
                        result = this.handlePlayerInfo(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_JOIN:
                        result = this.handlePlayerJoin(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_REMOVE_1:
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_REMOVE_2:
                        result = this.handlePlayerRemove(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.SERVER_STATE:
                        result = this.handleServerState(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.PLAYER_JOIN_ROOM_2:
                        result = this.handlePlayerJoinRoom(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.TIME_SYNC:
                        result = this.handleTimeSync(parsedMessage);
                        break;
                    case SERVER_MESSAGE_SIGNATURES.RESET_STATE_1:
                    case SERVER_MESSAGE_SIGNATURES.RESET_STATE_2:
                    case SERVER_MESSAGE_SIGNATURES.RESET_STATE_3:
                        // Reset time sync and player list on state reset messages
                        try { this.lag.reset(); } catch (_e) {}
                        this.timeSyncRate = null;
                        this.timeSyncOffset = 0;
                        this.lastTimeSyncTimestamp = 0;
                        this.resetPlayerList();
                        result = null; // Consume message
                        break;
                    default:
                        result = null; // Pass original message by default
                }
            } catch (error) {
                // console.error('Error processing incoming game message:', error);
                result = null; // Pass original message if processing fails
            }

            if (result !== null) {
                if (result === KeyMap.EMPTY) {
                    // Special marker to indicate message should be consumed
                    return new Uint8Array(0); // Return empty array to consume
                }
                const stream = new CustomDataStream();
                stream.writeKeyMap(result);
                return stream.data;
            }
            return null; // Pass original message
        },

        // Processes outgoing game binary messages
        processOutgoingGameMessage(data) {
            const parsedMessage = parseBinaryMessage(CLIENT_MESSAGE_SIGNATURES, data);
            let result = null;

            try {
                switch (parsedMessage.signature) {
                    case CLIENT_MESSAGE_SIGNATURES.PLAYER_ACTION_3: // Player Spawn
                        result = this.handleOutgoingPlayerSpawn(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.SET_LOBBY_SKIN: // Set Lobby Skin
                        result = this.handleOutgoingSetLobbySkin(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.PLAYER_KILL: // Player Kill
                        result = this.handleOutgoingPlayerKill(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.PLAYER_DAMAGE: // Player Damage
                        result = this.handleOutgoingPlayerDamage(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.CHAT_MESSAGE: // Chat Message
                        result = this.handleOutgoingChatMessage(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.SET_NICKNAME: // Set Nickname
                        result = this.handleOutgoingSetNickname(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.ROOM_STATE_REQUEST: // Room State Request
                        result = this.handleOutgoingRoomStateRequest(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.UNKNOWN_ACTION_6: // Unknown action related to player state
                        result = this.handleOutgoingUnknownAction6(parsedMessage);
                        break;
                    case CLIENT_MESSAGE_SIGNATURES.UNKNOWN_ACTION_7: // Unknown action related to player state
                        result = this.handleOutgoingUnknownAction7(parsedMessage);
                        break;
                    default:
                        result = null; // Pass original message by default
                }
            } catch (error) {
                // console.error('Error processing outgoing game message:', error);
                result = null; // Pass original message if processing fails
            }

            if (result !== null) {
                if (result === KeyMap.EMPTY) {
                    // Special marker to indicate message should be consumed
                    return new Uint8Array(0); // Return empty array to consume
                }
                const stream = new CustomDataStream();
                stream.writeKeyMap(result);
                return stream.data;
            }
            return null; // Pass original message
        },

        // --- Game Message Handlers (Incoming) ---

        // Handles player update messages (movement, position)
        handlePlayerUpdate(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const player = this.getPlayer(playerId);
            if (!player) return null; // Player not found

            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            const actionId = messageContent[0].value; // Action ID (e.g., weapon ID)

            // Bypass checks for specific weapon IDs (e.g., for legitimate actions)
            if (GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(actionId)) {
                return null;
            }

            const playerState = messageContent[2]; // Array containing player position, velocity etc.
            const playerTag = playerState[0].value; // Player's in-game tag
            if (playerTag !== player.tag) {
                return null; // Mismatch in player tag, ignore
            }

            const velocity = playerState[6]; // Velocity array [x,y,z,w]
            // If velocity is [1,0,0,0], it's likely a default/idle state, ignore
            if (
                velocity[0] === 1 &&
                velocity[1] === 0 &&
                velocity[2] === 0 &&
                velocity[3] === 0
            ) {
                return null;
            }
            // If Y or W velocity is non-zero, ignore (likely normal movement)
            if (velocity[1] !== 0 || velocity[3] !== 0) {
                return null;
            }

            // If time sync rate is not established, ignore
            if (!this.timeSyncRate) {
                return null;
            }

            const currentTimestamp = actionId; // Timestamp from the message
            const position = playerState[5]; // Player position [x,y,z]

            // Initialize last timestamp for player if not set
            if (player.lastTimestamp === 0) {
                player.lastTimestamp = currentTimestamp;
                return null;
            }

            // Calculate time elapsed since last update
            const timeElapsed =
                (currentTimestamp - player.lastTimestamp) / this.timeSyncRate;
            if (timeElapsed < 1) {
                return null; // Not enough time elapsed for meaningful calculation
            }

            // Calculate horizontal distance moved
            const horizontalDistance = Math.hypot(position[0], position[2]);
            const horizontalSpeed = (horizontalDistance / timeElapsed) * 1000; // Speed in units/second

            // Calculate vertical distance moved
            const verticalDistance = position[1] > 0 ? position[1] : 0;
            const verticalSpeed = (verticalDistance / timeElapsed) * 1000; // Speed in units/second

            // Calculate lag compensation
            const lagCompensation = this.getLagCompensation(currentTimestamp);

            // Update max speed/distance for debugging/analysis
            if (player.lastActionTime + lagCompensation < Date.now()) {
                // This block seems to track max observed speeds/distances for players
                // It's likely for internal analysis of potential cheat thresholds
                if (horizontalSpeed > this.maxHorizontalSpeed) {
                    this.maxHorizontalSpeed = horizontalSpeed;
                }
                if (horizontalDistance > this.maxHorizontalDistance) {
                    this.maxHorizontalDistance = horizontalDistance;
                }
                if (verticalSpeed > this.maxVerticalSpeed) {
                    this.maxVerticalSpeed = verticalSpeed;
                }
                if (verticalDistance > this.maxVerticalDistance) {
                    this.maxVerticalDistance = verticalDistance;
                }
            }

            // Detect moon sniping
            this.detectMoonSnipe(
                player,
                horizontalSpeed,
                horizontalDistance,
                verticalSpeed,
                verticalDistance,
                0,
                currentTimestamp,
                lagCompensation
            );

            player.lastTimestamp = currentTimestamp; // Update last timestamp for player
            return null; // Consume message (or pass original if no modification)
        },

        // Handles player move messages (less detailed than update)
        handlePlayerMove(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const actionId = message.get(MESSAGE_FIELD_IDS.content)[0].value; // Action ID (e.g., weapon ID)
            const player = this.getPlayer(playerId);
            if (!player) return null;

            // Bypass checks for specific weapon IDs
            if (GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(actionId)) {
                return null;
            }

            this.getLagCompensation(actionId); // Calculate lag compensation (unused result)
            player.unknownValue = 0; // Reset unknown value
            player.lastTimestamp = actionId; // Update last timestamp
            return null;
        },

        // Handles player action messages (e.g., shooting, taking damage, dying)
        handlePlayerAction(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            const timestamp = messageContent.get(MESSAGE_FIELD_IDS.timestamp).value;
            const actionId = messageContent.get(MESSAGE_FIELD_IDS.action)?.value;
            const player = this.getPlayer(playerId);
            if (!player) return null;

            const lagCompensation = this.getLagCompensation(timestamp);

            switch (actionId) {
                case 0x2: // Unknown action
                case 0x8: // Unknown action
                case 0x9: // Unknown action
                case 0xa: // Unknown action
                case 0xd: // Unknown action
                case 0x10: // Unknown action
                case 0x11: // Unknown action
                case 0x14: // Unknown action
                case 0xc: // Unknown action
                case 0xe: // Unknown action
                case 0x1d: // Unknown action
                case 0x1e: // Unknown action
                case 0x1f: // Unknown action
                case 0x20: // Unknown action
                case 0x22: // Unknown action
                case 0x23: // Unknown action
                    // Do nothing for these actions
                    break;
                case 0x3: // Player took damage/died
                    {
                        const damageInfo = messageContent.get(new TypedValue(0x3, 0x4)); // Damage info array
                        const targetPlayerTag = damageInfo[2].value;
                        const damageAmount = damageInfo[3].value;

                        if (targetPlayerTag !== -1) {
                            // If target is a valid player
                            if (this.localPlayer.tag === targetPlayerTag) {
                                // If local player is the target
                                player.bounty += damageAmount; // Add to bounty (points for killing this player)

                            } else {
                                // Find the target player in the list (unused result)
                                Array.from(this.otherPlayers.values()).find(
                                    (p) => p.tag === targetPlayerTag
                                );
                            }
                        }
                        this.detectInstakill(player, actionId, timestamp, lagCompensation);
                        this.detectInvisibility(
                            player,
                            actionId,
                            timestamp,
                            lagCompensation
                        );
                        const unknownLength = damageInfo[0].length; // Unknown length value
                        this.detectMoonSnipe(
                            player,
                            0,
                            0,
                            0,
                            0,
                            damageAmount / unknownLength,
                            timestamp,
                            lagCompensation
                        );
                    }
                    break;
                case 0x4: // Player killed another player
                    {
                        const killInfo = messageContent.get(new TypedValue(0x3, 0x4));
                        const killedPlayerTag = killInfo[0].value;
                        const killedPlayer = Array.from(this.otherPlayers.values()).find(
                            (p) => p.tag === killedPlayerTag
                        );

                        if (killedPlayer) {
                            killedPlayer.lastDeathTime = Date.now(); // Mark as dead

                        } else if (this.localPlayer.tag === killedPlayerTag) {
                            this.localPlayer.lastDeathTime = Date.now(); // Local player died
                            this.playerWhoKilledMe = player; // Store who killed local player
                        }
                        this.detectInvisibility(
                            player,
                            actionId,
                            timestamp,
                            lagCompensation
                        );
                    }
                    break;
                case 0xb: // Unknown action
                    this.detectInvisibility(player, actionId, timestamp, lagCompensation);
                    this.detectInstakill(player, actionId, timestamp, lagCompensation);
                    break;
                case 0xf: // Player healed
                    player.lastActionTime = Date.now() + 1000; // Set action time for healing
                    break;
                case 0x12: // Unknown action
                    this.detectInvisibility(player, actionId, timestamp, lagCompensation);
                    break;
            }

            // Update player's last action details
            if (!GAME_CONSTANTS.WEAPON_EXCLUSION_IDS.includes(timestamp)) {
                player.lastWeaponId = timestamp; // This seems to be weapon ID, not timestamp
            }
            player.lastActionId = actionId;
            return null;
        },

        // Handles room info messages (map, mode, player list)
        handleRoomInfo(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const roomData = message.get(MESSAGE_FIELD_IDS.roomData);
            this.updateRoomInfo(roomData); // Update global room info

            // If player is not in our list, add them
            if (!this.otherPlayers.has(playerId)) {
                this.localPlayer.id; // Original code had this, likely a debug check
            }
            const player = this.getPlayer(playerId, "info"); // Get or create player object
            this.updatePlayerInfo(player, roomData); // Update player details

            return null; // Consume message
        },

        // Handles player info messages (initial player data)
        handlePlayerInfo(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            this.otherPlayers.has(playerId); // Check if player already exists (original debug)
            const player = this.getPlayer(playerId, "init"); // Get or create player object

            const unknownValue = messageContent.get(new TypedValue(0x3, 0x6)).value;
            const playerTag = messageContent.get(MESSAGE_FIELD_IDS.tag).value;

            switch (messageContent.get(MESSAGE_FIELD_IDS.playerType)) {
                case "Player":
                    break;
                case "WorldGrenade":
                case "SpectateCamera":
                default:
                    return null; // Ignore non-player entities
            }

            player.tag = playerTag;
            player.lastDeathTime = null; // Reset death time
            player.unknownValue = unknownValue;
            player.lastWeaponId = 0;
            player.lastActionId = 0;
            player.lastTimestamp = 0;

            // Reset cheat detection counts if player is new or has no detections
            if (player.totalCheatDetections === 0) {
                player.lastActionTime = Date.now() + 2000; // Give grace period
                player.lastDamageTime = Date.now() + 2000; // Give grace period
            } else {
                player.lastActionTime = 0; // Reset grace period if cheats detected
                player.lastDamageTime = 0; // Reset grace period if cheats detected
            }

            return null; // Consume message
        },

        // Handles player join messages
        handlePlayerJoin(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            const player = this.getPlayer(playerId, "join"); // Get or create player object
            this.updatePlayerInfo(player, playerData); // Update player details
            this.updateRoomInfo(playerData); // Update room info

            return null; // Consume message
        },

        // Handles player remove/leave messages
        handlePlayerRemove(message) {
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            if (!this.otherPlayers.has(playerId)) {
                throw Error("Leave/Remove fail: Player not found");
            }
            const player = this.otherPlayers.get(playerId);
            this.otherPlayers.delete(playerId); // Remove player from map

            return null; // Consume message
        },

        // Handles server state messages (initial game state)
        handleServerState(message) {
            const playerState = message.get(MESSAGE_FIELD_IDS.playerState);
            this.updateRoomInfo(playerState); // Update room info
            this.localPlayer.id = message.get(MESSAGE_FIELD_IDS.id).value; // Set local player ID

            // Iterate through players in the message and update/add them
            message
                .get(MESSAGE_FIELD_IDS.playerData)
                .forEach((playerData, typedPlayerId) => {
                    const playerId = typedPlayerId.value;
                    const player = this.getPlayer(playerId, "welcome/join"); // Get or create player object
                    this.updatePlayerInfo(player, playerData); // Update player details
                });

            return null; // Consume message
        },

        // Handles player join room messages
        handlePlayerJoinRoom(message) {
            const playerState = message.get(MESSAGE_FIELD_IDS.playerState);
            const playerId = message.get(MESSAGE_FIELD_IDS.id).value;
            this.localPlayer.id = playerId; // Set local player ID
            this.updateRoomInfo(playerState); // Update room info

            // Check if player exists in our list, if not, add them
            if (
                playerState.has("C0") &&
                playerState.has("C1") &&
                playerState.has("C2")
            ) {
                this.currentMapId = playerState.get("C0")?.value;
                this.currentGameModeId = playerState.get("C1")?.value;
                playerState.get("C2"); // Unknown value
                message.get(MESSAGE_FIELD_IDS.timestamp); // Timestamp
                MAPS.getName(this.currentMapId); // Get map name (original debug)
                GAME_MODES.getName(this.currentGameModeId); // Get mode name (original debug)
            }
            return null; // Consume message
        },

        // Handles time synchronization messages
        handleTimeSync(message) {
            message.get(0x1).value; // Unknown value
            const serverTimestamp = message.get(0x2).value; // Server timestamp

            // Delegate to LagCompensator and mirror legacy fields
            try { this.lag.handleTimeSync(serverTimestamp); } catch (_e) {}
            this.timeSyncRate = this.lag.rate;
            this.timeSyncOffset = this.lag.offset;
            this.lastTimeSyncTimestamp = this.lag.lastSyncClientTs;
            return null; // Consume message
        },

        // --- Helper Functions for Player/Room Data Management ---

        // Gets or creates a Player object
        getPlayer(id, source = "") {
            if (id === this.localPlayer.id) {
                return this.localPlayer;
            }
            if (this.otherPlayers.has(id)) {
                return this.otherPlayers.get(id);
            }
            const newPlayer = new Player(id);
            newPlayer.lastActionTime = Date.now() + 2000; // Grace period for new players
            newPlayer.lastDamageTime = Date.now() + 2000; // Grace period for new players
            this.otherPlayers.set(id, newPlayer);
            return newPlayer;
        },

        // Updates a player's information from a message
        updatePlayerInfo(player, playerData) {
            let changed = false;
            if (playerData.has(MESSAGE_FIELD_IDS.name)) {
                const name = playerData.get(MESSAGE_FIELD_IDS.name);
                if (name) {
                    player.setName(name);
                }
                changed = true;
            }
            if (playerData.has("uid")) {
                const uid = playerData.get("uid");
                changed |= player.uid !== uid;
                player.uid = uid;
            }
            if (playerData.has("kills")) {
                const kills = playerData.get("kills").value ?? 0;
                player.kills = kills;
            }
            if (playerData.has("deaths")) {
                const deaths = playerData.get("deaths").value ?? 0;
                player.deaths = deaths;
            }
            if (playerData.has("score")) {
                const score = playerData.get("score").value ?? 0;
                player.score = score;
            }
            return changed;
        },

        // Updates global room information from a message
        updateRoomInfo(roomData) {
            let changed = false;
            if (roomData.has("C0")) {
                this.currentGameModeId = roomData.get("C0").value;
                changed = true;
            }
            if (roomData.has("C1")) {
                this.currentMapId = roomData.get("C1").value;
                changed = true;
            }
            if (roomData.has("C2")) {
                this.unknownGameValue1 = roomData.get("C2").value;
                changed = true;
            }
            if (roomData.has("C5")) {
                this.unknownGameValue2 = roomData.get("C5")?.value;
                changed = true;
            }
            if (changed) {
                MAPS.getName(this.currentMapId); // Original debug
                GAME_MODES.getName(this.currentGameModeId); // Original debug
            }
            return changed;
        },

        // Resets player list and game state
        resetPlayerList() {
            this.localPlayer.id = 0;
            this.otherPlayers.clear();

        },

        // --- Cheat Detection Logic ---

        // Calculates lag compensation based on time sync
        getLagCompensation(messageTimestamp) {
            try {
                return this.lag.getLagCompensation(messageTimestamp);
            } catch (_e) { return 0; }
        },

        // Detects invisibility cheat
        detectInvisibility(player, actionId, timestamp, lagCompensation) {
            CheatDetector.detectInvisibility(player, timestamp, lagCompensation);
        },

        // Detects instakill cheat
        detectInstakill(player, actionId, timestamp, lagCompensation) {
            CheatDetector.detectInstakill(player, actionId, timestamp, lagCompensation);
        },

        // Detects moon sniping cheat
        detectMoonSnipe(
            player,
            horizontalSpeed,
            horizontalDistance,
            verticalSpeed,
            verticalDistance,
            unknownValue,
            timestamp,
            lagCompensation
        ) {
            CheatDetector.detectMoonSnipe(
                player,
                this.currentGameModeId,
                horizontalSpeed,
                horizontalDistance,
                verticalSpeed,
                verticalDistance,
                unknownValue,
                timestamp,
                lagCompensation
            );
        },

        // --- Game Message Handlers (Outgoing) ---

        // Handles outgoing player spawn messages (currently a no-op)
        handleOutgoingPlayerSpawn: (message) => {
            // message.get(MESSAGE_FIELD_IDS.content).get(MESSAGE_FIELD_IDS.action); // Original debug
            return null;
        },

        // Handles outgoing set lobby skin messages
        handleOutgoingSetLobbySkin(message) {
            const playerState = message.get(MESSAGE_FIELD_IDS.roomData);
            if (playerState.has("characterSkinIndex")) {
                this.localPlayer.skinIndex =
                    playerState.get("characterSkinIndex").value;
            }
            if (playerState.has("hatIndex")) {
                this.localPlayer.hatIndex = playerState.get("hatIndex").value;
            }
            this.removePlayerRankAndLevel(playerState); // Remove rank/level from message
            return message; // Return modified message
        },

        // Handles outgoing player kill messages
        handleOutgoingPlayerKill(message) {
            const messageContent = message.get(MESSAGE_FIELD_IDS.content);
            const action = messageContent.get(MESSAGE_FIELD_IDS.action)?.value;
            if (action === 4) {
                // Action 4 is likely a kill action
                const targetTag = messageContent.get(new TypedValue(0x3, 0x4))[0].value;
                const targetPlayer = Array.from(this.otherPlayers.values()).find(
                    (p) => p.tag === targetTag
                );
                if (targetPlayer) {
                    targetPlayer.lastDeathTime = Date.now(); // Mark target as dead

                } else if (targetTag === this.localPlayer.tag) {
                    this.localPlayer.lastDeathTime = Date.now(); // Local player died
                }
            }
            return null; // Consume message
        },

        // Handles outgoing player damage messages
        handleOutgoingPlayerDamage(message) {
            const messageContent = message.get(MESSAGE_FIELD_IDS.content)[0];
            const killStreakMatch = messageContent.match(
                /<color=#d6b300>(\d+)<\/color>\s*Kill Streak/
            );
            const killStreak = killStreakMatch ? parseInt(killStreakMatch[1]) : null;
            if (killStreak) {
                this.handleKillStreak(killStreak);
            }
            return null; // Consume message
        },

        // Handles outgoing chat messages
        handleOutgoingChatMessage(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            this.removePlayerRankAndLevel(playerData); // Remove rank/level from message
            return message; // Return modified message
        },

        // Handles outgoing set nickname messages
        handleOutgoingSetNickname(message) {
            // This function seems to modify the nickname in the outgoing message
            // It sets the name to null and removes rank/level
            const name = message.get(MESSAGE_FIELD_IDS.name);
            const lastChar = name.charAt(name.length - 1);
            const newName = null.toLowerCase() + lastChar; // This will result in "null" + lastChar
            message.set(MESSAGE_FIELD_IDS.name, newName);
            return message; // Return modified message
        },

        // Handles outgoing room state request messages
        handleOutgoingRoomStateRequest(message) {
            const roomData = message.get(MESSAGE_FIELD_IDS.roomData);
            if (roomData.has("C0") && roomData.has("C1")) {
                this.currentMapId = roomData.get("C0")?.value;
                this.currentGameModeId = roomData.get("C1")?.value;
                roomData.get("C2"); // Unknown value
                this.unknownGameValue2 = roomData.get("C5")?.value;
                MAPS.getName(this.currentMapId); // Original debug
                GAME_MODES.getName(this.currentGameModeId); // Original debug
            }
            return null; // Consume message
        },

        // Handles outgoing unknown action 6 (related to player state)
        handleOutgoingUnknownAction6(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            this.removePlayerRankAndLevel(playerData); // Remove rank/level from message
            return message; // Return modified message
        },

        // Handles outgoing unknown action 7 (related to player state)
        handleOutgoingUnknownAction7(message) {
            const playerData = message.get(MESSAGE_FIELD_IDS.playerData);
            this.removePlayerRankAndLevel(playerData); // Remove rank/level from message
            const playerState = message.get(MESSAGE_FIELD_IDS.playerState);
            // Set rank and level to null in the message
            playerState.set(new TypedValue(0x3, 0xff), new TypedValue(0x3, null));
            playerState.set(new TypedValue(0x3, 0xf3), new TypedValue(0xb, null));
            playerState.get("C0").value = null; // Set C0 to null
            playerState.get("C2").value = 0; // Set C2 to 0
            return message; // Return modified message
        },

        // Helper to remove rank and level from player data in messages
        removePlayerRankAndLevel(playerData) {
            playerData.set(MESSAGE_FIELD_IDS.name, null); // Set name to null
            playerData.set("rank", null);
            playerData.set("level", null);
        },

        // --- Game Actions (Client-to-Server) ---

        // Sends a raw binary message over the game WebSocket
        sendGameMessage(data, description = "") {
            WebSocket.gameWebSocket.send(data);
        },

        // Sends a hexadecimal string as a binary message
        sendHexGameMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            WebSocket.gameWebSocket.send(byteArray);
        },

        // Simulates receiving a hexadecimal string as a binary message
        simulateReceiveHexGameMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            const ws = WebSocket.gameWebSocket;
            const event = new MessageEvent("message", {
                data: byteArray,
                origin: new URL(ws.url).origin,
                lastEventId: "", // Empty string
                source: null,
                ports: [],
            });
            ws.dispatchEvent(event);
        },

        // Processes a hexadecimal string as an outgoing message
        processHexOutgoingMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            this.processOutgoingGameMessage(byteArray);
        },

        // Processes a hexadecimal string as an incoming message
        processHexIncomingMessage(hexString) {
            const cleanedHex = hexString
                .replace(/\s+/g, "")
                .match(/.{1,2}/g);
            const byteArray = new Uint8Array(
                cleanedHex.map((byte) => parseInt(byte, 16))
            );
            this.processIncomingGameMessage(byteArray);
        },

        // Sends a message to join a room
        joinRoom(roomName) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.JOIN_ROOM);
            stream.writeByte(MESSAGE_FIELD_IDS.name);
            stream.writeTypedString(roomName);
            this.sendGameMessage(stream.data, "joinRoom");
        },

        // Sends a message to set the player's weapon
        setWeapon(weaponId, unknownValue = 0) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.PLAYER_KILL); // Signature for kill, but used for weapon?
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x2])); // Action marker
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x2])); // Unknown marker
            stream.writeTypedNumber(weaponId);
            stream.writeTypedNumber(unknownValue);
            this.sendGameMessage(stream.data, "setWeapon");
        },

        // Finds a player by ID, tag, or name
        findPlayer(identifier) {
            if (identifier instanceof Player) {
                return identifier;
            }
            if (typeof identifier === "number") {
                let player = this.otherPlayers.get(identifier);
                if (!player) {
                    // Try finding by tag if not found by ID
                    player = Array.from(this.otherPlayers.values()).find(
                        (p) => p.tag === identifier
                    );
                }
                if (!player) {
                    throw Error(`Player with id ${identifier} not found!`);
                }
                return player;
            }
            if (typeof identifier === "string") {
                const matchingPlayers = Array.from(this.otherPlayers.values()).filter(
                    (p) => p.displayName.toLowerCase().includes(identifier.toLowerCase())
                );
                if (matchingPlayers.length < 1) {
                    throw Error(`No player matching '${identifier}'`);
                }
                if (matchingPlayers.length > 1) {
                    throw Error(
                        `There are ${matchingPlayers.length} players matching '${identifier}'`
                    );
                }
                return matchingPlayers[0];
            }
            throw Error(`Unknown player <${identifier}> ??`);
        },

        // Sends a message to damage a player
        damagePlayer(player, damageAmount, unknownValue = 0) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x3])); // Action marker (damage)
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x5])); // Unknown marker
            // These seem to be position/velocity data
            stream.writeBytes(
                new Uint8Array([
                    0x53, 0x1, 0x56, 0xc, 0xc2, 0x9f, 0x3e, 0xc6, 0x40, 0xa0, 0xeb, 0x4b,
                    0xc2, 0x4, 0x83, 0x65,
                ])
            );
            stream.writeBytes(
                new Uint8Array([
                    0x53, 0x1, 0x56, 0xc, 0xc2, 0x9f, 0x3e, 0xc6, 0x40, 0xa0, 0xeb, 0x4b,
                    0xc2, 0x4, 0x83, 0x65,
                ])
            );
            stream.writeTypedNumber(player.tag);
            stream.writeTypedNumber(damageAmount);
            stream.writeTypedNumber(unknownValue);
            this.sendGameMessage(stream.data, "damagePlayer");
        },

        // Sends a message to kill a player
        killPlayer(player) {
            const contentMap = new TypedKeyMap();
            contentMap.set(new TypedValue(0x22, null), this.localPlayer.tag); // Player tag
            contentMap.set(new TypedValue(0x3, 0x2), GAME_CONSTANTS.MAGIC_NUMBER_2); // Magic number
            contentMap.set(new TypedValue(0x3, 0x5), new TypedValue(0x3, 0x4)); // Action: Kill (0x4)
            const targetArray = [player.tag];
            targetArray.type = 0x17; // Any array type
            contentMap.set(new TypedValue(0x3, 0x4), targetArray); // Target player tag

            const killMessage = new KeyMap(
                "killPlayer",
                CLIENT_MESSAGE_SIGNATURES.PLAYER_KILL
            );
            killMessage.set(MESSAGE_FIELD_IDS.content, contentMap);

            const stream = new CustomDataStream();
            stream.writeKeyMap(killMessage);
            this.sendGameMessage(stream.data, "killPlayer");
        },

        // Teleports a player to a specific position (or resets them)
        teleportPlayer(player, resetPosition = false) {
            // Helper to convert UInt32 to Float32
            function uint32ToFloat32(uint) {
                const buffer = new ArrayBuffer(4);
                new DataView(buffer).setUint32(0, uint, true);
                return new Float32Array(buffer)[0];
            }

            let coords;
            if (resetPosition) {
                // Teleport to a "safe" but far away location (e.g., for ban)
                const farAway = uint32ToFloat32(0xff7fffff); // Max float value
                coords = [farAway, farAway, farAway];
            } else {
                // Teleport to a "default" or "invalid" location (e.g., for invisibility punish)
                const invalid = uint32ToFloat32(0xeeeeeeee); // Specific invalid float value
                coords = [invalid, invalid, invalid];
            }

            this.movePlayerTo(player, coords);
        },

        // Sends a message to move a player to specific coordinates
        movePlayerTo(player, coordinates) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc9])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x17, 0x3])); // Content marker
            stream.writeTypedNumber(0xcafe); // Magic number
            stream.writeBytes(new Uint8Array([0x8, 0x17, 0x7])); // Unknown marker
            stream.writeTypedNumber(player.tag);
            stream.writeBytes(new Uint8Array([0x1b])); // Unknown marker
            stream.writeBytes(new Uint8Array([0x8])); // Unknown marker
            stream.writeTypedNumber(0x0); // Unknown value
            stream.writePoint3Array(coordinates); // Position
            stream.writePoint3Array(coordinates); // Velocity (same as position)
            const rotationY = 1; // Fixed rotation Y
            stream.writePoint4Array([rotationY, 0x0, 0x1, 0x0]); // Rotation (Quaternion-like)
            this.sendGameMessage(stream.data, "MovePlayerTo");
            player.unknownValue = 0; // Reset unknown value
            player.lastActionTime = Date.now() + 10000; // Set grace period for teleported player
        },

        sendChatMessage(message) {
            // Split message into chunks if too long (max 200 chars)
            const messageChunks = (() => {
                if (!message) return [];
                const parts = message.match(/<[^>]+>\s*|[^<\s][^\s<]*\s*|\s+/g) || []; // Split by tags, words, spaces
                const chunks = [];
                let currentChunk = ""; // Empty string
                for (let part of parts) {
                    // Chunk message if it exceeds 200 characters
                    if (
                        currentChunk.length + (currentChunk ? 1 : 0) + part.length >
                        200
                    ) {
                        if (currentChunk) {
                            chunks.push(currentChunk);
                        }
                        currentChunk = part;
                    } else {
                        currentChunk += part;
                    }
                }
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                return chunks;
            })();

            for (const chunk of messageChunks) {
                const stream = new CustomDataStream();
                stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.CHAT_MESSAGE);
                stream.writeBytes(new Uint8Array([0xf5, 0x17, 0x1])); // Content marker
                stream.writeTypedString(chunk);
                this.sendGameMessage(stream.data, "sayChat");
            }
        },

        // Sends a message to set the player's nickname
        setNickname(name) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.SET_NICKNAME);
            stream.writeBytes(new Uint8Array([0xfb, 0x15, 0x1, 0x3, 0xff])); // Content marker
            stream.writeTypedString(name);
            stream.writeId(this.localPlayer.id);
            stream.writeByte(0xfa); // Unknown marker
            stream.writeByte(0x1c); // Unknown marker
            this.sendGameMessage(stream.data, "setNick");
            UnityModule.sendMessage("MapScripts", "SetNickname", name); // Update Unity UI
        },

        // Sends a message to set the player's in-game skin and hat
        setInGameSkin(skinIndex, hatIndex = -1) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8, 0xf5, 0x15, 0x4])); // Unknown marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(
                new Uint8Array([0x3, 0x5, 0x3, 0x8, 0x3, 0x4, 0x17, 0x3, 0xb, 0x6])
            ); // Action marker (set skin)
            stream.writeTypedNumber(skinIndex);
            stream.writeTypedNumber(hatIndex);
            this.sendGameMessage(stream.data, "setSkin");
        },

        // Sends a message to set the player's lobby skin and hat
        setLobbySkin(skinIndex, hatIndex = -1) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.SET_LOBBY_SKIN);
            stream.writeBytes(new Uint8Array([0xfb, 0x15, 0x2])); // Content marker
            stream.writeTypedString("characterSkinIndex");
            stream.writeTypedNumber(skinIndex);
            stream.writeTypedString("hatIndex");
            stream.writeTypedNumber(hatIndex);
            stream.writeId(this.localPlayer.id);
            stream.writeBytes(new Uint8Array([0xfa, 0x1c])); // Unknown marker
            this.sendGameMessage(stream.data, "setLobbySkin");
        },

        // Sends a message to heal the player
        healPlayer(player) {
            const stream = new CustomDataStream();
            stream.writeBytes(CLIENT_MESSAGE_SIGNATURES.GENERIC_ACTION);
            stream.writeBytes(new Uint8Array([0xf4, 0x3, 0xc8])); // Unknown marker
            stream.writeBytes(new Uint8Array([0xf5, 0x15, 0x4])); // Content marker
            stream.writeTag(this.localPlayer.tag);
            stream.writeTimestamp();
            stream.writeBytes(new Uint8Array([0x3, 0x5, 0x3, 0x3])); // Action marker (heal)
            stream.writeBytes(new Uint8Array([0x3, 0x4, 0x17, 0x1])); // Unknown marker
            stream.writeTypedNumber(player); // Player ID to heal
            this.sendGameMessage(stream.data, "heal");
        },

        // Resets player list and clears other player data
        resetPlayerListAndData() {
            this.localPlayer.id = 0;
            this.otherPlayers.clear();
        },

        // Applies punishment to a player based on detected cheats
        punishPlayer(player) {
            this.damagePlayer(player, 250, 1); // Deal damage
            this.killPlayer(player); // Kill player
            this.teleportPlayer(player, false); // Teleport to invalid location
        },

        // "Nukes" all clients (teleports them to infinity)
        nukeAllClients() {
            this.setInGameSkin(this.localPlayer.skinIndex, 0x50); // Change local player's hat
            this.setInGameSkin(this.localPlayer.skinIndex, this.localPlayer.hatIndex); // Revert hat
            for (const player of this.otherPlayers.values()) {
                this.movePlayerTo(player, [Infinity, Infinity, Infinity]); // Teleport to infinity
            }
        },

        // Sends all players to the sky
        sendAllPlayersToSky() {
            for (const player of this.otherPlayers.values()) {
                console.log(player);
                const randomX = Math.random() * 10 + -5;
                const randomY = Math.random() * 2 + 400; // 0x190
                const randomZ = Math.random() * 10 + -5;
                this.movePlayerTo(player, [randomX, randomY, randomZ]);
            }

        },
    };

    // Override native WebSocket to intercept game and Firebase traffic
    window.WebSocket = class InterceptedWebSocket extends WebSocket {
        static gameWebSocket = null;

        constructor(...args) {
            super(...args);
            this.addEventListener("open", (event) => {
                if (this.url.includes("exitgames")) {
                    WebSocketModule.interceptGameWebSocket(this);
                    this.constructor.gameWebSocket = this;
                }
            });
            this.addEventListener("close", (event) => {
                if (this === this.constructor.gameWebSocket) {
                    WebSocketModule.cleanupGameWebSocket(this);
                    this.constructor.gameWebSocket = null;
                }
            });
        }
    };

    // Callback when a map starts playing
    window.onMapPlayStarted = function (mapName) {
        WebSocketModule.isMapPlaying = true;
    };

    // Callback when a map ends
    window.onMapPlayEnd = function () {
        WebSocketModule.isMapPlaying = false;
        try { ChatModule.clear(); } catch (_e) {}
    };

    // Attach game definitions to Nova namespace for consumption
    try {
        window.Nova = window.Nova || {};
        window.Nova.Game = {
            Constants: GAME_CONSTANTS,
            Signatures: { Server: SERVER_MESSAGE_SIGNATURES, Client: CLIENT_MESSAGE_SIGNATURES },
            Classes: CLASSES,
            Maps: MAPS,
            Modes: GAME_MODES,
            Player,
            Fields: MESSAGE_FIELD_IDS,
            WebSocketModule
        };
    } catch (_e) {}

    // =============================================================
    // Features Module: centralizes built-in feature registrations
    // =============================================================
    (function initNovaFeaturesNamespace(){
        const Nova = window.Nova || (window.Nova = {});
        Nova.Features = Nova.Features || {};
        /**
         * Register all built-in features against the provided app/client instance
         * @param {{features: any, ui: any}} app
         */
        Nova.Features.registerBuiltIns = function registerBuiltIns(app) {
            // Profile: Hide Name
            let originalUsername = null;
            let randomNameInterval = null;

            const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            const getRandomName = () => {
                const names = ['KourGale', 'KourGlide', 'KourAura', 'KourRift', 'Kouree', 'Kourrex',
                    'KourJay', 'KourRoam', 'Kourcalm', 'Kourbold', 'KourSky',
                    'Kour', 'Kourshift', 'KourEpic', 'KourGem', 'KourDog', 'KourPax'];
                const randomIndex = Math.floor(Math.random() * names.length);
                return names[randomIndex];
            };

            const saveOriginalData = async () => {
                try {
                    if (!FirebaseModule.isAvailable()) return;
                    const uid = FirebaseModule.getUid();
                    if (!uid) return;
                    originalUsername = await FirebaseModule.read('public/myUsername');
                } catch (error) {
                    Logger.error('Error saving original data:', error);
                }
            };

            window.NovaAPI.registerFeature({
                id: 'feature.hideName',
                name: 'Hide Name',
                tab: 'profile',
                onEnable: async () => {
                    if (!FirebaseModule.isAvailable()) {
                        Logger.warn('Firebase not available; cannot enable Hide Name');
                        return false; // signal retry
                    }
                    // Ensure Unity is available before marking as applied
                    if (!UnityModule.isAvailable()) {
                        Logger.warn('Unity not available; retrying Hide Name shortly');
                        return false; // signal retry so scheduler will try again
                    }
                    if (!originalUsername) {
                        await saveOriginalData();
                    }
                    const randomName = getRandomName();
                    const randomNumber = getRandomNumber(1, 749);
                    const nickname = randomName + randomNumber;
                    try {
                        // Attempt immediate apply with retry, then keep reinforcing periodically
                        const applied = await UnityModule.sendWithRetry('MapScripts', 'SetNickname', nickname, 10, 300);
                        if (!applied) {
                            Logger.warn('Failed to set nickname; will retry via scheduler');
                            return false; // signal retry if even sendWithRetry failed
                        }
                        if (randomNameInterval) {
                            clearInterval(randomNameInterval);
                            randomNameInterval = null;
                        }
                        randomNameInterval = setInterval(() => {
                            UnityModule.send('MapScripts', 'SetNickname', nickname);
                        }, 1000);
                    } catch (_e) {}
                    window.NovaAPI.success('Name hidden');
                    return true;
                },
                onDisable: async () => {
                    if (randomNameInterval) {
                        clearInterval(randomNameInterval);
                        randomNameInterval = null;
                    }
                    // Attempt to restore original username via game hooks if available
                    try {
                        if (originalUsername && UnityModule.isAvailable() && window.loginData) {
                            const parts = window.loginData.split('|');
                            parts[0] = originalUsername;
                            UnityModule.send('FirebasePlayerPrefs2023', 'OnLoggedInGoogle', parts.join('|'));
                            window.NovaAPI.error('Name restored');
                        }
                    } catch (_e) {}
                }
            });

            // Chicken: Spawner Feature (group with controls)
            window.NovaAPI.registerFeature({
                id: 'chicken.spawner',
                name: 'Chicken Spawner',
                tab: 'chicken',
                mainControlId: 'spawn',
                type: 'group',
                controls: [
                    {
                        id: 'spawn',
                        type: 'button',
                        label: 'Spawn',
                        onClick: (ctx) => {
                            if (WebSocketModule.isMapPlaying) {
                                const raw = ctx.getValue('count', 1);
                                const count = Math.max(1, Math.min(99, Number(raw) || 1));
                                ctx.ui.spawnChickens(count);
                                window.NovaAPI.success(`${count} chickens spawned`);
                            } else {
                                window.NovaAPI.error('Not in game');
                            }
                        }
                    },
                    {
                        id: 'count',
                        type: 'number',
                        label: 'Count',
                        defaultValue: 50,
                        min: 1,
                        max: 99,
                        step: 1,
                        onChange: (ctx, value) => {
                            // Clamp and persist via setValue already
                            const v = Math.max(1, Math.min(99, Number(value) || 1));
                            if (v !== value) ctx.setValue('count', v);
                        }
                    }
                ]
            });

            // Chicken: Hide Chickens (toggle via WebGL hooks on draw calls)
            window.NovaAPI.registerFeature({
                id: 'chicken.hide',
                name: 'Hide Chickens',
                tab: 'chicken',
                incompatibleWith: ['chicken.esp'],
                onEnable: async () => {
                    try {
                        const handler = ({ method, args }) => {
                            try {
                                // drawArrays(mode, first, count) -> count at index 2
                                // drawElements(mode, count, type, offset) -> count at index 1
                                let count = null;
                                if (method === 'drawArrays') count = Number(args && args[2]);
                                else if (method === 'drawElements' || method === 'drawElementsInstanced') count = Number(args && args[1]);
                                if (Number.isFinite(count) && count >= 929 && count <= 931) {
                                    return { skipOriginal: true };
                                }
                            } catch (_e) { /* ignore */ }
                        };
                        window.NovaAPI.webgl.register('chicken.hide', 'drawArrays', handler);
                        window.NovaAPI.webgl.register('chicken.hide', 'drawElements', handler);
                        window.NovaAPI.webgl.register('chicken.hide', 'drawElementsInstanced', handler);
                        window.NovaAPI.success('Chickens hidden');
                        return true;
                    } catch (_e) {
                        return false;
                    }
                },
                onDisable: async () => {
                    try {
                        window.NovaAPI.webgl.unregister('chicken.hide', 'drawArrays');
                        window.NovaAPI.webgl.unregister('chicken.hide', 'drawElements');
                        window.NovaAPI.webgl.unregister('chicken.hide', 'drawElementsInstanced');
                        window.NovaAPI.error('Chickens visible');
                    } catch (_e) {}
                }
            });

            // Chicken: ESP (render chickens on top by nudging gl_Position.z)
            window.NovaAPI.registerFeature({
                id: 'chicken.esp',
                name: 'Chicken ESP',
                tab: 'chicken',
                incompatibleWith: ['chicken.hide'],
                onEnable: async () => {
                    try {
                        const MIN_VERTICES = 929;
                        const MAX_VERTICES = 931;

                        // Cache uniform locations per program
                        const programUniformCache = new WeakMap();
                        const getUniformsForProgram = (gl, program) => {
                            let cached = programUniformCache.get(program);
                            if (!cached) {
                                cached = {
                                    toggle: gl.getUniformLocation(program, 'novaEspToggle'),
                                    vcount: gl.getUniformLocation(program, 'novaVertexCount')
                                };
                                programUniformCache.set(program, cached);
                            }
                            return cached;
                        };

                        // Set uniforms each draw so shaders can decide when to pull forward
                        const drawHandler = ({ gl, method, args }) => {
                            try {
                                const program = gl.getParameter(gl.CURRENT_PROGRAM);
                                if (!program) return;
                                const { toggle, vcount } = getUniformsForProgram(gl, program) || {};
                                if (!toggle || !vcount) return;
                                const count = (method === 'drawArrays') ? Number(args && args[2]) : Number(args && args[1]);
                                if (Number.isFinite(count)) {
                                    // Enable ESP and pass current draw vertex count
                                    gl.uniform1f(toggle, 1.0);
                                    gl.uniform1f(vcount, count);
                                }
                            } catch (_e) { /* ignore */ }
                        };
                        window.NovaAPI.webgl.register('chicken.esp', 'drawArrays', drawHandler);
                        window.NovaAPI.webgl.register('chicken.esp', 'drawElements', drawHandler);
                        window.NovaAPI.webgl.register('chicken.esp', 'drawElementsInstanced', drawHandler);

                        // Inject uniforms and post-position tweak into vertex shaders
                        const shaderHandler = ({ gl, args }) => {
                            try {
                                const shader = args && args[0];
                                let src = String(args && args[1] || '');
                                if (!src || src.indexOf('gl_Position') === -1) return; // not a vertex shader or irrelevant
                                // Ensure we only modify vertex shaders
                                try {
                                    const type = gl.getShaderParameter(shader, gl.SHADER_TYPE);
                                    if (type !== gl.VERTEX_SHADER) return;
                                } catch (_e) { /* best-effort */ }

                                if (src.includes('novaEspToggle') || src.includes('__nova_esp_injected__')) return; // already injected

                                // Insert uniforms right after #version line if present, otherwise at start
                                const uniformHeader = `uniform float novaEspToggle;\nuniform float novaVertexCount;\n// __nova_esp_injected__\n`;
                                let injected;
                                const versionMatch = src.match(/^\s*#version[^\n]*\n/);
                                if (versionMatch) {
                                    injected = src.replace(versionMatch[0], versionMatch[0] + uniformHeader);
                                } else {
                                    injected = uniformHeader + src;
                                }
                                // After first gl_Position assignment, nudge z forward for chickens when enabled
                                const tweak = `if (novaEspToggle > 0.5 && novaVertexCount >= ${MIN_VERTICES}.0 && novaVertexCount <= ${MAX_VERTICES}.0) {\n    gl_Position.z = 0.01 + gl_Position.z * 0.1;\n}`;
                                injected = injected.replace(/(gl_Position\s*=\s*[^;]+;)/, `$1\n${tweak}`);

                                if (injected !== src) {
                                    args[1] = injected;
                                    return { args };
                                }
                            } catch (_e) { /* ignore */ }
                        };
                        window.NovaAPI.webgl.register('chicken.esp', 'shaderSource', shaderHandler);

                        window.NovaAPI.success('Chicken ESP on');
                        return true;
                    } catch (_e) {
                        return false;
                    }
                },
                onDisable: async () => {
                    try {
                        window.NovaAPI.webgl.unregister('chicken.esp', 'drawArrays');
                        window.NovaAPI.webgl.unregister('chicken.esp', 'drawElements');
                        window.NovaAPI.webgl.unregister('chicken.esp', 'drawElementsInstanced');
                        window.NovaAPI.webgl.unregister('chicken.esp', 'shaderSource');
                        window.NovaAPI.error('Chicken ESP off');
                    } catch (_e) {}
                }
            });

            // Gameplay: ESP for players (render players on top by nudging gl_Position.z)
            window.NovaAPI.registerFeature({
                id: 'gameplay.esp',
                name: 'ESP',
                tab: 'gameplay',
                onEnable: async () => {
                    try {
                        const MIN_VERTICES = 1481;
                        const MAX_VERTICES = 1483;

                        // Cache uniform locations per program
                        const programUniformCache = new WeakMap();
                        const getUniformsForProgram = (gl, program) => {
                            let cached = programUniformCache.get(program);
                            if (!cached) {
                                cached = {
                                    toggle: gl.getUniformLocation(program, 'novaPlayerEspToggle'),
                                    vcount: gl.getUniformLocation(program, 'novaPlayerVertexCount')
                                };
                                programUniformCache.set(program, cached);
                            }
                            return cached;
                        };

                        // Set uniforms each draw so shaders can decide when to pull forward
                        const drawHandler = ({ gl, method, args }) => {
                            try {
                                const program = gl.getParameter(gl.CURRENT_PROGRAM);
                                if (!program) return;
                                const { toggle, vcount } = getUniformsForProgram(gl, program) || {};
                                if (!toggle || !vcount) return;
                                const count = (method === 'drawArrays') ? Number(args && args[2]) : Number(args && args[1]);
                                if (Number.isFinite(count)) {
                                    gl.uniform1f(toggle, 1.0);
                                    gl.uniform1f(vcount, count);
                                }
                            } catch (_e) { /* ignore */ }
                        };
                        window.NovaAPI.webgl.register('gameplay.esp', 'drawArrays', drawHandler);
                        window.NovaAPI.webgl.register('gameplay.esp', 'drawElements', drawHandler);
                        window.NovaAPI.webgl.register('gameplay.esp', 'drawElementsInstanced', drawHandler);

                        // Inject uniforms and post-position tweak into vertex shaders (additive with Chicken ESP)
                        const shaderHandler = ({ gl, args }) => {
                            try {
                                const shader = args && args[0];
                                let src = String(args && args[1] || '');
                                if (!src || src.indexOf('gl_Position') === -1) return; // not a vertex shader or irrelevant
                                try {
                                    const type = gl.getShaderParameter(shader, gl.SHADER_TYPE);
                                    if (type !== gl.VERTEX_SHADER) return;
                                } catch (_e) { /* best-effort */ }

                                // If our players tweak already exists, skip
                                if (src.includes('__nova_esp_players__')) return;

                                let injected = src;
                                // Ensure uniforms exist (insert after #version if present)
                                if (!injected.includes('novaPlayerEspToggle')) {
                                    const uniformHeader = `uniform float novaPlayerEspToggle;\nuniform float novaPlayerVertexCount;\n`;
                                    const versionMatch = injected.match(/^\s*#version[^\n]*\n/);
                                    injected = versionMatch ? injected.replace(versionMatch[0], versionMatch[0] + uniformHeader) : (uniformHeader + injected);
                                }

                                // Append our players tweak after first gl_Position assignment
                                const tweak = `// __nova_esp_players__\nif (novaPlayerEspToggle > 0.5 && novaPlayerVertexCount >= ${MIN_VERTICES}.0 && novaPlayerVertexCount <= ${MAX_VERTICES}.0) {\n    gl_Position.z = 0.01 + gl_Position.z * 0.1;\n}`;
                                injected = injected.replace(/(gl_Position\s*=\s*[^;]+;)/, `$1\n${tweak}`);

                                if (injected !== src) {
                                    args[1] = injected;
                                    return { args };
                                }
                            } catch (_e) { /* ignore */ }
                        };
                        window.NovaAPI.webgl.register('gameplay.esp', 'shaderSource', shaderHandler);

                        window.NovaAPI.success('ESP on');
                        return true;
                    } catch (_e) {
                        return false;
                    }
                },
                onDisable: async () => {
                    try {
                        window.NovaAPI.webgl.unregister('gameplay.esp', 'drawArrays');
                        window.NovaAPI.webgl.unregister('gameplay.esp', 'drawElements');
                        window.NovaAPI.webgl.unregister('gameplay.esp', 'drawElementsInstanced');
                        window.NovaAPI.webgl.unregister('gameplay.esp', 'shaderSource');
                        window.NovaAPI.error('ESP off');
                    } catch (_e) {}
                }
            });

            // Send to Sky Feature (group with controls)
            window.NovaAPI.registerFeature({
                id: 'send.sky',
                name: 'Send to Sky',
                tab: 'trolling',
                mainControlId: 'send',
                type: 'group',
                controls: [
                    {
                        id: 'send',
                        type: 'button',
                        label: 'Send',
                        onClick: () => {
                            WebSocketModule.sendAllPlayersToSky();
                            window.NovaAPI.success('Sent to sky');
                        }
                    }
                ]
            });

            // Nuke Feature (group with controls)
            window.NovaAPI.registerFeature({
                id: 'nuke',
                name: 'Nuke All Players',
                tab: 'trolling',
                mainControlId: 'nuke',
                type: 'group',
                controls: [
                    {
                        id: 'nuke',
                        type: 'button',
                        label: 'Nuke',
                        onClick: () => {
                            WebSocketModule.nukeAllClients();
                            window.NovaAPI.success('Players nuked');
                        }
                    }
                ]
            });

			// Cycle Classes: toggle feature
			window.NovaAPI.registerFeature({
				id: 'classes.cycle',
				name: 'Cycle Classes',
				tab: 'gameplay',
                incompatibleWith: ['rapid.rpg'],
				onEnable: async () => {
					window.NovaAPI.success('Cycle Classes on');
					return true;
				},
				onDisable: async () => {
					window.NovaAPI.error('Cycle Classes off');
				}
			});

			// Cycle Classes: configuration group (key + classes)
			window.NovaAPI.registerFeature({
				id: 'classes.cycle.settings',
				name: 'Key',
				tab: 'gameplay',
				type: 'group',
				controls: [
					{
						id: 'key',
						type: 'text',
						label: 'Key',
						defaultValue: 'q',
						onChange: (_ctx, _value) => { }
					},
					{
						id: 'classes',
						type: 'text',
						label: 'Classes',
						defaultValue: 'brawler, gunner, hitman',
						onChange: (_ctx, _value) => { }
					}
				]
			});

            // Give KP Feature (group with controls)
            window.NovaAPI.registerFeature({
                id: 'give.kp',
                name: 'Give KP',
                tab: 'profile',
                mainControlId: 'give',
                type: 'group',
                controls: [
                    {
                        id: 'give',
                        type: 'button',
                        label: 'Give',
                        onClick: (ctx) => {
                            const raw = ctx.getValue('count', 1);
                            const count = Number(raw) || 1;
                            window.Nova.UnityWebModkit.call("ShopPanel", "GiveKourPoints", [null, count]); 
                            window.NovaAPI.success(`${count} KP given`);
                        }
                    },
                    {
                        id: 'count',
                        type: 'number',
                        label: 'Count',
                        defaultValue: 1000,
                        onChange: (ctx, value) => {
                            const v = Number(value) || 1;
                            if (v !== value) ctx.setValue('count', v);
                        }
                    }
                ]
            });

			// Rapid RPG: toggle feature
			window.NovaAPI.registerFeature({
				id: 'rapid.rpg',
				name: 'Rapid RPG',
				tab: 'gameplay',
                incompatibleWith: ['classes.cycle'],
				onEnable: async () => {
					window.NovaAPI.success('Rapid RPG on');
					return true;
				},
				onDisable: async () => {
					window.NovaAPI.error('Rapid RPG off');
				}
			});
        };
    })();

    // =============================================================
    // Nova Client Configuration
    // =============================================================
    /**
     * NovaConfig: user‑tweakable theme, fonts and hotkeys. Changing values
     * here adjusts the look and defaults without touching logic.
     */
    const NovaConfig = {
        version: '1.0.0',
        name: 'Nova Client',
        theme: {
            background: '#0a0a0a',
            accent: '#1a1a1a',
            title: '#ffffff',
            text: '#c5c5c5',
            border: '#333333',
            success: '#8ec07c',
            error: '#d3869b',
            purple: '#9d86d3',
            orange: '#fe8019',
            yellow: '#fabd2f',
            blue: '#2196f3',
        },
        fonts: {
            primary: '"IBM Plex Mono", monospace'
        },
        hotkeys: {
            toggleUI: { code: 'ShiftRight', label: 'Right Shift' }
        }
    };

    /**
     * Nova Leaderboard: minimal always-on overlay for game state (Leaderboard)
     * Shows Top 10 players by score using Player.displayName and Player.score
     */
    /**
     * NovaLeaderboard
     * Minimal overlay showing top players by score.
     * Visible during active gameplay (pointer locked and map active).
     */
    class NovaLeaderboard {
        constructor(gameModule) {
            this.game = gameModule;
            this.container = null;
            this.interval = null;
            this.visible = false;
            this._ensureStyles();
        }

        /** Inject styles once per page. */
        _ensureStyles() {
            try {
                if (document.getElementById('nova-leaderboard-styles')) return;
                const style = document.createElement('style');
                style.id = 'nova-leaderboard-styles';
                style.textContent = `
                    .nova-leaderboard {
                        position: fixed;
                        width: 20%;
                        top: 12px;
                        right: 12px;
                        z-index: 9999;
                        pointer-events: none;
                        font-family: ${NovaConfig.fonts.primary};
                        color: ${NovaConfig.theme.text};
                        background: ${NovaConfig.theme.background};
                        border: 1px solid ${NovaConfig.theme.border};
                        border-radius: 10px;
                        padding: 8px 10px;
                        box-shadow: 0 6px 18px rgba(0,0,0,0.5);
                    }
                    .nova-leaderboard .nova-leaderboard-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 8px;
                        font-size: 12px;
                        padding: 8px;
                    }
                    .nova-leaderboard .place {
                        min-width: 20px;
                        text-align: left;
                    }
                    .nova-leaderboard .name {
                        color: ${NovaConfig.theme.title};
                        flex: 1;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        text-align: left;
                    }
                    .nova-leaderboard .score {
                        color: ${NovaConfig.theme.title};
                        min-width: 40px;
                        text-align: right;
                        margin-left: 6px;
                    }
                    .nova-leaderboard .empty {
                        color: ${NovaConfig.theme.text};
                        text-align: center;
                        font-size: 12px;
                        padding: 16px 0;
                    }
                `;
                document.head.appendChild(style);
            } catch (_e) { /* ignore */ }
        }

        /** Mount the leaderboard container and start update loop. */
        mount() {
            try {
                if (this.container) return;
                this.container = document.createElement('div');
                this.container.className = 'nova-leaderboard';
                this.container.innerHTML = `
                    <div class="nova-leaderboard-card" id="nova-leaderboard-leaderboard">
                        <div class="nova-leaderboard-list"></div>
                    </div>
                `;
                document.body.appendChild(this.container);
                // Start hidden; will show only with pointer lock + active map
                this.container.style.display = 'none';
                // React to pointer lock changes immediately
                this._onPLC = () => this.update();
                try {
                    document.addEventListener('pointerlockchange', this._onPLC, true);
                    document.addEventListener('pointerlockerror', this._onPLC, true);
                } catch (_e) { /* ignore */ }
                this.interval = setInterval(() => this.update(), 1000);
                this.update();
            } catch (_e) { /* ignore */ }
        }

        unmount() {
            try {
                if (this.interval) { clearInterval(this.interval); this.interval = null; }
                try {
                    if (this._onPLC) {
                        document.removeEventListener('pointerlockchange', this._onPLC, true);
                        document.removeEventListener('pointerlockerror', this._onPLC, true);
                    }
                } catch (_e) { /* ignore */ }
                if (this.container && this.container.parentNode) this.container.parentNode.removeChild(this.container);
                this.container = null;
            } catch (_e) { /* ignore */ }
        }

        update() {
            try {
                if (!this.container) return;
                const listEl = this.container.querySelector('.nova-leaderboard-list');
                if (!listEl) return;

                // Show only during map play with pointer lock
                const playing = !!(this.game && this.game.isMapPlaying);
                const locked = !!document.pointerLockElement;
                const players = this._collectPlayers();
                if (!playing || !locked || players.length === 0) {
                    this._setVisible(false);
                    listEl.innerHTML = '';
                    return;
                }

                let top;
                if (WebSocketModule.currentGameModeId === GAME_MODES.GUN_GAME) {
                    top = players
                        .sort((a, b) => (b.kills || 0) - (a.kills || 0) || String(a.displayName || '').localeCompare(String(b.displayName || '')))
                        .slice(0, 10);
                } else {                    
                    top = players
                        .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.kills || 0) - (a.kills || 0) || String(a.displayName || '').localeCompare(String(b.displayName || '')))
                        .slice(0, 10);
                }

                const rows = top.map((p, idx) => {
                    const place = (idx + 1).toString().padStart(2, ' ');
                    const coloredName = this._colorizeName(String(p.rawName || `Player ${p.id}`));
                    const score = Number(WebSocketModule.currentGameModeId === GAME_MODES.GUN_GAME ? p.kills : p.score || 0);
                    return `
                        <div class="nova-leaderboard-row">
                            <div class="place">${place}.</div>
                            <div class="name">${coloredName}${p === WebSocketModule.localPlayer ? `<span style="color: ${NovaConfig.theme.text}"> [You]</span>` : ''}${p.isCheater ? `<span style="color: ${NovaConfig.theme.error}"> [Cheater]</span>` : ''}</div>
                            <div class="score">${score}</div>
                        </div>
                        ${players.length === 1 ? '<div class="empty">[Empty]</div>' : ''}
                    `;
                }).join('');

                listEl.innerHTML = rows;
                this._setVisible(true);
            } catch (_e) { /* ignore */ }
        }

        _colorizeName(raw) {
            try {
                const escapeHtml = (s) => String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const renderPlainWithSprites = (s) => {
                    const input = String(s);
                    let out = '';
                    let i = 0;
                    const re = /<sprite=(\d+)>/gi;
                    let m;
                    while ((m = re.exec(input)) !== null) {
                        const start = m.index;
                        const end = start + m[0].length;
                        out += escapeHtml(input.slice(i, start));
                        const id = parseInt(m[1], 10);
                        let color = (NovaConfig && NovaConfig.theme && NovaConfig.theme.blue) || '#1da1f2';
                        if (id === 1) color = (NovaConfig && NovaConfig.theme && NovaConfig.theme.yellow) || '#ffa500';
                        if (id === 2) color = (NovaConfig && NovaConfig.theme && NovaConfig.theme.success) || '#00c853';
                        out += `<span style="background: ${color}; border-radius: 4px; padding: 0 4px; color: ${NovaConfig.theme.background};"><strong>✔</strong></span> `;
                        i = end;
                    }
                    out += escapeHtml(input.slice(i));
                    return out;
                };
                const nameToHex = {
                    red: 'ff0000', green: '00ff00', blue: '0000ff', yellow: 'ffff00', orange: 'ffa500',
                    white: 'ffffff', black: '000000', purple: '800080', magenta: 'ff00ff', cyan: '00ffff',
                    pink: 'ffc0cb', gray: '808080', grey: '808080'
                };
                const normalizeColor = (colorSpecRaw) => {
                    const colorSpec = String(colorSpecRaw || '').trim();
                    let cssColor = colorSpec;
                    let r = 255, g = 255, b = 255;
                    let hasRgb = false;
                    if (colorSpec.startsWith('#')) {
                        let h = colorSpec.slice(1);
                        if (h.length === 3) h = h.split('').map(c => c + c).join('');
                        if (h.length === 8) h = h.slice(0, 6);
                        if (h.length === 6) {
                            cssColor = `#${h}`;
                            try { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); hasRgb = true; } catch (_e) {}
                        }
                    } else {
                        const lower = colorSpec.toLowerCase();
                        if (nameToHex[lower]) {
                            const h = nameToHex[lower];
                            cssColor = `#${h}`;
                            try { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); hasRgb = true; } catch (_e) {}
                        }
                    }
                    if (!hasRgb) { r = 255; g = 255; b = 255; }
                    return { cssColor, r, g, b };
                };
                const renderFrom = (input, startIndex) => {
                    let out = '';
                    let i = startIndex || 0;
                    const len = input.length;
                    while (i < len) {
                        const openIdx = input.indexOf('<color=', i);
                        const closeIdx = input.indexOf('</color>', i);
                        if (openIdx === -1 && closeIdx === -1) {
                            out += renderPlainWithSprites(input.slice(i));
                            i = len;
                            break;
                        }
                        if (openIdx !== -1 && (closeIdx === -1 || openIdx < closeIdx)) {
                            out += renderPlainWithSprites(input.slice(i, openIdx));
                            const openMatch = /^<color=([^>]+)>/i.exec(input.slice(openIdx));
                            if (!openMatch) {
                                out += '&lt;';
                                i = openIdx + 1;
                                continue;
                            }
                            const colorSpecRaw = openMatch[1];
                            const tagEnd = openIdx + openMatch[0].length;
                            let depth = 1;
                            let j = tagEnd;
                            while (j < len && depth > 0) {
                                const nextOpen = input.indexOf('<color=', j);
                                const nextClose = input.indexOf('</color>', j);
                                if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
                                    const m2 = /^<color=([^>]+)>/i.exec(input.slice(nextOpen));
                                    if (m2) { depth++; j = nextOpen + m2[0].length; continue; }
                                    j = nextOpen + 1; continue;
                                } else if (nextClose !== -1) {
                                    depth--;
                                    if (depth === 0) {
                                        const innerStart = tagEnd;
                                        const innerEnd = nextClose;
                                        const innerRaw = input.slice(innerStart, innerEnd);
                                        const { cssColor, r, g, b } = normalizeColor(colorSpecRaw);
                                        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                        const bracket = innerRaw.match(/^\s*\[([^\]]{1,64})\]\s*$/);
                                        const isDark = brightness < 0.45;
                                        const useBg = isDark || !!bracket;
                                        let style = `color: ${cssColor};`;
                                        if (useBg) {
                                            const bg = isDark ? NovaConfig.theme.text : NovaConfig.theme.border;
                                            style += ` background: ${bg}; border-radius: 4px; padding: 0 4px;`;
                                        }
                                        const innerHtml = bracket ? renderPlainWithSprites(bracket[1]) : renderFrom(innerRaw, 0);
                                        let segment = `<span style="${style}"><strong>` + innerHtml + `</strong></span>`;
                                        if (bracket) segment += ' ';
                                        out += segment;
                                        j = nextClose + '</color>'.length;
                                        i = j;
                                        break;
                                    } else {
                                        j = nextClose + '</color>'.length;
                                    }
                                } else {
                                    break;
                                }
                            }
                            if (depth > 0) {
                                const innerRaw = input.slice(tagEnd);
                                const { cssColor, r, g, b } = normalizeColor(colorSpecRaw);
                                const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                const bracket = innerRaw.match(/^\s*\[([^\]]{1,64})\]\s*$/);
                                const isDark = brightness < 0.45;
                                const useBg = isDark || !!bracket;
                                let style = `color: ${cssColor};`;
                                if (useBg) {
                                    const bg = isDark ? NovaConfig.theme.text : NovaConfig.theme.border;
                                    style += ` background: ${bg}; border-radius: 4px; padding: 0 4px;`;
                                }
                                const innerHtml = bracket ? renderPlainWithSprites(bracket[1]) : renderFrom(innerRaw, 0);
                                let segment = `<span style="${style}"><strong>` + innerHtml + `</strong></span>`;
                                if (bracket) segment += ' ';
                                out += segment;
                                i = len;
                            }
                            continue;
                        } else if (closeIdx !== -1 && (openIdx === -1 || closeIdx < openIdx)) {
                            out += renderPlainWithSprites(input.slice(i, closeIdx));
                            i = closeIdx + '</color>'.length;
                            continue;
                        }
                    }
                    return out;
                };
                return renderFrom(String(raw || ''), 0);
            } catch (_e) {
                return String(raw || '');
            }
        }

        _collectPlayers() {
            try {
                if (!this.game) return [];
                const arr = [];
                if (this.game.localPlayer) arr.push(this.game.localPlayer);
                if (this.game.otherPlayers && typeof this.game.otherPlayers.values === 'function') {
                    for (const p of this.game.otherPlayers.values()) arr.push(p);
                }
                return arr;
            } catch (_e) {
                return [];
            }
        }

        /** Update display state without reflowing content. */
        _setVisible(visible) {
            if (!this.container) return;
            if (this.visible === visible) return;
            this.visible = visible;
            this.container.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Nova Client core: bootstraps the userscript, waits for the game,
     * creates the UI, and wires global hotkeys.
     *
     * Responsibilities:
     * - Initialize once per page load
     * - Expose a minimal public API via window.NovaAPI
     * - Register built-in features and activate persisted ones
     */
    class NovaClient {
        constructor() {
            this.isInitialized = false;
            this.ui = null;
            this.features = new FeatureRegistry();
            this.adInterval = null;
            this.notifications = new NotificationManager();
            this._cycleClassesIdx = 0;
            
            // Expose a small public API for feature management
            /** @type {NovaAPI} */
            window.NovaAPI = {
                registerFeature: (def) => {
                    this.features.register(def);
                    // Activate immediately if previously enabled
                    this.features.activateIfEnabled(def.id);
                    if (this.ui) this.ui.renderFeatures(def.tab);
                },
                setFeatureEnabled: (id, enabled) => this.features.setEnabled(id, enabled),
                isFeatureEnabled: (id) => this.features.isEnabled(id),
                listFeatures: () => this.features.features.slice(),
                renderFeatures: (tab) => this.ui && this.ui.renderFeatures(tab),
                spawnChickens: (count) => this.ui && this.ui.spawnChickens(count),
                webgl: {
                    install: () => WebGLHooks.install(this.features),
                    register: (featureId, method, handler) => WebGLHooks.register(featureId, method, handler),
                    unregister: (featureId, method) => WebGLHooks.unregister(featureId, method)
                },
                notify: (messageOrOpts, type, durationMs) => this.notifications.show(messageOrOpts, type, durationMs),
                info: (msg, durationMs) => this.notifications.info(msg, durationMs),
                success: (msg, durationMs) => this.notifications.success(msg, durationMs),
                error: (msg, durationMs) => this.notifications.error(msg, durationMs)
            };
            this.init();
        }

        /**
         * Entry point for initializing the client.
         * Sets up NovaAPI, waits for the game, builds UI, and binds events.
         */
        /** Initialize core modules, wait for game, then mount overlays and features. */
        init() {
            if (this.isInitialized) return;
            
            Logger.log(`Initializing v${NovaConfig.version}...`);
            // Ensure keyboard unblocking is active for inputs within Nova UI
            EventUnblocker.install();
            
            // Lightweight ad blocker: periodically remove known ad containers
            try {
                this.adInterval = setInterval(() => {
                    ['kour-io_300x250-parent', 'kour-io_728x90-parent', 'kour-io_300x600-parent'].forEach(id => {
                        try {
                            const el = document.getElementById(id);
                            if (el) el.remove();
                        } catch (_e) { /* ignore */ }
                    });
                }, 1000);
                window.addEventListener('beforeunload', () => {
                    try { if (this.adInterval) clearInterval(this.adInterval); } catch (_e) {}
                    this.adInterval = null;
                });
            } catch (_e) {}
            
            // Wait for game to load
            this.waitForGame().then(() => {
                this.createUI();
                this.setupEventListeners();
                this.isInitialized = true;
                Logger.log('Initialized successfully');

                // Mount leaderboard overlay
                try {
                    this.leaderboard = new NovaLeaderboard(WebSocketModule);
                    this.leaderboard.mount();
                } catch (_e) { /* ignore */ }

                // Mount chat UI overlay
                try {
                    this.chatUI = new ChatUIModule(WebSocketModule);
                    this.chatUI.mount();
                } catch (_e) { /* ignore */ }

                // Install WebGL hooks (no features registered yet)
                try { window.NovaAPI.webgl.install(); } catch (_e) {}

                // Register built-in features modularly
                try { window.Nova && window.Nova.Features && window.Nova.Features.registerBuiltIns && window.Nova.Features.registerBuiltIns(this); } catch (_e) {}

                // Disable in-game leaderboard
                uwm.call('SettingsPanel', 'SetInGameLeaderboard', [false]);

                // After all built-in features are registered, activate persisted ones
                this.features.activateEnabled();
            });
        }

        /**
         * Wait until a game canvas element is present.
         * Resolves once the canvas is detected.
         * @returns {Promise<void>}
         */
        waitForGame() {
            return new Promise((resolve) => {
                const checkGame = () => {
                    if (findGameCanvas()) {
                        resolve();
                    } else {
                        setTimeout(checkGame, 1000);
                    }
                };
                checkGame();
            });
        }

        /** Build and mount the Nova UI panel. */
        createUI() {
            this.ui = new NovaUI(this.features);
            this.ui.create();
        }

        /** Register global hotkeys and runtime feature behaviors. */
        setupEventListeners() {
            // Global event listeners   
            document.addEventListener('keydown', (e) => {
                if (e.code === NovaConfig.hotkeys.toggleUI.code) {
                    e.preventDefault();
                    this.ui.toggle();
                    return;
                }

                // Cycle Classes hotkey
                try {
                    if (!this.features.isEnabled('classes.cycle')) return;
                    let keyCode = String(this.features.getValue('classes.cycle.settings', 'key', 'q') || '').trim();
                    if (keyCode.length === 1 && /[a-z]/i.test(keyCode)) keyCode = 'Key' + keyCode.toUpperCase();
                    if (e.code !== keyCode) return;
                    if (e.repeat) return;
                    if (!UnityModule.isAvailable()) return;

                    // Parse and normalize classes list
                    const raw = String(this.features.getValue('classes.cycle.settings', 'classes', 'brawler, gunner, hitman') || '');
                    const names = raw
                        .toLowerCase()
                        .replaceAll(' ', '')
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean);
                    const ids = names
                        .map(n => CLASSES.getId(n))
                        .filter(id => id !== CLASSES.NONE);
                    if (ids.length === 0) return;

                    // Advance index and send
                    this._cycleClassesIdx = (this._cycleClassesIdx + 1) % ids.length;
                    const classId = ids[this._cycleClassesIdx];
                    UnityModule.send('MapScripts', 'ChangeClassTo', classId);
                    UnityModule.send('MapScripts', 'ChangeClassTo', classId);
                    e.preventDefault();
                    e.stopPropagation();
                }
                catch (_e) { /* ignore */ }
            }, true);

            // Rapid RPG variables
            let rapidRPGActive = false;
            let rapidRPGInterval = null;

            document.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    try {
                        // Only trigger if pointer lock is enabled
                        if (document.pointerLockElement == null) return;
                        if (!this.features.isEnabled('rapid.rpg')) return;

                        // Start rapid RPG
                        rapidRPGActive = true;
                        
                        // Initial class change
                        setTimeout(() => {
                            UnityModule.send('MapScripts', 'ChangeClassTo', 4);
                        }, 1);

                        // Start continuous rapid RPG loop
                        rapidRPGInterval = setInterval(() => {
                            if (!rapidRPGActive) return;

                            // Simulate mouse click by dispatching a click event (reloads faster)
                            const canvas = findGameCanvas();
                            if (canvas) {
                                const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window,
                                    button: 0,
                                    buttons: 1
                                });
                                canvas.dispatchEvent(clickEvent);
                            }

                            // Change class to current class (reloads faster)
                            UnityModule.send('MapScripts', 'ChangeClassTo', 4);
                        }, 500); // 500ms interval for rapid RPG
                        
                    } catch (_e) { /* ignore */ }
                }
            });

            document.addEventListener('mouseup', (e) => {
                if (e.button === 0) {
                    try {
                        // Stop rapid RPG
                        rapidRPGActive = false;
                        if (rapidRPGInterval) {
                            clearInterval(rapidRPGInterval);
                            rapidRPGInterval = null;
                        }
                    } catch (_e) { /* ignore */ }
                }
            });
        }
    }

    /**
     * NovaUI: renders the control panel (tabs, feature list, settings),
     * manages drag/position persistence, and exposes small fun utilities
     * used by built-in features (e.g., spawnChickens).
     * Keep all DOM/UI-specific logic here.
     */
    class NovaUI {
        /**
         * @param {FeatureRegistry} featureRegistry
         */
        constructor(featureRegistry) {
            this.container = null;
            this.isVisible = false;
            this.xOffset = 0;
            this.yOffset = 0;
            this.featureRegistry = featureRegistry;
            this.createStyles();
        }

        /**
         * Inject component styles into the document.
         * Styles are scoped with the .nova-client class.
         */
        createStyles() {
            const style = document.createElement('style');
            style.textContent = `
                @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');

                button {
                    outline: none;
                }
                
                .nova-client {
                    position: fixed;
                    width: 300px;
                    height: 400px;
                    background: ${NovaConfig.theme.background};
                    border: 1px solid ${NovaConfig.theme.border};
                    border-radius: 12px;
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 12px;
                    color: ${NovaConfig.theme.text};
                    z-index: 9999;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                    display: block;
                    opacity: 0;
                    user-select: none;
                    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    pointer-events: none;
                }

                .nova-client.visible {
                    opacity: 1;
                    pointer-events: auto;
                }

                .nova-client.animate {
                    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .nova-client.animate:not(.visible) {
                    transform: translateY(-20px) scale(0.95);
                }

                .nova-client.animate.visible {
                    transform: translateY(0) scale(1);
                }

                .nova-header {
                    background: ${NovaConfig.theme.accent};
                    padding: 8px 12px;
                    border-bottom: 1px solid ${NovaConfig.theme.border};
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                }

                .nova-title {
                    font-weight: bold;
                    color: ${NovaConfig.theme.title};
                }

                .nova-content {
                    padding: 0;
                    height: 366px;
                    overflow: hidden;
                    position: relative;
                    display: flex;
                }

                .nova-tabs {
                    width: 40px;
                    display: flex;
                    flex-direction: column;
                    background: ${NovaConfig.theme.accent};
                    border-left: 1px solid ${NovaConfig.theme.border};
                    border-bottom: 1px solid ${NovaConfig.theme.border};
                    border-radius: 0 0 12px 0px;
                    flex-shrink: 0;
                }

                .nova-tab {
                    width: 40px;
                    height: 40px;
                    padding: 0;
                    background: transparent;
                    border: none;
                    color: ${NovaConfig.theme.text};
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    border-bottom: 1px solid ${NovaConfig.theme.border};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nova-tab:hover {
                    background: ${NovaConfig.theme.border};
                    color: ${NovaConfig.theme.title};
                }

                .nova-tab.active {
                    background: ${NovaConfig.theme.background};
                    color: ${NovaConfig.theme.title};
                }

                .nova-reload-btn {
                    margin-top: auto;
                    border-bottom: none;
                    border-radius: 0 0 12px 0;
                    font-size: 16px;
                }

                .nova-reload-btn:hover {
                    background: transparent;
                    color: ${NovaConfig.theme.title};
                }

                .nova-tab-content {
                    padding: 12px;
                    display: none;
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                }

                .nova-tab-content.active {
                    display: block;
                }

                .nova-section {
                }

                .nova-section-title {
                    font-weight: bold;
                    color: ${NovaConfig.theme.title};
                    margin-bottom: 8px;
                    border-bottom: 1px dashed ${NovaConfig.theme.border};
                    padding-bottom: 4px;
                }

                .nova-status {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 4px;
                    font-size: 11px;
                }

                .nova-status-label {
                    color: ${NovaConfig.theme.text};
                }

                .nova-status-value {
                    color: ${NovaConfig.theme.title};
                    font-weight: bold;
                }

                .nova-feature {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 12px 0;
                    border-bottom: 1px dashed ${NovaConfig.theme.border};
                }

                .nova-feature:last-child {
                    border-bottom: none;
                }

                .nova-feature-name {
                    color: ${NovaConfig.theme.text};
                    padding: 6px 0;
                }

                .nova-subfeature {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    border-bottom: none;
                }

                .nova-feature.nova-group {
                    display: block;
                }

                .nova-feature[data-feature-id="classes.cycle"] {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                
                .nova-feature[data-feature-id="classes.cycle.settings"] {
                    padding-top: 0;
                }

                .nova-feature-actions {
                    display: flex;
                    gap: 6px;
                    margin-left: auto;
                }

                .nova-feature-btn {
                    background: transparent;
                    border: none;
                    color: ${NovaConfig.theme.text};
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    padding-right: 0;
                }

                .nova-feature-btn:hover {
                    color:${NovaConfig.theme.title};
                }

                .nova-feature-btn.ok.active {
                    color: ${NovaConfig.theme.success};
                }

                .nova-feature-btn.x.active {
                    color: ${NovaConfig.theme.error};
                }

                .nova-section-description {
                    font-size: 11px;
                    color: ${NovaConfig.theme.text};
                    opacity: 0.8;
                }

                .nova-button {
                    background: transparent;
                    border: none;
                    color: ${NovaConfig.theme.text};
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                    padding: 0;
                }

                .nova-button:hover {
                    color: ${NovaConfig.theme.title};
                    text-decoration: underline dotted ${NovaConfig.theme.success};
                }

                .nova-input {
                    background: transparent;
                    border: none;
                    color: ${NovaConfig.theme.text};
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 12px;
                    text-align: right;
                    width: 100%;
                    outline: none;
                    padding: 0;
                }

                .nova-input::-webkit-outer-spin-button,
                .nova-input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                .nova-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }

                .nova-scrollbar::-webkit-scrollbar-track {
                    background: ${NovaConfig.theme.background};
                }

                .nova-scrollbar::-webkit-scrollbar-thumb {
                    background: ${NovaConfig.theme.border};
                    border-radius: 6px;
                }

                .nova-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${NovaConfig.theme.text};
                }

                .nova-toast-container {
                    position: fixed;
                    bottom: 16px;
                    right: 50%;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    transform: translateX(50%);
                    gap: 8px;
                    pointer-events: none;
                    user-select: none;
                }

                .nova-toast {
                    width: 300px;
                    background: ${NovaConfig.theme.background};
                    color: ${NovaConfig.theme.text};
                    border: 1px solid ${NovaConfig.theme.border};
                    border-radius: 12px;
                    padding: 8px 8px 8px 12px;
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                    opacity: 0;
                    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    pointer-events: auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                }

                .nova-toast.visible {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }

                .nova-toast-message {
                    white-space: pre-line;
                }

                .nova-toast-message.info { border-left: 1px solid ${NovaConfig.theme.text}; padding-left: 7px; height: 12px; line-height: 12px; }
                .nova-toast-message.success { border-left: 1px solid ${NovaConfig.theme.success}; padding-left: 7px; height: 12px; line-height: 12px; }
                .nova-toast-message.error { border-left: 1px solid ${NovaConfig.theme.error}; padding-left: 7px; height: 12px; line-height: 12px; }

                .nova-toast-close {
                    display: flex;
                    margin-left: auto;
                    background: transparent;
                    border: none;
                    color: ${NovaConfig.theme.error};
                    cursor: pointer;
                    font-family: ${NovaConfig.fonts.primary};
                    font-size: 12px;
                }
            `;
            document.head.appendChild(style);
        }

        /**
         * Create and insert the main UI container and wire internal events.
         * Also initializes drag-and-drop and status display.
         */
        create() {
            // Create main container
            this.container = document.createElement('div');
            this.container.className = 'nova-client';
            this.container.innerHTML = `
                <div class="nova-header" id="nova-header">
                    <div class="nova-title">${NovaConfig.name}</div>
                    <div class="nova-version">v${NovaConfig.version}</div>
                </div>
                <div class="nova-content nova-scrollbar">
                    <div class="nova-tab-content" id="profile-tab">
                        <div class="nova-section">
                            <div class="nova-section-title">Profile</div>
                            <div class="nova-section-description">
                                Manage profile-related features.
                            </div>
                        </div>
                    </div>

                    <div class="nova-tab-content" id="chicken-tab">
                        <div class="nova-section">
                            <div class="nova-section-title">Chickens</div>
                            <div class="nova-section-description">
                                Play with chickens!
                            </div>
                        </div>
                    </div>
                    
                    <div class="nova-tab-content" id="gameplay-tab">
                        <div class="nova-section">
                            <div class="nova-section-title">Gameplay</div>
                            <div class="nova-section-description">
                                Gameplay-related features.
                            </div>
                        </div>
                    </div>

                    <div class="nova-tab-content" id="trolling-tab">
                        <div class="nova-section">
                            <div class="nova-section-title">Trolling</div>
                            <div class="nova-section-description">
                                Troll other players.
                            </div>
                        </div>
                    </div>
                    
                    <div class="nova-tabs">
                        <button class="nova-tab" data-tab="profile">👤</button>
                        <button class="nova-tab" data-tab="chicken">🐔</button>
                        <button class="nova-tab" data-tab="gameplay">🎮</button>
                        <button class="nova-tab" data-tab="trolling">👹</button>
                        <button class="nova-tab nova-reload-btn" id="nova-reload" title="Reload Client">↺</button>
                    </div>
                </div>
            `;

            document.body.appendChild(this.container);
            this.setupDragAndDrop();
            this.setupEventListeners();
        }

        /** Enable dragging on the header to reposition the UI */
        setupDragAndDrop() {
            const header = this.container.querySelector('#nova-header');
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;

            header.addEventListener('mousedown', (e) => {
                initialX = e.clientX - this.xOffset;
                initialY = e.clientY - this.yOffset;
                isDragging = true;
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    this.xOffset = currentX;
                    this.yOffset = currentY;
                    this.container.style.transform = `translate(${currentX}px, ${currentY}px)`;
                }
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    // Save the new position when dragging ends
                    const rect = this.container.getBoundingClientRect();
                    this.savePosition(
                        parseInt(this.container.style.left) || 0,
                        parseInt(this.container.style.top) || 0,
                        this.xOffset,
                        this.yOffset
                    );
                }
                isDragging = false;
            });
        }

        /** Attach UI event handlers */
        setupEventListeners() {
            // Toggle UI button
            Dom.onClick('#nova-toggle-ui', () => this.toggle());
            
            // Reload client button
            Dom.onClick('#nova-reload', () => { location.reload(); });

            // Tab switching
            const tabs = this.container.querySelectorAll('.nova-tab:not(.nova-reload-btn)');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.getAttribute('data-tab');
                    this.switchTab(targetTab);
                });
            });

            // Ensure a default tab is selected on load
            this.switchTab('profile');
        }

        /**
         * Switch visible tab by name.
         * @param {string} targetTab
         */
        switchTab(targetTab) {
            // Remove active class from all tabs and content
            const tabs = this.container.querySelectorAll('.nova-tab');
            const contents = this.container.querySelectorAll('.nova-tab-content');
            
            tabs.forEach(tab => tab.classList.remove('active'));
            contents.forEach(content => content.classList.remove('active'));
            
            // Add active class to selected tab and content
            const activeTab = this.container.querySelector(`[data-tab="${targetTab}"]`);
            const activeContent = this.container.querySelector(`#${targetTab}-tab`);
            
            if (activeTab && activeContent) {
                activeTab.classList.add('active');
                activeContent.classList.add('active');
                this.renderFeatures(targetTab);
            }
        }

        /**
         * Render feature toggles into the currently active tab (or specified tab).
         * @param {string=} targetTab
         */
        renderFeatures(targetTab) {
            if (!this.featureRegistry) return;
            // Determine target tab
            let tab = targetTab;
            if (!tab) {
                const activeContent = this.container.querySelector('.nova-tab-content.active');
                if (activeContent && activeContent.id.endsWith('-tab')) {
                    tab = activeContent.id.replace('-tab', '');
                }
            }
            tab = tab || 'profile';

            const defs = this.featureRegistry.features.filter(f => (f.tab || 'profile') === tab);
            const tabEl = this.container.querySelector(`#${tab}-tab`);
            if (!tabEl) return;

            // Ensure a features section exists in this tab if needed
            let section = tabEl.querySelector(`#nova-features-${tab}`);
            if (!section && defs.length > 0) {
                section = document.createElement('div');
                section.className = 'nova-section';
                section.id = `nova-features-${tab}`;
                section.innerHTML = `
                    <div id="nova-features-list-${tab}"></div>
                `;
                tabEl.appendChild(section);
            }

            const list = tabEl.querySelector(`#nova-features-list-${tab}`);
            if (!list) return;

            list.innerHTML = defs.map(def => this.renderFeature(def)).join('');

            this.bindFeatureEvents(list, defs);
        }

        /** Render a single feature row based on its type/controls */
        /**
         * Render a feature row or group based on its definition.
         * @param {{id:string,name:string,type?:string,tab?:string,controls?:Array}} def
         */
        renderFeature(def) {
            const type = def.type || 'toggle';
            if (type === 'button') {
                return `
                    <div class="nova-feature" data-feature-id="${def.id}">
                        <div class="nova-feature-name">${def.name}</div>
                        <div class="nova-feature-actions">
                            <button class="nova-button" data-role="feature-button">${def.buttonLabel || def.name}</button>
                        </div>
                    </div>
                `;
            }
            // group with controls
            if (type === 'group' || Array.isArray(def.controls)) {
                const controls = (def.controls || []).slice();
                // Determine main control: explicit by def.mainControlId, fallback to ctrl.isMain, then first button, then first control
                const mainControl = controls.find(c => def.mainControlId && c.id === def.mainControlId)
                    || controls.find(c => c.isMain)
                    || controls.find(c => c.type === 'button')
                    || controls[0];

                const subControls = controls.filter(c => c && mainControl && c.id !== mainControl.id);

                // Render a single control row helper
                const renderControlRow = (featureId, ctrl, { asMain = false } = {}) => {
                    const controlId = ctrl.id;
                    const stored = this.featureRegistry.getValue(featureId, controlId, ctrl.defaultValue);
                    const labelLeft = asMain ? def.name : (ctrl.label || controlId);
                    if (ctrl.type === 'button') {
                        const buttonText = ctrl.label || 'Action';
                        return `
                            <div class="nova-subfeature ${asMain ? 'nova-group-main' : ''}" data-feature-id="${featureId}" data-control-id="${controlId}">
                                <div class="nova-feature-name">${labelLeft}</div>
                                <div class="nova-feature-actions">
                                    <button class="nova-button" data-control-id="${controlId}" data-control-type="button">${buttonText}</button>
                                </div>
                            </div>
                        `;
                    }
                    if (ctrl.type === 'number') {
                        const min = typeof ctrl.min === 'number' ? `min="${ctrl.min}"` : '';
                        const max = typeof ctrl.max === 'number' ? `max="${ctrl.max}"` : '';
                        const step = typeof ctrl.step === 'number' ? `step="${ctrl.step}"` : '';
                        const value = (stored != null ? stored : (ctrl.defaultValue != null ? ctrl.defaultValue : ''));
                        return `
                            <div class="nova-subfeature ${asMain ? 'nova-group-main' : ''}" data-feature-id="${featureId}" data-control-id="${controlId}">
                                <div class="nova-feature-name">${labelLeft}</div>
                                <div class="nova-feature-actions">
                                    <input type="number" value="${value}" ${min} ${max} ${step} data-control-id="${controlId}" data-control-type="number" class="nova-input" />
                                </div>
                            </div>
                        `;
                    }
                    // text
                    const value = (stored != null ? stored : (ctrl.defaultValue != null ? ctrl.defaultValue : ''));
                    return `
                        <div class="nova-subfeature ${asMain ? 'nova-group-main' : ''}" data-feature-id="${featureId}" data-control-id="${controlId}">
                            <div class="nova-feature-name">${labelLeft}</div>
                            <div class="nova-feature-actions">
                                <input type="text" value="${value}" data-control-id="${controlId}" data-control-type="text" class="nova-input" />
                            </div>
                        </div>
                    `;
                };

                const mainHtml = mainControl ? renderControlRow(def.id, mainControl, { asMain: true }) : '';
                const subsHtml = subControls.map(ctrl => renderControlRow(def.id, ctrl)).join('');

                // Wrap in a group container to keep bottom divider under the lowest subfeature
                return `
                    <div class="nova-feature nova-group" data-feature-id="${def.id}">
                        ${mainHtml}
                        ${subsHtml}
                    </div>
                `;
            }
            // default: toggle feature
            const enabled = this.featureRegistry.isEnabled(def.id);
            return `
                <div class="nova-feature" data-feature-id="${def.id}">
                    <div class="nova-feature-name">${def.name}</div>
                    <div class="nova-feature-actions">
                        <button class="nova-feature-btn x ${enabled ? '' : 'active'}" data-action="disable" title="Disable">X</button>
                        <button class="nova-feature-btn ok ${enabled ? 'active' : ''}" data-action="enable" title="Enable">✔</button>
                    </div>
                </div>
            `;
        }

        /** Bind events for features and their controls */
        /** Wire click/change handlers for feature rows and controls. */
        bindFeatureEvents(list, defs) {
            const byId = {};
            defs.forEach(d => { byId[d.id] = d; });

            // Toggle features enable/disable
            list.querySelectorAll('.nova-feature-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const row = e.currentTarget.closest('.nova-feature');
                    if (!row) return;
                    const id = row.getAttribute('data-feature-id') || row.getAttribute('data-id');
                    const action = e.currentTarget.getAttribute('data-action');
                    if (!id || !action) return;
                    await this.featureRegistry.setEnabled(id, action === 'enable');
                    const enableBtn = row.querySelector('.nova-feature-btn.ok');
                    const disableBtn = row.querySelector('.nova-feature-btn.x');
                    const isEnabled = this.featureRegistry.isEnabled(id);
                    if (enableBtn && disableBtn) {
                        enableBtn.classList.toggle('active', isEnabled);
                        disableBtn.classList.toggle('active', !isEnabled);
                    }
                });
            });

            // Feature-level primary button
            list.querySelectorAll('[data-role="feature-button"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const row = e.currentTarget.closest('.nova-feature, .nova-subfeature');
                    if (!row) return;
                    const featureId = row.getAttribute('data-feature-id');
                    const def = byId[featureId];
                    def && def.onAction && def.onAction(this.getFeatureContext(featureId));
                });
            });

            // Button controls
            list.querySelectorAll('button[data-control-type="button"]').forEach(el => {
                const row = el.closest('.nova-subfeature, .nova-feature');
                if (!row) return;
                const featureId = row.getAttribute('data-feature-id');
                const def = byId[featureId];
                if (!def) return;
                const controlId = el.getAttribute('data-control-id');
                const ctrl = (def.controls || []).find(c => c.id === controlId);
                if (!ctrl) return;
                el.addEventListener('click', () => {
                    ctrl.onClick && ctrl.onClick(this.getFeatureContext(featureId));
                });
            });

            // Toggle controls
            list.querySelectorAll('input[data-control-type="toggle"]').forEach(el => {
                const row = el.closest('.nova-subfeature, .nova-feature');
                if (!row) return;
                const featureId = row.getAttribute('data-feature-id');
                const def = byId[featureId];
                if (!def) return;
                const controlId = el.getAttribute('data-control-id');
                const ctrl = (def.controls || []).find(c => c.id === controlId);
                if (!ctrl) return;
                const handleChange = () => {
                    const value = !!el.checked;
                    this.featureRegistry.setValue(featureId, controlId, value);
                    ctrl.onChange && ctrl.onChange(this.getFeatureContext(featureId), value);
                };
                el.addEventListener('change', handleChange);
            });

            // Number controls
            list.querySelectorAll('input[data-control-type="number"]').forEach(el => {
                const row = el.closest('.nova-subfeature, .nova-feature');
                if (!row) return;
                const featureId = row.getAttribute('data-feature-id');
                const def = byId[featureId];
                if (!def) return;
                const controlId = el.getAttribute('data-control-id');
                const ctrl = (def.controls || []).find(c => c.id === controlId);
                if (!ctrl) return;
                const handleChange = () => {
                    const value = Number(el.value);
                    this.featureRegistry.setValue(featureId, controlId, value);
                    ctrl.onChange && ctrl.onChange(this.getFeatureContext(featureId), value);
                };
                el.addEventListener('change', handleChange);
                el.addEventListener('input', handleChange);
            });

            // Text controls
            list.querySelectorAll('input[data-control-type="text"]').forEach(el => {
                const row = el.closest('.nova-subfeature, .nova-feature');
                if (!row) return;
                const featureId = row.getAttribute('data-feature-id');
                const def = byId[featureId];
                if (!def) return;
                const controlId = el.getAttribute('data-control-id');
                const ctrl = (def.controls || []).find(c => c.id === controlId);
                if (!ctrl) return;
                const handleChange = () => {
                    const value = el.value;
                    this.featureRegistry.setValue(featureId, controlId, value);
                    ctrl.onChange && ctrl.onChange(this.getFeatureContext(featureId), value);
                };
                el.addEventListener('change', handleChange);
                el.addEventListener('input', handleChange);
            });
        }

        /** Context passed to feature/control handlers */
        /** Build a handler context for a given feature id. */
        getFeatureContext(featureId) {
            return {
                featureId,
                getValue: (controlId, defValue) => this.featureRegistry.getValue(featureId, controlId, defValue),
                setValue: (controlId, value) => this.featureRegistry.setValue(featureId, controlId, value),
                isEnabled: () => this.featureRegistry.isEnabled(featureId),
                enable: () => this.featureRegistry.setEnabled(featureId, true),
                disable: () => this.featureRegistry.setEnabled(featureId, false),
                ui: this,
                featureRegistry: this.featureRegistry,
                NovaAPI: window.NovaAPI
            };
        }

        /** Show/hide the UI with animation */
        toggle() {
            this.isVisible = !this.isVisible;
            
            if (this.isVisible) {
                // Center the UI on screen
                this.centerUI();
                // Small delay to ensure positioning is complete before animation
                setTimeout(() => {
                    this.container.classList.add('visible');
                }, 10);
            } else {
                this.container.classList.remove('visible');
            }
        }

        /** Spawn chickens across map spawn points using Unity SendMessage */
        spawnChickens(count) {
            try {
                if (!Number.isFinite(count) || count < 1) count = 1;
                if (count > 99) count = 99;
                const MAX_SPAWN_POINTS = 11; // indices 0..10
                if (!UnityModule.isAvailable()) {
                    Logger.warn('Unity instance not ready; cannot spawn chickens yet');
                    return;
                }
                for (let idx = 0; idx < MAX_SPAWN_POINTS; idx++) {
                    for (let i = 0; i < count; i++) {
                        UnityModule.send('MapScripts', 'SpawnChicken', idx);
                    }
                }
                Logger.log(`Spawned chickens: ${count} per point x ${MAX_SPAWN_POINTS} points`);
            } catch (e) {
                Logger.warn('Failed to spawn chickens', e);
            }
        }

        /** Position the UI at a saved location, or center it initially */
        centerUI() {
            // Try to load saved position first
            const savedPosition = this.loadPosition();
            
            if (savedPosition) {
                // Use saved position
                this.container.style.left = savedPosition.left + 'px';
                this.container.style.top = savedPosition.top + 'px';
                this.container.style.right = 'auto';
                this.xOffset = savedPosition.xOffset || 0;
                this.yOffset = savedPosition.yOffset || 0;
                
                // Apply the saved transform
                if (this.xOffset !== 0 || this.yOffset !== 0) {
                    this.container.style.transform = `translate(${this.xOffset}px, ${this.yOffset}px)`;
                } else {
                    this.container.style.transform = 'none';
                }
            } else {
                // Center the UI on screen
                const rect = this.container.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                
                const left = (windowWidth - rect.width) / 2;
                const top = (windowHeight - rect.height) / 2;
                
                this.container.style.left = left + 'px';
                this.container.style.top = top + 'px';
                this.container.style.right = 'auto';
                this.container.style.transform = 'none';
                this.xOffset = 0;
                this.yOffset = 0;
                
                // Save the centered position
                this.savePosition(left, top, 0, 0);
            }
        }

        /**
         * Persist the UI position and transform offsets.
         * @param {number} left
         * @param {number} top
         * @param {number} xOffset
         * @param {number} yOffset
         */
        savePosition(left, top, xOffset, yOffset) {
            try {
                const position = {
                    left: left,
                    top: top,
                    xOffset: xOffset,
                    yOffset: yOffset,
                    timestamp: Date.now()
                };
                Storage.set(StorageKeys.position, position);
            } catch (e) {
                Logger.warn('Could not save position:', e);
            }
        }

        /**
         * Load a previously saved UI position, if still valid.
         * @returns {{left:number,top:number,xOffset:number,yOffset:number,timestamp:number}|null}
         */
        loadPosition() {
            try {
                const position = Storage.get(StorageKeys.position);
                if (position) {
                    
                    // Check if position is still valid (within reasonable bounds)
                    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                    if (Date.now() - position.timestamp > maxAge) {
                        Storage.remove(StorageKeys.position);
                        return null;
                    }
                    
                    return position;
                }
            } catch (e) {
                Logger.warn('Could not load position:', e);
                Storage.remove(StorageKeys.position);
            }
            return null;
        }
    }

    // Initialize Nova Client when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new NovaClient();
        });
    } else {
        new NovaClient();
    }

    // Export for debugging
    window.NovaClient = NovaClient;
    window.NovaConfig = NovaConfig;
    // Structured exports
    try {
        window.Nova = window.Nova || {};
        window.Nova.Core = {
            Logger,
            Dom,
            EventUnblocker,
            Storage,
            StorageKeys,
            FeatureRegistry
        };
        window.Nova.Hooks = { WebGLHooks };
        window.Nova.Interop = { FirebaseModule, UnityModule };
        window.Nova.Modules = Object.assign({}, window.Nova.Modules || {}, { Chat: ChatModule });
        window.Nova.UI = { NovaUI };
        window.Nova.Client = { NovaClient };
        window.Nova.Config = NovaConfig;
    } catch (_e) {}

})();
