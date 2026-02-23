'use client';

/**
 * Lightweight, dependency-free toast system.
 *
 * Usage (outside React):
 *   import { toast } from '@/lib/hooks/use-toast';
 *   toast.success('User created');
 *   toast.error('Something went wrong', 'Details here');
 *
 * Usage (inside Toaster component):
 *   const { toasts, dismiss } = useToaster();
 */

import { useState, useEffect } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

type Subscriber = (toasts: ToastItem[]) => void;

// Module-level state — survives re-renders without a Context provider.
let _toasts: ToastItem[] = [];
let _counter = 0;
const _subscribers = new Set<Subscriber>();

function _notify() {
  const snapshot = [..._toasts];
  _subscribers.forEach((fn) => fn(snapshot));
}

function _dismiss(id: string) {
  _toasts = _toasts.filter((t) => t.id !== id);
  _notify();
}

function _add(
  title: string,
  variant: ToastVariant,
  description?: string,
  duration = 4500,
): string {
  const id = String(++_counter);
  _toasts = [{ id, title, description, variant, duration }, ..._toasts].slice(
    0,
    5,
  ); // cap at 5 visible toasts
  _notify();
  setTimeout(() => _dismiss(id), duration);
  return id;
}

export const toast = {
  success: (title: string, description?: string) =>
    _add(title, 'success', description),
  error: (title: string, description?: string) =>
    _add(title, 'error', description),
  warning: (title: string, description?: string) =>
    _add(title, 'warning', description),
  info: (title: string, description?: string) =>
    _add(title, 'default', description),
  dismiss: _dismiss,
};

/** Subscribe to the toast store. Used by `<Toaster />`. */
export function useToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    _subscribers.add(setToasts);
    setToasts([..._toasts]);
    return () => {
      _subscribers.delete(setToasts);
    };
  }, []);

  return { toasts, dismiss: _dismiss };
}
