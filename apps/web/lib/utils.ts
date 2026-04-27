import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a cryptographically secure random ID.
 * Uses crypto.getRandomValues() for secure random generation.
 */
export function generateId(length: number = 8): string {
  const arr = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    // Fallback for environments without crypto (e.g., some SSR scenarios)
    for (let i = 0; i < length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}
