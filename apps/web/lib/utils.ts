import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a cryptographically secure random ID.
 * Falls back to Math.random only if crypto is unavailable.
 */
export function generateId(length: number = 8): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  return Math.random().toString(36).slice(2, 2 + length);
}
