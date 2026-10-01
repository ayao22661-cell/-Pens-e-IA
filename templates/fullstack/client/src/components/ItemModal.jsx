// Formulaire de création / modification. Les erreurs de validation viennent de l'API (champ par champ).
import { useEffect, useState } from 'react';
import { Button, Field, Modal, inputCls, STATUS } from './ui.jsx';

const EMPTY = { name: '', category: '', status: 'actif', amount: '' };

export function ItemModal({ open, item, categories, onClose, onSubmit }) {
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(item ? { ...item, amount: String(item.amount) } : EMPTY);
            setErrors({});
        }
    }, [open, item]);

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await onSubmit({ ...form, amount: Number(form.amount || 0) });
            onClose();
        } catch (err) {
            setErrors(Object.fromEntries((err.details || []).map(d => [d.field, d.message])));
            if (!err.details?.length) setErrors({ _form: err.message });
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={item ? 'Modifier l’élément' : 'Nouvel élément'}
            footer={<>
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button type="submit" form="item-form" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>}
        >
            <form id="item-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                {errors._form && <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{errors._form}</p>}
                <div className="sm:col-span-2">
                    <Field label="Nom" error={errors.name}>
                        <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Ex. Location bureau Cocody" autoFocus />
                    </Field>
                </div>
                <Field label="Catégorie" error={errors.category}>
                    <input className={inputCls} value={form.category} onChange={set('category')} list="categories" placeholder="Ex. Immobilier" />
                    <datalist id="categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </Field>
                <Field label="Montant (FCFA)" error={errors.amount}>
                    <input className={inputCls} value={form.amount} onChange={set('amount')} inputMode="numeric" placeholder="0" />
                </Field>
                <div className="sm:col-span-2">
                    <Field label="Statut" error={errors.status}>
                        <div className="flex gap-2">
                            {Object.entries(STATUS).map(([value, s]) => (
                                <button type="button" key={value} onClick={() => setForm(f => ({ ...f, status: value }))}
                                    className={`flex-1 rounded-xl px-3 py-2 text-sm ring-1 transition ${form.status === value
                                        ? 'bg-brand-50 font-medium text-brand-700 ring-brand-500 dark:bg-brand-500/10 dark:text-brand-100'
                                        : 'ring-zinc-200 hover:bg-zinc-50 dark:ring-zinc-800 dark:hover:bg-zinc-800'}`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </Field>
                </div>
            </form>
        </Modal>
    );
}
