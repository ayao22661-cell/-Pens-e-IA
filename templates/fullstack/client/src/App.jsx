// Écran principal : statistiques, recherche/filtres, tableau triable et paginé, CRUD complet.
// Toutes les données viennent de l'API (server/), rien n'est codé en dur ici.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Plus, Search, Pencil, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    Moon, Sun, LayoutGrid, Wallet, Clock, Archive, Inbox, RefreshCw, Boxes,
} from 'lucide-react';
import { api, formatAmount, formatDate } from './api.js';
import { Button, Modal, Skeleton, StatusBadge, STATUS, inputCls } from './components/ui.jsx';
import { ItemModal } from './components/ItemModal.jsx';
import { ToastProvider, useToast } from './components/Toasts.jsx';

export default function App() {
    return (
        <ToastProvider>
            <Shell />
        </ToastProvider>
    );
}

function useDebounced(value, delay = 300) {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
    return v;
}

function Shell() {
    const toast = useToast();
    const searchRef = useRef(null);
    const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [query, setQuery] = useState({ q: '', status: '', category: '', sort: 'created_at', order: 'desc', page: 1, limit: 8 });
    const q = useDebounced(query.q);
    const [list, setList] = useState(null);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(undefined); // undefined = fermé, null = création, objet = édition
    const [deleting, setDeleting] = useState(null);

    const params = useMemo(() => ({ ...query, q }), [query, q]);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [l, s] = await Promise.all([api.listItems(params), api.stats()]);
            setList(l);
            setStats(s);
        } catch (e) {
            setError(e.message);
        }
    }, [params]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        try { localStorage.theme = dark ? 'dark' : 'light'; } catch { /* stockage indisponible */ }
    }, [dark]);

    // Raccourcis : "/" recherche, "n" nouvel élément
    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || editing !== undefined) return;
            if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
            if (e.key === 'n') { e.preventDefault(); setEditing(null); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [editing]);

    const update = (patch) => setQuery(qs => ({ ...qs, page: 1, ...patch }));
    const toggleSort = (column) => setQuery(qs => ({
        ...qs, sort: column, order: qs.sort === column && qs.order === 'asc' ? 'desc' : 'asc',
    }));

    async function save(values) {
        if (editing) await api.updateItem(editing.id, values);
        else await api.createItem(values);
        toast(editing ? 'Élément mis à jour' : 'Élément créé');
        load();
    }

    async function confirmDelete() {
        try {
            await api.deleteItem(deleting.id);
            toast('Élément supprimé');
            setDeleting(null);
            load();
        } catch (e) {
            toast(e.message, 'error');
        }
    }

    return (
        <div className="flex min-h-dvh">
            <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-white px-4 py-5 lg:flex dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2.5 px-2">
                    <div className="grid size-8 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"><Boxes className="size-4" /></div>
                    <span className="font-semibold tracking-tight">Gestion</span>
                </div>
                <nav className="mt-8 space-y-1 text-sm">
                    <span className="flex items-center gap-2.5 rounded-xl bg-zinc-100 px-3 py-2 font-medium dark:bg-zinc-800">
                        <LayoutGrid className="size-4" /> Éléments
                    </span>
                </nav>
                <div className="mt-auto">
                    <Button variant="ghost" icon={dark ? Sun : Moon} onClick={() => setDark(d => !d)} className="w-full !justify-start">
                        {dark ? 'Mode clair' : 'Mode sombre'}
                    </Button>
                </div>
            </aside>

            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-10">
                <div className="mx-auto max-w-6xl">
                    <header className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Éléments</h1>
                            <p className="mt-1 text-sm text-zinc-500">Suivi des éléments, de leurs montants et de leur statut.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" icon={dark ? Sun : Moon} onClick={() => setDark(d => !d)} className="lg:hidden" aria-label="Changer de thème" />
                            <Button icon={Plus} onClick={() => setEditing(null)}>Nouvel élément</Button>
                        </div>
                    </header>

                    <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard icon={LayoutGrid} label="Éléments" value={stats?.count} />
                        <StatCard icon={Wallet} label="Montant total" value={stats && formatAmount(stats.amount)} />
                        <StatCard icon={Clock} label="En attente" value={stats?.byStatus?.en_attente ?? (stats ? 0 : undefined)} />
                        <StatCard icon={Archive} label="Archivés" value={stats?.byStatus?.archive ?? (stats ? 0 : undefined)} />
                    </section>

                    <section className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
                        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4 dark:border-zinc-800">
                            <div className="relative min-w-52 flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                                <input ref={searchRef} className={`${inputCls} pl-9`} placeholder="Rechercher…  ( / )"
                                    value={query.q} onChange={(e) => update({ q: e.target.value })} />
                            </div>
                            <div className="flex rounded-xl bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
                                {[['', 'Tous'], ...Object.entries(STATUS).map(([k, s]) => [k, s.label])].map(([value, label]) => (
                                    <button key={value} onClick={() => update({ status: value })}
                                        className={`rounded-lg px-3 py-1.5 transition ${query.status === value
                                            ? 'bg-white font-medium shadow-sm dark:bg-zinc-950' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <select className={inputCls.replace('w-full', 'w-full sm:w-auto')} value={query.category} onChange={(e) => update({ category: e.target.value })}>
                                <option value="">Toutes catégories</option>
                                {stats?.categories.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>

                        {error ? (
                            <State icon={RefreshCw} title="Impossible de charger les données" text={error}
                                action={<Button variant="secondary" icon={RefreshCw} onClick={load}>Réessayer</Button>} />
                        ) : list && list.data.length === 0 ? (
                            <State icon={Inbox} title="Aucun élément" text="Aucun résultat pour ces critères."
                                action={<Button icon={Plus} onClick={() => setEditing(null)}>Créer un élément</Button>} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                                        <tr>
                                            {[['name', 'Nom'], ['category', 'Catégorie'], ['status', 'Statut'], ['amount', 'Montant'], ['created_at', 'Créé le']].map(([col, label]) => (
                                                <th key={col} className={`px-4 py-3 font-medium ${col === 'amount' ? 'text-right' : ''}`}>
                                                    <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100">
                                                        {label}
                                                        {query.sort === col && (query.order === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />)}
                                                    </button>
                                                </th>
                                            ))}
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {!list ? Array.from({ length: 5 }, (_, i) => (
                                            <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-6" /></td></tr>
                                        )) : list.data.map(item => (
                                            <tr key={item.id} className="animate-fade-up group transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-4 py-3 font-medium">{item.name}</td>
                                                <td className="px-4 py-3 text-zinc-500">{item.category}</td>
                                                <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                                                <td className="px-4 py-3 text-right tabular-nums">{formatAmount(item.amount)}</td>
                                                <td className="px-4 py-3 text-zinc-500">{formatDate(item.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                                        <Button variant="ghost" icon={Pencil} className="!p-1.5" aria-label="Modifier" onClick={() => setEditing(item)} />
                                                        <Button variant="ghost" icon={Trash2} className="!p-1.5 hover:!text-red-600" aria-label="Supprimer" onClick={() => setDeleting(item)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {list && list.total > 0 && (
                            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
                                <span>{list.total} élément(s) · page {list.page} / {list.pages}</span>
                                <div className="flex gap-1">
                                    <Button variant="secondary" icon={ChevronLeft} className="!p-1.5" aria-label="Page précédente"
                                        disabled={list.page <= 1} onClick={() => setQuery(qs => ({ ...qs, page: qs.page - 1 }))} />
                                    <Button variant="secondary" icon={ChevronRight} className="!p-1.5" aria-label="Page suivante"
                                        disabled={list.page >= list.pages} onClick={() => setQuery(qs => ({ ...qs, page: qs.page + 1 }))} />
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </main>

            <ItemModal open={editing !== undefined} item={editing} categories={stats?.categories || []}
                onClose={() => setEditing(undefined)} onSubmit={save} />

            <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Supprimer l’élément ?"
                footer={<>
                    <Button variant="secondary" onClick={() => setDeleting(null)}>Annuler</Button>
                    <Button variant="danger" icon={Trash2} onClick={confirmDelete}>Supprimer</Button>
                </>}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    « {deleting?.name} » sera définitivement supprimé. Cette action est irréversible.
                </p>
            </Modal>
        </div>
    );
}

function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="flex items-center gap-2 text-sm text-zinc-500"><Icon className="size-4" />{label}</div>
            {value === undefined
                ? <Skeleton className="mt-3 h-7 w-24" />
                : <div className="mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</div>}
        </div>
    );
}

function State({ icon: Icon, title, text, action }) {
    return (
        <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><Icon className="size-5" /></div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>
            <div className="mt-5">{action}</div>
        </div>
    );
}
