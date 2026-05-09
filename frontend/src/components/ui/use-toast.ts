'use client';

import * as React from 'react';

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type ToastAction =
  | { type: 'ADD'; toast: ToastItem }
  | { type: 'DISMISS'; id: string }
  | { type: 'REMOVE'; id: string };

const MAX_TOASTS = 3;

function reducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case 'ADD':
      return [action.toast, ...state].slice(0, MAX_TOASTS);
    case 'DISMISS':
      return state.map((t) =>
        t.id === action.id ? { ...t, open: false } : t
      ) as ToastItem[];
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// Module-level store so multiple useToast() callers share state.
let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return String(count);
}

type Listener = (toasts: ToastItem[]) => void;
let memoryState: ToastItem[] = [];
const listeners: Set<Listener> = new Set();

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export function toast(options: ToastOptions) {
  const id = genId();
  const duration = options.duration ?? 4000;

  dispatch({
    type: 'ADD',
    toast: { id, ...options },
  });

  setTimeout(() => {
    dispatch({ type: 'REMOVE', id });
  }, duration);

  return id;
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(memoryState);

  React.useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  const dismiss = React.useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  return { toasts, toast, dismiss };
}
