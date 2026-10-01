// Notifications de confirmation / d'erreur (coin inférieur droit).
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const push = useCallback((message, type = 'success') => {
        const id = crypto.randomUUID();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
    }, []);

    return (
        <ToastContext.Provider value={push}>
            {children}
            <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className="animate-fade-up flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl dark:bg-white dark:text-zinc-900">
                        {t.type === 'error'
                            ? <AlertCircle className="size-4 text-red-400 dark:text-red-600" />
                            : <CheckCircle2 className="size-4 text-emerald-400 dark:text-emerald-600" />}
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
