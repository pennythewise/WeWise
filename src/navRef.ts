/** Lets non-React code (autoplay) navigate. AppShell registers the router's navigate here. */
let fn: ((to: string) => void) | null = null;
export const setNavigate = (f: (to: string) => void) => { fn = f; };
export const go = (to: string) => fn?.(to);
