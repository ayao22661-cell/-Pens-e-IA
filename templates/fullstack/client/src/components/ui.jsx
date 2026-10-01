// Primitives d'interface réutilisables : boutons, badges, champs, modale, squelettes.
import { useEffect } from 'react';
import { X } from 'lucide-react';

const BUTTON = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
    secondary: 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
};

export function Button({ variant = 'primary', icon: Icon, children, className = '', ...props }) {
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950
                disabled:pointer-events-none disabled:opacity-50 ${BUTTON[variant]} ${className}`}
            {...props}
        >
            {Icon && <Icon className="size-4" aria-hidden />}
            {children}
        </button>
    );
}

export const STATUS = {
    actif: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400' },
    en_attente: { label: 'En attente', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400' },
    archive: { label: 'Archivé', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400' },
};

export function StatusBadge({ status }) {
    const s = STATUS[status] || STATUS.archive;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
            <span className="size-1.5 rounded-full bg-current" />
            {s.label}
        </span>
    );
}

export function Field({ label, error, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
            {children}
            {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
        </label>
    );
}

export const inputCls = `w-full rounded-xl border-0 bg-white px-3 py-2 text-sm ring-1 ring-zinc-200 transition placeholder:text-zinc-400
    focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-zinc-900 dark:ring-zinc-800`;

export function Modal({ open, onClose, title, children, footer }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} />
            <div className="animate-fade-up relative w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                    <h2 className="text-base font-semibold">{title}</h2>
                    <Button variant="ghost" icon={X} onClick={onClose} aria-label="Fermer" className="!p-1.5" />
                </div>
                <div className="px-6 py-5">{children}</div>
                {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">{footer}</div>}
            </div>
        </div>
    );
}

export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800 ${className}`} />;
