# LinkRetro Web Config

Browser-based configuration tool for the **LinkRetro wireless receiver**, built on
[BlueRetro WebCfg](https://github.com/darthcloud/BlueRetroWebCfg_Beta) (Apache-2.0).

It adds the LinkRetro brand layer, an English illustrated manual, split
**USB Update / OTA Update** firmware flows and bundled presets.

| | |
|---|---|
| Upstream | darthcloud/BlueRetroWebCfg_Beta (base commit `8bc92d1`, 2026-05-30) |
| Public repo | `LinkRetro/blueretro-webconfig` (fork) |
| Stack | SvelteKit 2 · Svelte 5 · Tailwind 4 · Skeleton · static adapter (prerendered) |
| License | Apache-2.0 — see `LICENSE`; attribution in the UI must stay |

## 1. Repository layout

```
LINKRETRO-WEB-CONFIG/
├─ src/            pages and logic (Svelte 5)
├─ static/         brand assets, fonts + licence, presets, updater, gameid.db
├─ firmware/       local firmware images (binaries are git-ignored, never published)
├─ tools/          build / dev / firmware / preset scripts
├─ build/, dist/, OTA_Firmware/   build products (git-ignored)
```

An earlier branded edition lives next to this project in the author's workspace;
it is not required to build or run this project.

## 2. Commands

```powershell
pwsh -File tools\pnpm.ps1 install   # install dependencies (first time)
pwsh -File tools\dev.ps1            # dev server on http://127.0.0.1:5173/
pwsh -File tools\build.ps1 -BasePath /tools/blueretro-webconfig -SkipInstall
node tools\check-dist.mjs dist /tools/blueretro-webconfig
```

`tools\pnpm.ps1` exists because the machine's `pnpm` wrapper fails with
`spawn EPERM` inside the sandbox; it calls the pnpm core script directly.
On a normal machine you can use `pnpm install` / `pnpm dev` instead.

Builds are **prerendered**: every route becomes its own `index.html`
(`/guide/`, `/controller/global/`, `/system/update/`, …), so deep links work on
any static host without a SPA fallback rule.

## 3. Build products

| Directory | Contents |
|---|---|
| `build/` | Static adapter output (no `index.html`; `404.html` is the fallback) |
| `dist/` | `build/` plus a copy of `404.html` named `index.html` — the site to copy to a static host |
| `OTA_Firmware/` | App-only images extracted from the full images (for USB stick delivery) |

`-BasePath` sets the asset prefix. This project builds for the
`/tools/blueretro-webconfig` sub-path; leave it empty for a domain root.

**Firmware is not published**: `firmware/*.bin` is git-ignored and only read
locally by the build. Put your own full images in `firmware/` before building.

## 4. Visual language

The layout follows the upstream web config (top bar, grouped left navigation,
connection button, content column). Differences are colour, type and details:

| Area | Upstream | This project |
|---|---|---|
| Top bar | light grey `#E1E4EB` | white + 1px border + a 2px magenta→violet→cyan hairline |
| Brand | BlueRetro lockup | LinkRetro pixel logo + “Wireless Receiver Web Config” |
| Primary | indigo | brand magenta `#B41674` |
| Sidebar | light blue-grey `#F7F8FA` | very light lilac `#F7F6FB` |
| Active item | solid indigo pill | light magenta pill with deep magenta text |
| Headings | system serif | Space Grotesk (`-0.02em`) |
| Buttons | rounded rectangle | pill (`999px`) |
| Footer | none | permanent Apache-2.0 attribution under the sidebar |

Colours come from linkretro.com's `styles.css` `:root`; Skeleton scale lives in
`src/theme-linkretro.css`, the design layer in `src/app.css`.

## 5. What changed vs upstream

| Area | Change |
|---|---|
| Shell | white top bar with a gradient hairline; grouped sidebar navigation; permanent attribution |
| Manual | new `/guide` page: 7 concept chapters + 11 page chapters, with screenshots |
| Per-page help | “How to use this page” block, collapsible, remembered per page |
| Field help | `?` next to options opens a short explanation |
| Updates | firmware update split into **USB Update** and **OTA Update** pages |
| Presets | preset list is published with the site (`static/config/presets/index.json`) |
| Version banner | upstream “Upgrade Available” check removed |
| CNAME | upstream CNAME removed |
| Dark mode | Tailwind `dark:` variants are always off; the UI is always light |
| Firmware | not stored in the public repository; add local images before building |

Functional code (Web Bluetooth, reconnect policy, configuration read/write,
N64/DC/PS1 memory cards, OTA writing) is upstream logic with the UI layer replaced.

## 6. Where to change what

| Want to change | File |
|---|---|
| Product name, site link, page title, BLE name prefix | `src/lib/brand.ts` |
| Manual / page help / field popovers | `src/lib/help/content.ts` |
| Colours, radius, type tokens | `src/app.css` `:root` + `src/theme-linkretro.css` |
| Buttons, cards, forms, sidebar, footer | `src/app.css` |
| Preset images on the manual | `static/guide/` (see §8) |
| Built-in presets | `static/config/presets/` then `node tools\gen-presets-index.mjs` |

## 7. Source map

| Path | Purpose |
|---|---|
| `src/routes/+layout.svelte` | Top bar, sidebar, connection state, toasts |
| `src/routes/+layout.ts` | Prerender + trailing slash configuration |
| `src/lib/components/NavigationMenu.svelte` | Sidebar groups and attribution |
| `src/lib/components/PageGuide.svelte` | “How to use this page” block |
| `src/lib/components/HelpTip.svelte` | `?` popover for a single option |
| `src/routes/guide/+page.svelte` | Illustrated manual |
| `src/routes/system/update/+page.svelte` | USB update (embedded updater) |
| `src/routes/system/ota/+page.svelte` | Bluetooth OTA update |
| `src/lib/utilities/getService.ts` | BLE connection and retry policy |
| `src/lib/utilities/getDevice.ts` | Device chooser (filters by `bleNamePrefix`) |
| `static/updater/` | Embedded USB updater (vendored, multi-language) |
| `static/gameid.db` | Game ID database (read with sql.js) |

## 8. Firmware and manual screenshots

Firmware: drop full images into `firmware/`; the build runs
`tools/sync-firmware.mjs` (copy + `index.json`) and `tools/extract-ota.mjs`
(slice the app-only image using the partition table). Both outputs are
git-ignored.

Manual screenshots are generated, not hand-captured: serve `dist` at
`/tools/blueretro-webconfig`, capture at 2× device pixels, crop to the content
column, downscale to 1000px and add the numbered markers. Rerun the capture
after UI changes.

## 9. Known issues

- `svelte-check` reports 28 pre-existing upstream errors (`ILogHandler.ts`,
  `routes/controller/buttons`); `vite build` is unaffected.
- Building inside the restricted sandbox fails with `spawn EPERM` (esbuild needs
  a child process pipe); run the build with wider permissions.
- The UI is English-only. The manual is English-only as well. All comments in
  `src/` and `tools/` are English.
- `static/updater/` is a **vendored** USB updater copied from the LinkRetro
  updater project. It ships its own 13-language UI (Chinese included) and is
  embedded as-is; its source lives outside this repository and is not part of
  the app's English-only interface.

## 10. Relationship to earlier editions

This project started from an earlier branded edition (`LinkRetro Web Config`) and
keeps the same features with the current LinkRetro brand layer. Compared to
upstream, the shell, manual, help system, update pages and build scripts are new.
