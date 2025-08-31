// ==UserScript==
// @name         Kour.io WebSocket Logger
// @namespace    nova-tools
// @version      0.1.0
// @description  Log WebSocket frames (send/receive) to console; highlight likely chat frames
// @author       you
// @match        https://kour.io/*
// @match        https://*.kour.io/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CLIENT_CHAT_SIG = new Uint8Array([0xf3, 0x2, 0xfd, 0x3, 0xf6, 0x3, 0x1, 0xf4, 0x22]);

    function toUint8(data, cb) {
        try {
            if (data instanceof ArrayBuffer) return cb(new Uint8Array(data));
            if (ArrayBuffer.isView(data)) return cb(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            if (data instanceof Blob) {
                const fr = new FileReader();
                fr.onload = () => {
                    try { cb(new Uint8Array(fr.result)); } catch (_e) {}
                };
                fr.readAsArrayBuffer(data);
                return;
            }
        } catch (_e) {}
        cb(null);
    }

    function toHex(u8, max = 64) {
        if (!u8) return '';
        const n = Math.min(u8.length, max);
        let out = '';
        for (let i = 0; i < n; i++) out += u8[i].toString(16).padStart(2, '0') + (i + 1 < n ? ' ' : '');
        if (u8.length > n) out += ' …';
        return out;
    }

    function maybeUtf8(u8, maxLen = 256) {
        try {
            if (!u8) return '';
            const view = u8.length > maxLen ? u8.subarray(0, maxLen) : u8;
            const s = new TextDecoder('utf-8', { fatal: false }).decode(view);
            // Show only if mostly printable
            const printable = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            const ratio = printable.length / s.length;
            return ratio > 0.85 ? (s + (u8.length > view.length ? ' …' : '')) : '';
        } catch (_e) { return ''; }
    }

    // Try to parse embedded typed-strings inside binary frames.
    // Typed string format (as used by nova-client): 0x07, varint(len), then len bytes.
    function readVarInt(u8, start) {
        let value = 0;
        let shift = 0;
        let i = start;
        while (i < u8.length) {
            const b = u8[i++];
            value |= (b & 0x7f) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
            if (shift > 28) break;
        }
        return { value, length: i - start };
    }

    function bytesToText(bytes) {
        try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (_e) {
            try { return String.fromCharCode.apply(null, Array.from(bytes)); } catch (_e2) { return ''; }
        }
    }

    function isMostlyPrintable(s) {
        if (!s) return false;
        const clean = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        return clean.length / s.length > 0.85;
    }

    function extractTypedStrings(u8, limit = 4) {
        const out = [];
        if (!u8) return out;
        let i = 0;
        while (i < u8.length && out.length < limit) {
            if (u8[i] !== 0x07) { i++; continue; }
            const { value: len, length: l } = readVarInt(u8, i + 1);
            const start = i + 1 + l;
            const end = start + len;
            if (l <= 0 || len <= 0 || end > u8.length) { i++; continue; }
            const slice = u8.subarray(start, end);
            const text = bytesToText(slice);
            if (text && isMostlyPrintable(text)) {
                // Heuristics: likely chat if reasonable length and has letters
                const t = text.trim();
                if (t.length >= 2 && /[A-Za-z]/.test(t)) out.push(t);
            }
            i = end;
        }
        return out;
    }

    function startsWith(u8, sig) {
        if (!u8 || u8.length < sig.length) return false;
        for (let i = 0; i < sig.length; i++) if (u8[i] !== sig[i]) return false;
        return true;
    }

    function shortUrl(u) {
        try { const { host, pathname } = new URL(u); return host + pathname; } catch (_e) { return String(u || ''); }
    }

    function logFrame(dir, url, data) {
        toUint8(data, (u8) => {
            const len = u8 ? u8.length : (data && data.size) || (data && data.byteLength) || 0;
            let tag = '';
            if (u8 && startsWith(u8, CLIENT_CHAT_SIG)) tag = ' [CHAT OUT]';
            else if (u8 && u8[0] === 0xf3) tag = ' [f3*]';
            const head = u8 ? toHex(u8, 48) : '[non-binary frame]';
            const maybeText = u8 ? maybeUtf8(u8) : (typeof data === 'string' ? data : '');
            const extracted = u8 ? extractTypedStrings(u8, 6) : [];
            if (!maybeText && (!extracted || extracted.length === 0)) return; // Only print frames with text

            const title = `[WS] ${dir} ${shortUrl(url)} | ${len} bytes${tag}`;
            try { console.groupCollapsed(title); } catch (_e) { console.log(title); }
            try {
                console.log('preview (hex):', head);
                if (maybeText) console.log('text (full frame):', maybeText);
                if (extracted && extracted.length) console.log('strings (embedded):', extracted);
                console.log('raw:', data);
            } catch (_e) {}
            try { console.groupEnd(); } catch (_e) {}
        });
    }

    function attach(ws, ctorArgs) {
        const url = ws && ws.url || (ctorArgs && ctorArgs[0]) || '';
        // Wrap send
        try {
            const originalSend = ws.send;
            ws.send = new Proxy(originalSend, {
                apply(target, thisArg, args) {
                    try { logFrame('▶', url, args && args[0]); } catch (_e) {}
                    return Reflect.apply(target, thisArg, args);
                }
            });
        } catch (_e) {}

        // Listen to incoming
        try {
            ws.addEventListener('message', (ev) => {
                try { logFrame('◀', url, ev && ev.data); } catch (_e) {}
            }, true);
        } catch (_e) {}
    }

    // Keep our hook resilient if other scripts replace window.WebSocket later
    let installedWith = null;
    function install() {
        const Current = window.WebSocket;
        if (!Current || installedWith === Current) return;
        installedWith = Current;
        window.WebSocket = new Proxy(Current, {
            construct(target, args, newTarget) {
                const ws = Reflect.construct(target, args, newTarget);
                try { attach(ws, args); } catch (_e) {}
                // Highlight Photon/ExitGames sockets
                try {
                    if (ws.url && /exitgames|photon/i.test(ws.url)) {
                        console.info('[WS] Hooked game socket:', ws.url);
                    }
                } catch (_e) {}
                return ws;
            }
        });
    }

    install();
    const reinstaller = setInterval(install, 1000);
    window.addEventListener('beforeunload', () => { try { clearInterval(reinstaller); } catch (_e) {} });
})();


