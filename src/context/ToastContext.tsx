import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  description: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (description: string, title?: string) => string;
  error: (description: string, title?: string) => string;
  warning: (description: string, title?: string) => string;
  info: (description: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    const duration = message.duration ?? 4000;

    setToasts(prev => [...prev, { ...message, id }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const success = useCallback(
    (description: string, title?: string) =>
      showToast({ type: 'success', description, title }),
    [showToast]
  );

  const error = useCallback(
    (description: string, title?: string) =>
      showToast({ type: 'error', description, title }),
    [showToast]
  );

  const warning = useCallback(
    (description: string, title?: string) =>
      showToast({ type: 'warning', description, title }),
    [showToast]
  );

  const info = useCallback(
    (description: string, title?: string) =>
      showToast({ type: 'info', description, title }),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};
