/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" keeps the debug menu in a production build (test deployments). */
  readonly VITE_DEBUG_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
