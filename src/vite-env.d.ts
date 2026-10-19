/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_AGENT_BACKEND?: 'mock' | 'http';
  /** Phone number answered by the AI voice agent (real call via tel:). */
  readonly VITE_AI_HOTLINE?: string;
  /** HTTPS endpoint that makes the AI voice agent call the user back. POST { phone, lang, city }. */
  readonly VITE_AI_CALLBACK_URL?: string;
}
