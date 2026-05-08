// ============================================================
//  PENSÉE IA — api/generate-file.js
//  Génération fichiers (xlsx, pptx, docx, csv) — SANS Piston
//  Packages requis : xlsx, pptxgenjs, docx
//  npm install xlsx pptxgenjs docx
// ============================================================

// ⚠️  Edge runtime ne supporte pas les packages npm natifs avec Buffer.
//     Passe en runtime Node.js standard (plus fiable pour les libs de fichiers).
export const config = { runtime: 'nodejs' };

// ── GÉNÉRATEURS ───────────────────────────────────────────────

async function buildXlsx(data) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    for (const sheet of (data.sheets || [])) {
        const wsData = [sheet.headers || [], ...(sheet.rows || [])];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Largeur auto des colonnes
        const colWidths = (sheet.headers || []).map((h, ci) => {
            const maxLen = Math.max(
                String(h).length,
                ...(sheet.rows || []).map(r => String(r[ci] ?? '').length)
            );
            return { wch: Math.min(maxLen + 4, 40) };
        });
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheet.name || `Feuille${wb.SheetNames.length + 1}`);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buf).toString('base64');
}

async function buildCsv(data) {
    const lines = [
        (data.headers || []).join(','),
        ...(data.rows || []).map(row =>
            row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
        )
    ];
    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8').toString('base64');
}

async function buildPptx(data) {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const prs = new PptxGenJS();

    for (const slide of (data.slides || [])) {
        const s = prs.addSlide();

        // Fond blanc
        s.background = { color: 'FFFFFF' };

        // Titre
        s.addText(slide.title || '', {
            x: 0.5, y: 0.3, w: '90%', h: 1.0,
            fontSize: 28, bold: true, color: '1A7A5E',
            fontFace: 'Calibri',
        });

        // Contenu
        if (slide.content) {
            s.addText(slide.content, {
                x: 0.5, y: 1.5, w: '90%', h: '70%',
                fontSize: 16, color: '333333',
                fontFace: 'Calibri', valign: 'top',
                wrap: true,
            });
        }
    }

    const buf = await prs.write({ outputType: 'arraybuffer' });
    return Buffer.from(buf).toString('base64');
}

async function buildDocx(data) {
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import('docx');

    const children = [];
    for (const section of (data.sections || [])) {
        const level = section.level || 1;
        const headingMap = {
            1: HeadingLevel.HEADING_1,
            2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3,
        };

        children.push(
            new Paragraph({
                text: section.heading || '',
                heading: headingMap[level] || HeadingLevel.HEADING_1,
            }),
            new Paragraph({
                children: [new TextRun({ text: section.text || '', size: 24 })],
                spacing: { after: 200 },
            })
        );
    }

    const doc = new Document({ sections: [{ children }] });
    const buf = await Packer.toBuffer(doc);
    return buf.toString('base64');
}

// ── MIME TYPES ────────────────────────────────────────────────
const MIME = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    csv:  'text/csv',
};

// ── HANDLER ───────────────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { type, data } = req.body || {};

    if (!type || !data) {
        return res.status(400).json({ error: 'Paramètres manquants.' });
    }

    let base64Data;
    try {
        switch (type) {
            case 'xlsx': base64Data = await buildXlsx(data); break;
            case 'csv':  base64Data = await buildCsv(data);  break;
            case 'pptx': base64Data = await buildPptx(data); break;
            case 'docx': base64Data = await buildDocx(data); break;
            default:
                return res.status(400).json({ error: `Type non supporté : ${type}` });
        }
    } catch (e) {
        console.error('[generate-file] Erreur :', e);
        return res.status(500).json({ error: 'Génération échouée : ' + e.message });
    }

    const mime    = MIME[type] || 'application/octet-stream';
    const dataUri = `data:${mime};base64,${base64Data}`;

    return res.status(200).json({ data: dataUri });
}
