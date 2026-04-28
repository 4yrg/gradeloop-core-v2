import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(length?: number): string {
  const id = crypto.randomUUID().replace(/-/g, "")
  return length ? id.slice(0, length) : id
}
