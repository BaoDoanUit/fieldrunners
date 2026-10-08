/**
 * Haptics — thin wrapper for the standard `navigator.vibrate` API.
 *
 * iOS Safari does NOT support `navigator.vibrate` — haptics are only
 * available through a PWA-installed webview or via the Capacitor
 * Haptics plugin. This module silently no-ops on unsupported platforms.
 * Phase 4 will extend it to call `Capacitor.Plugins.Haptics.impact(...)`
 * when the app runs under Capacitor.
 */

export type HapticStyle = "light" | "medium" | "heavy" | "selection";

const DURATIONS: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 18,
  heavy: 28,
  selection: 4
};

class HapticsImpl {
  private _enabled = true;
  private _supported: boolean;

  constructor() {
    this._supported = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  isSupported(): boolean {
    return this._supported;
  }

  setEnabled(value: boolean): void {
    this._enabled = value;
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  /** Fire a haptic. No-op on unsupported platforms or when disabled. */
  impact(style: HapticStyle = "light"): void {
    if (!this._enabled || !this._supported) return;
    try {
      navigator.vibrate(DURATIONS[style]);
    } catch {
      // Some browsers throw on vibrate() if not in a user-gesture context.
    }
  }
}

export const Haptics = new HapticsImpl();
