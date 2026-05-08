// ============================================================
//  PENSÉE IA — api/generate-file.js
//  Génération automatique de fichiers (xlsx, pptx, docx, csv)
//  Appelé par l'intercepteur GENERATE_FILE dans ia.js
//  Retourne : { data: "data:mime;base64,..." }
// ============================================================

export const config = { runtime: 'edge' };

// ── GÉNÉRATEURS DE CODE PYTHON PAR TYPE ──────────────────────

function buildXlsxCode(data) {
    const sheets = data.sheets || [];
    const filename = data.filename || 'fichier.xlsx';

    const sheetsCode = sheets.map((sheet, si) => {
        const name = (sheet.name || `Feuille${si + 1}`).replace(/'/g, "\\'");
        const headers = JSON.stringify(sheet.headers || []);
        const rows    = JSON.stringify(sheet.rows    || []);
        return `
# ── Feuille ${si + 1} : ${name}
ws${si} = wb.create_sheet("${name}")
headers_${si} = ${headers}
rows_${si}    = ${rows}

# En-têtes — style gras + fond vert
for ci, h in enumerate(headers_${si}, 1):
    cell = ws${si}.cell(row=1, column=ci, value=h)
    cell.font      = Font(bold=True, color="FFFFFF", size=11)
    cell.fill      = PatternFill(fill_type="solid", fgColor="1A7A5E")
    cell.alignment = Alignment(horizontal="center", vertical="center")
    ws${si}.column_dimensions[get_column_letter(ci)].width = max(len(str(h)) + 4, 12)

# Données
for ri, row in enumerate(rows_${si}, 2):
    for ci, val in enumerate(row, 1):
        cell = ws${si}.cell(row=ri, column=ci, value=val)
        if ri % 2 == 0:
            cell.fill = PatternFill(fill_type="solid", fgColor="F0FAF6")
`;
    }).join('\n');

    return `
import openpyxl, io, base64
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
wb.remove(wb.active)  # Supprimer la feuille vide par défaut
${sheetsCode}
buf = io.BytesIO()
wb.save(buf)
buf.seek(0)
print(base64.b64encode(buf.read()).decode())
`;
}

function buildCsvCode(data) {
    const headers  = data.headers || [];
    const rows     = data.rows    || [];
    const filename = data.filename || 'fichier.csv';

    return `
import csv, io, base64

output = io.StringIO()
writer = csv.writer(output)
writer.writerow(${JSON.stringify(headers)})
for row in ${JSON.stringify(rows)}:
    writer.writerow(row)

encoded = base64.b64encode(output.getvalue().encode('utf-8-sig')).decode()
print(encoded)
`;
}

function buildPptxCode(data) {
    const slides   = data.slides   || [];
    const filename = data.filename || 'presentation.pptx';

    const slidesCode = slides.map((slide, i) => {
        const title   = (slide.title   || `Slide ${i + 1}`).replace(/'/g, "\\'").replace(/\n/g, '\\n');
        const content = (slide.content || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        return `
# Slide ${i + 1}
slide${i} = prs.slides.add_slide(layout)
slide${i}.shapes.title.text = '${title}'
tf${i} = slide${i}.placeholders[1].text_frame
tf${i}.text = '${content}'
tf${i}.paragraphs[0].font.size = Pt(18)
tf${i}.paragraphs[0].font.color.rgb = RGBColor(0x33, 0x33, 0x33)
`;
    }).join('\n');

    return `
import io, base64
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
layout = prs.slide_layouts[1]  # Titre + contenu
${slidesCode}
buf = io.BytesIO()
prs.save(buf)
buf.seek(0)
print(base64.b64encode(buf.read()).decode())
`;
}

function buildDocxCode(data) {
    const sections = data.sections || [];
    const filename = data.filename || 'document.docx';

    const sectionsCode = sections.map((section, i) => {
        const heading = (section.heading || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        const text    = (section.text    || '').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        const level   = section.level || 1;
        return `
doc.add_heading('${heading}', level=${level})
doc.add_paragraph('${text}')
`;
    }).join('\n');

    return `
import io, base64
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()
${sectionsCode}
buf = io.BytesIO()
doc.save(buf)
buf.seek(0)
print(base64.b64encode(buf.read()).decode())
`;
}

// ── MIME TYPES ────────────────────────────────────────────────
const MIME = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    csv:  'text/csv',
};

// ── APPEL PISTON ──────────────────────────────────────────────
async function runPython(code) {
    const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            language: 'python',
            version:  '3.10.0',
            files:    [{ name: 'main.py', content: code }],
            stdin:    '',
            args:     [],
            run_timeout:     25000,
            compile_timeout: 5000,
        }),
        signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Piston HTTP ${res.status}`);

    const result = await res.json();
    const stdout = (result?.run?.stdout || '').trim();
    const stderr = (result?.run?.stderr || '').trim();

    if (!stdout) throw new Error(stderr || 'Piston : aucune sortie');
    return stdout;
}

// ── HANDLER ───────────────────────────────────────────────────
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    let body = {};
    try { body = await req.json(); } catch {
        return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), { status: 400 });
    }

    const { type, data } = body;

    if (!type || !data) {
        return new Response(JSON.stringify({ error: 'Paramètres manquants.' }), { status: 400 });
    }

    // Génération du code Python selon le type
    let pythonCode;
    try {
        switch (type) {
            case 'xlsx': pythonCode = buildXlsxCode(data); break;
            case 'csv':  pythonCode = buildCsvCode(data);  break;
            case 'pptx': pythonCode = buildPptxCode(data); break;
            case 'docx': pythonCode = buildDocxCode(data); break;
            default:
                return new Response(JSON.stringify({ error: `Type non supporté : ${type}` }), { status: 400 });
        }
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Erreur construction code : ' + e.message }), { status: 500 });
    }

    // Exécution via Piston
    let base64Data;
    try {
        base64Data = await runPython(pythonCode);
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Génération échouée : ' + e.message }), { status: 502 });
    }

    const mime     = MIME[type] || 'application/octet-stream';
    const dataUri  = `data:${mime};base64,${base64Data}`;

    return new Response(JSON.stringify({ data: dataUri }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
    });
}
