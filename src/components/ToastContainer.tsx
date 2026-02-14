import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, ToastMessage } from '@/context/ToastContext';
import { cn } from '@/lib/utils';

const ToastIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    default:
      return null;
  }
};

const SingleToast: React.FC<{
  toast: ToastMessage;
  onClose: (id: string) => void;
}> = ({ toast, onClose }) => {
  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg shadow-lg border animate-in fade-in slide-in-from-right-4 duration-300',
        toast.type === 'success' && 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
        toast.type === 'error' && 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
        toast.type === 'warning' && 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
        toast.type === 'info' && 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
      )}
    >
      <ToastIcon type={toast.type} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p
            className={cn(
              'font-semibold',
              toast.type === 'success' && 'text-green-900 dark:text-green-100',
              toast.type === 'error' && 'text-red-900 dark:text-red-100',
              toast.type === 'warning' && 'text-yellow-900 dark:text-yellow-100',
              toast.type === 'info' && 'text-blue-900 dark:text-blue-100'
            )}
          >
            {toast.title}
          </p>
        )}
        <p
          className={cn(
            'text-sm',
            toast.type === 'success' && 'text-green-800 dark:text-green-200',
            toast.type === 'error' && 'text-red-800 dark:text-red-200',
            toast.type === 'warning' && 'text-yellow-800 dark:text-yellow-200',
            toast.type === 'info' && 'text-blue-800 dark:text-blue-200'
          )}
        >
          {toast.description}
        </p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <SingleToast toast={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
