'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Estilo rojo para acciones destructivas (eliminar). Por defecto true. */
  danger?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  /** Reemplazo de window.confirm(): devuelve una promesa con la respuesta del usuario. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { box: string; icon: ReactNode }> = {
  success: { box: 'bg-emerald-600 text-white shadow-emerald-900/20', icon: <CheckCircle2 size={20} className="shrink-0" /> },
  error:   { box: 'bg-red-600 text-white shadow-red-900/20',         icon: <AlertCircle size={20} className="shrink-0" /> },
  info:    { box: 'bg-gray-900 text-white shadow-black/20',          icon: <Info size={20} className="shrink-0" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success', durationMs = 2800) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => dismiss(id), durationMs);
  }, [dismiss]);

  const confirm = useCallback((options: ConfirmOptions) => {
    // Si había un confirm abierto, se resuelve como cancelado
    confirmResolver.current?.(false);
    setConfirmState(options);
    return new Promise<boolean>(resolve => { confirmResolver.current = resolve; });
  }, []);

  const closeConfirm = (result: boolean) => {
    confirmResolver.current?.(result);
    confirmResolver.current = null;
    setConfirmState(null);
  };

  const danger = confirmState?.danger ?? true;

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* TOASTS */}
      <div
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[120] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              role="status"
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={`pointer-events-auto w-full max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl ${STYLES[t.type].box}`}
            >
              {STYLES[t.type].icon}
              <p className="flex-1 text-sm font-semibold leading-snug break-words">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="p-1 rounded-full hover:bg-white/15 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MODAL DE CONFIRMACIÓN */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            key="confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => closeConfirm(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${danger ? 'bg-red-50 text-red-500' : 'bg-vinotinto/10 text-vinotinto'}`}>
                <AlertTriangle size={24} />
              </div>
              <h2 id="confirm-title" className="text-lg font-bold text-gray-900 leading-snug break-words">{confirmState.title}</h2>
              {confirmState.message && (
                <p className="text-sm text-gray-500 mt-2 leading-relaxed break-words">{confirmState.message}</p>
              )}
              <div className="flex gap-2 mt-6">
                <button
                  id="confirm-cancel-btn"
                  type="button"
                  onClick={() => closeConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition"
                >
                  {confirmState.cancelText ?? 'Cancelar'}
                </button>
                <button
                  id="confirm-accept-btn"
                  type="button"
                  autoFocus
                  onClick={() => closeConfirm(true)}
                  className={`flex-1 py-3 text-white rounded-xl font-bold shadow-md transition hover:opacity-90 ${danger ? 'bg-red-600 shadow-red-600/20' : 'bg-gradient-to-r from-vinotinto to-vinotinto-light shadow-vinotinto/20'}`}
                >
                  {confirmState.confirmText ?? (danger ? 'Eliminar' : 'Aceptar')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
