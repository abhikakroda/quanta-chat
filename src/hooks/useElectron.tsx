import { useMemo } from "react";

/**
 * Detect if the app is running inside an Electron shell.
 * 
 * Detection methods (in priority order):
 * 1. Electron preload script sets `window.isElectron = true`
 * 2. navigator.userAgent contains "Electron"
 * 3. `window.process?.type` exists (Node integration enabled)
 */
export function useIsElectron(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    // Custom preload flag (most reliable)
    if ((window as any).isElectron === true) return true;
    // UserAgent check
    if (navigator.userAgent.toLowerCase().includes("electron")) return true;
    // Node process check (when nodeIntegration is on)
    if ((window as any).process?.type) return true;
    return false;
  }, []);
}

/** Non-hook utility for use outside React components */
export function isElectronApp(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).isElectron === true) return true;
  if (navigator.userAgent.toLowerCase().includes("electron")) return true;
  if ((window as any).process?.type) return true;
  return false;
}
