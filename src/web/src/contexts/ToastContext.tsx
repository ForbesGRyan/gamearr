import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { SUCCESS_MESSAGE_TIMEOUT_MS } from '../utils/constants';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;
function generateId(): string {
  return `toast-${++toastId}-${Date.now()}`;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear the timer if it exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration?: number) => {
    const id = generateId();
    const toastDuration = duration ?? SUCCESS_MESSAGE_TIMEOUT_MS;

    const newToast: Toast = {
      id,
      message,
      type,
      duration: toastDuration,
    };

    setToasts((prev) => [...prev, newToast]);

    // Set up auto-dismiss timer
    if (toastDuration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, toastDuration);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
