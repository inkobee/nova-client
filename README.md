# Nova Client Lite
Developer‑focused overlay and quality‑of‑life toolkit for Kour.io.

Nova Client Lite is a minimal Tampermonkey/Violentmonkey userscript that adds a clean panel, in‑game overlays, and an extensible feature system. It favors stability and performance with defensive error handling and unobtrusive UI.

## Highlights
- Panel UI with tabs and settings; draggable with position persistence
- Chat overlay with input focus (Enter/Escape) and Unity color markup
- Always‑on leaderboard overlay (top players by score)
- Hotkey to toggle panel: `Right Shift` (`ShiftRight`)
- Lightweight notification toasts (info/success/error)
- WebGL hook framework for feature‑scoped instrumentation
- Input unblocking so panel text fields and buttons work reliably
- Gentle ad cleanup for known placements

### Built‑in Features
- Profile: Hide Name — rotates your visible nickname safely
- Profile: Give KP — calls in‑game shop panel to grant KP (for testing)
- Gameplay: ESP — raise player meshes in depth to keep them visible
- Gameplay: Cycle Classes — cycle through chosen classes via a key
- Gameplay: Rapid RPG (experimental) — increases reload cadence via switching
- Chicken: Spawner — spawn a flock for fun testing
- Chicken: Hide/ESP — hide chickens or render them on top via shader tweak
- Trolling: Send to Sky — nudge everyone upward (testing playground)
- Trolling: Nuke All Players — apply a disruptive action to all players

Notes
- Some items are experimental/testing utilities. Use responsibly and at your own risk.
- Certain features are mutually exclusive (e.g., `Cycle Classes` vs `Rapid RPG`, `Chicken ESP` vs `Hide Chickens`). The UI prevents conflicts when possible.

## Installation
Prerequisite: install the Tampermonkey or Violentmonkey browser extension.

Manual install
1. Open Tampermonkey → Create a new script
2. Replace the template with the contents of `nova-client.user.js`
3. Save the script
4. Visit `https://kour.io/`
5. Nova loads automatically at `document-start`

Why it works
- The userscript includes `@match https://kour.io/*` (and subdomains) and a `@require` to Unity Web Modkit so WebGL hooks are available early.

## Usage
- Toggle panel: press `Right Shift`
- Drag to move: grab the panel header; position persists per session
- Chat overlay: `Enter` to focus, `Escape` to unfocus; colors match in‑game
- Leaderboard/chat: only visible while a map is active (pointer‑lock)

## Configuration
Edit `NovaConfig` inside `nova-client.user.js` to adjust look & behavior:

- Version/name: surfaced in the panel header
- Theme: `background`, `accent`, `title`, `text`, `border`, `success`, `error`, `purple`, `orange`, `yellow`, `blue`
- Fonts: `fonts.primary` (defaults to IBM Plex Mono)
- Hotkeys: `hotkeys.toggleUI` → `{ code: 'ShiftRight', label: 'Right Shift' }`

## Developer API
Nova exposes a small API at `window.NovaAPI` for registering features, showing notifications, and hooking WebGL. See inline JSDoc in `nova-client.user.js` for full details.

Register a feature (toggle)
```
NovaAPI.registerFeature({
  id: 'demo.feature',
  name: 'Demo Feature',
  tab: 'general',
  onEnable: () => { NovaAPI.success('Demo on'); return true; },
  onDisable: () => { NovaAPI.info('Demo off'); }
});
```

Register a feature group with controls
```
NovaAPI.registerFeature({
  id: 'demo.group',
  name: 'Demo Group',
  tab: 'general',
  type: 'group',
  mainControlId: 'run',
  controls: [
    { id: 'run', type: 'button', label: 'Run', onClick: (ctx) => {/* ... */} },
    { id: 'count', type: 'number', label: 'Count', defaultValue: 10 }
  ]
});
```

Hook WebGL (feature‑scoped)
```
NovaAPI.webgl.install();
NovaAPI.webgl.register('demo.feature', 'drawElements', ({ gl, args, method }) => {
  // observe or modify; return { args } to replace, { skipOriginal: true } to drop
});
```

Notifications
```
NovaAPI.notify('Hello');
NovaAPI.success('Saved');
NovaAPI.error({ message: 'Oops', durationMs: 8000 });
```

## Troubleshooting
- Script doesn’t load: ensure the userscript is enabled and that `@match` covers `https://kour.io/*` and `https://*.kour.io/*`.
- Nothing happens on `Right Shift`: verify your keyboard sends `ShiftRight` (some layouts swap keys). Update `NovaConfig.hotkeys.toggleUI.code` if needed.
- WebGL features not working: check that Unity Web Modkit loaded (Network tab should show the `@require` URL fetched). Some security extensions can block cross‑origin `@require`.
- UI clicks don’t register: Nova unblocks events inside the panel, but other overlays/extensions can interfere. Temporarily disable conflicts.
- Experimental features: ESP/Hide/Send/Nuke are best‑effort and may break with game updates.

## Extras
- WebSocket logger: `ws-logger.user.js` logs send/receive frames and highlights likely chat frames to the DevTools console; useful for reverse‑engineering.

## Technical Notes
- Plain JavaScript (ES6+); no build step
- Runs at `document-start`; Unity Web Modkit is pulled via `@require`
- Modular architecture (UI, registry, hooks, interop) with defensive error handling

## Roadmap
- Optional performance overlays and instrumentation
- Additional feature presets and UI polish

## License
MIT

---

Nova Client is intended for educational and enhancement purposes. Use responsibly and respect Kour.io’s terms of service.
