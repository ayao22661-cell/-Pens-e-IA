// ============================================================
//  PENSÉE IA — src/docs/theme.js
//  Thèmes partagés par les présentations et les documents PDF.
//  Couleurs en hexadécimal SANS "#" (format PptxGenJS).
// ============================================================

export const THEMES = {
    moderne: {
        label: 'Moderne', dark: false,
        bg: 'F8FAFC', surface: 'FFFFFF', text: '0F172A', muted: '64748B', line: 'E2E8F0',
        primary: '4F46E5', secondary: '06B6D4', accent: 'F59E0B',
        chart: ['4F46E5', '06B6D4', 'F59E0B', '10B981', 'EC4899', '8B5CF6'],
    },
    corporate: {
        label: 'Corporate', dark: false,
        bg: 'FFFFFF', surface: 'F1F5F9', text: '1E293B', muted: '64748B', line: 'E2E8F0',
        primary: '1D4ED8', secondary: '0EA5E9', accent: 'F97316',
        chart: ['1D4ED8', '0EA5E9', 'F97316', '64748B', '22C55E', 'A855F7'],
    },
    sombre: {
        label: 'Sombre', dark: true,
        bg: '0B1120', surface: '131C2E', text: 'F1F5F9', muted: '94A3B8', line: '1E293B',
        primary: '22D3EE', secondary: 'A78BFA', accent: 'F472B6',
        chart: ['22D3EE', 'A78BFA', 'F472B6', '34D399', 'FBBF24', '60A5FA'],
    },
    terracotta: {
        label: 'Terracotta', dark: false,
        bg: 'FFFBF5', surface: 'FFFFFF', text: '292524', muted: '78716C', line: 'E7E5E4',
        primary: 'C2410C', secondary: '15803D', accent: 'CA8A04',
        chart: ['C2410C', '15803D', 'CA8A04', '0E7490', '9F1239', '57534E'],
    },
    pensee: {
        label: 'Pensée', dark: true,
        bg: '111214', surface: '1A1B1F', text: 'ECECEF', muted: 'A3A3AD', line: '2B2B30',
        primary: '2EE6A6', secondary: '4FA8FF', accent: 'B28DFF',
        chart: ['2EE6A6', '4FA8FF', 'B28DFF', 'F2C14E', 'FF6B6B', 'A3A3AD'],
    },
};

export const FONTS = {
    head: 'Segoe UI Semibold',
    body: 'Segoe UI',
    // Aperçu HTML : polices web équivalentes
    css: "'Inter', 'Segoe UI', system-ui, sans-serif",
};

export function getTheme(name) {
    return THEMES[name] || THEMES.moderne;
}

/** Mélange une couleur hex avec une autre (t = 0 → a, 1 → b). */
export function mix(a, b, t) {
    const pa = [0, 2, 4].map(i => parseInt(a.slice(i, i + 2), 16));
    const pb = [0, 2, 4].map(i => parseInt(b.slice(i, i + 2), 16));
    return pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
