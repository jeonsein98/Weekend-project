import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div id="toast-container" className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`pointer-events-auto flex items-center justify-between p-4 rounded-2xl shadow-lg text-xs font-bold border ${
              toast.type === 'error'
                ? 'bg-[#FAF0F0] text-rose-900 border-rose-200 backdrop-blur-md'
                : toast.type === 'success'
                ? 'bg-[#F0F4F1] text-[#2D3A30] border-[#C2D1C5] backdrop-blur-md'
                : 'bg-[#F9F8F6] text-[#2D2A26] border-[#E8E4D9] backdrop-blur-md'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#7C8E7E] shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#D4A373] shrink-0" />
              )}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              id={`toast-close-${toast.id}`}
              onClick={() => onDismiss(toast.id)}
              className="ml-2 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 opacity-70 hover:opacity-100" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
