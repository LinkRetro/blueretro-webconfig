/**
 * Site-wide prerender: every route gets a real index.html at build time.
 *
 * Why prerender (instead of shipping only a 404.html for client-side fallback):
 *   - This tool is served from a static /tools/blueretro-webconfig/ sub-path,
 *     directory, and Astro / nginx will not necessarily do SPA fallback for us;
 *   - Once prerendered, /guide/, /system/update/ and /controller/global/ are real
 *     files, so deep links, refreshes and open-in-new-window all just work.
 *
 * Every browser API in these pages is used only in event handlers or onMount, so
 * nothing fires during the build.
 */
export const prerender = true;
export const trailingSlash = 'always';
