/**
 * Debug tools (debug menu, fish gallery): always in dev builds, and in a deployed test build
 * when it is built with VITE_DEBUG_TOOLS=1 (the Cloudflare Pages project sets it until launch).
 */
export const DEBUG_TOOLS: boolean = import.meta.env.DEV || import.meta.env.VITE_DEBUG_TOOLS === '1';
