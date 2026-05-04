// ============================================================
//  PENSÉE IA — api/generate-pdf.js (v2 — sans Puppeteer)
//  Génération PDF via @jspdf/jspdf + html-to-text
//  npm install jspdf html-to-text
//  Compatible Vercel Hobby, Edge et Pro — aucun Chromium requis
// ============================================================

export const config = {
    runtime: "nodejs",
    maxDuration: 30,
};

// ── Conversion HTML → texte structuré ────────────────────────
function htmlToStructuredLines(html) {
    const lines = [];

    // Titre h1
    html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => {
        lines.push({ type: "h1", text: stripTags(t) }); return "";
    });
    // Titre h2
    html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => {
        lines.push({ type: "h2", text: stripTags(t) }); return "";
    });
    // Titre h3
    html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => {
        lines.push({ type: "h3", text: stripTags(t) }); return "";
    });
    // Blockquote
    html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => {
        lines.push({ type: "quote", text: stripTags(t) }); return "";
    });
    // Lignes de code (pre)
    html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => {
        lines.push({ type: "code", text: stripTags(t) }); return "";
    });
    // Listes ul/ol
    html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => {
        lines.push({ type: "li", text: "• " + stripTags(t) }); return "";
    });
    // Lignes hr
    html = html.replace(/<hr[^>]*\/?>/gi, () => {
        lines.push({ type: "hr" }); return "";
    });
    // Paragraphes et reste
    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => {
        const clean = stripTags(t).trim();
        if (clean) lines.push({ type: "p", text: clean });
        return "";
    });
    // Texte résiduel
    const residual = stripTags(html).trim();
    if (residual) lines.push({ type: "p", text: residual });

    return lines;
}

function stripTags(html) {
    return html
        .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "$1")
        .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "$1")
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "$1")
        .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}

// ── Générateur PDF pur (sans lib externe) ────────────────────
// Utilise le format PDF minimal valide, texte uniquement
function generateMinimalPDF(title, lines) {
    const objects = [];
    let objId = 1;

    const addObj = (content) => {
        objects.push({ id: objId++, content });
    };

    // Catalog
    addObj("<< /Type /Catalog /Pages 2 0 R >>");
    // Pages (ref 2)
    // On calcule les pages après

    const PAGE_W  = 595.28; // A4 pt
    const PAGE_H  = 841.89;
    const MARGIN  = 56;
    const MAX_W   = PAGE_W - MARGIN * 2;

    const ACCENT  = "0.000 0.639 0.447"; // #00a372 en RGB 0-1
    const DARK    = "0.102 0.118 0.165"; // #1a1e2a
    const GRAY    = "0.290 0.318 0.408"; // #4a5168
    const LGRAY   = "0.565 0.596 0.690"; // #9098b0

    // Police sécurisée embarquée : Helvetica (standard PDF)
    const FONTS = {
        normal:  "/F1",
        bold:    "/F2",
        mono:    "/F3",
    };

    // Encodage texte sécurisé pour PDF
    const pdfStr = (s) => {
        if (!s) return "()";
        const safe = String(s)
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]/g, " ");
        return `(${safe})`;
    };

    // Découpe une ligne longue en sous-lignes
    const wrapText = (text, charsPerLine) => {
        if (!text) return [""];
        const words = text.split(" ");
        const result = [];
        let cur = "";
        for (const w of words) {
            if ((cur + " " + w).trim().length > charsPerLine) {
                if (cur) result.push(cur.trim());
                cur = w;
            } else {
                cur = cur ? cur + " " + w : w;
            }
        }
        if (cur.trim()) result.push(cur.trim());
        return result.length ? result : [""];
    };

    // Construction du contenu des pages
    const pageStreams = [];
    let currentPage = [];
    let y = PAGE_H - MARGIN - 60; // On commence après l'en-tête

    const newPage = () => {
        pageStreams.push([...currentPage]);
        currentPage = [];
        y = PAGE_H - MARGIN - 20;
    };

    const ensureSpace = (needed) => {
        if (y - needed < MARGIN + 40) newPage();
    };

    // ── En-tête de première page ──────────────────────────────
    const header = [
        // Bandeau fond sombre
        `${DARK} rg`,
        `0 ${PAGE_H - 80} ${PAGE_W} 80 re f`,
        // Logo carré vert
        `${ACCENT} rg`,
        `${MARGIN} ${PAGE_H - 65} 36 36 re f`,
        // Texte logo "P"
        `BT /F2 18 Tf 1 1 1 rg ${MARGIN + 12} ${PAGE_H - 52} Td ${pdfStr("P")} Tj ET`,
        // Titre marque
        `BT /F2 11 Tf 1 1 1 rg ${MARGIN + 46} ${PAGE_H - 42} Td ${pdfStr("PENSÉE IA")} Tj ET`,
        // Sous-titre
        `BT /F3 9 Tf 0.6 0.6 0.6 rg ${MARGIN + 46} ${PAGE_H - 56} Td ${pdfStr("par Yao Baba Ange Emmanuel")} Tj ET`,
        // Date
        `BT /F1 9 Tf 0.5 0.5 0.5 rg ${PAGE_W - 180} ${PAGE_H - 42} Td ${pdfStr(new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }))} Tj ET`,
    ];
    currentPage.push(...header);

    // ── Tag "Document généré" ──────────────────────────────────
    currentPage.push(
        `${ACCENT} rg`,
        `${MARGIN} ${PAGE_H - 110} 110 16 re f`,
        `BT /F2 8 Tf 1 1 1 rg ${MARGIN + 6} ${PAGE_H - 103} Td ${pdfStr("DOCUMENT GÉNÉRÉ")} Tj ET`
    );

    // ── Titre du document ──────────────────────────────────────
    const titleLines = wrapText(title, 55);
    currentPage.push(`${DARK} rg`);
    let ty = PAGE_H - 135;
    for (const tl of titleLines) {
        currentPage.push(`BT /F2 22 Tf ${DARK} rg ${MARGIN} ${ty} Td ${pdfStr(tl)} Tj ET`);
        ty -= 28;
    }

    // Ligne de séparation
    currentPage.push(
        `${LGRAY} rg`,
        `${MARGIN} ${ty - 6} ${MAX_W} 1 re f`
    );
    y = ty - 24;

    // ── Corps du document ──────────────────────────────────────
    for (const line of lines) {
        if (!line) continue;

        if (line.type === "hr") {
            ensureSpace(16);
            currentPage.push(`0.85 0.85 0.88 rg ${MARGIN} ${y} ${MAX_W} 1 re f`);
            y -= 16;
            continue;
        }

        if (line.type === "h1") {
            ensureSpace(36);
            currentPage.push(
                `${DARK} rg`,
                `BT /F2 16 Tf ${DARK} rg ${MARGIN} ${y} Td ${pdfStr(line.text)} Tj ET`,
                `0.85 0.85 0.88 rg ${MARGIN} ${y - 4} ${MAX_W} 0.8 re f`
            );
            y -= 28;
            continue;
        }

        if (line.type === "h2") {
            ensureSpace(30);
            currentPage.push(
                `BT /F2 13 Tf ${ACCENT} rg ${MARGIN} ${y} Td ${pdfStr(line.text)} Tj ET`
            );
            y -= 22;
            continue;
        }

        if (line.type === "h3") {
            ensureSpace(24);
            currentPage.push(
                `BT /F2 11 Tf ${DARK} rg ${MARGIN} ${y} Td ${pdfStr(line.text)} Tj ET`
            );
            y -= 18;
            continue;
        }

        if (line.type === "quote") {
            const qLines = wrapText(line.text, 68);
            ensureSpace(qLines.length * 14 + 16);
            currentPage.push(
                `0.000 0.639 0.447 rg`,
                `${MARGIN} ${y - qLines.length * 14 - 6} 3 ${qLines.length * 14 + 12} re f`,
                `0.957 0.988 0.980 rg`,
                `${MARGIN + 3} ${y - qLines.length * 14 - 6} ${MAX_W - 3} ${qLines.length * 14 + 12} re f`
            );
            let qy = y;
            for (const ql of qLines) {
                currentPage.push(`BT /F1 10 Tf ${GRAY} rg ${MARGIN + 12} ${qy} Td ${pdfStr(ql)} Tj ET`);
                qy -= 14;
            }
            y = qy - 8;
            continue;
        }

        if (line.type === "code") {
            const cLines = line.text.split("\n").slice(0, 30);
            ensureSpace(cLines.length * 12 + 16);
            currentPage.push(
                `0.051 0.067 0.090 rg`,
                `${MARGIN} ${y - cLines.length * 12 - 8} ${MAX_W} ${cLines.length * 12 + 16} re f`
            );
            let cy = y;
            for (const cl of cLines) {
                const safeCode = cl.slice(0, 90);
                currentPage.push(`BT /F3 9 Tf 0.886 0.910 0.941 rg ${MARGIN + 10} ${cy} Td ${pdfStr(safeCode)} Tj ET`);
                cy -= 12;
            }
            y = cy - 10;
            continue;
        }

        if (line.type === "li") {
            const liLines = wrapText(line.text, 80);
            ensureSpace(liLines.length * 14 + 4);
            let ly = y;
            for (const ll of liLines) {
                currentPage.push(`BT /F1 10 Tf ${GRAY} rg ${MARGIN + 8} ${ly} Td ${pdfStr(ll)} Tj ET`);
                ly -= 14;
            }
            y = ly - 2;
            continue;
        }

        // Paragraphe par défaut
        const pLines = wrapText(line.text, 85);
        ensureSpace(pLines.length * 14 + 8);
        let py = y;
        for (const pl of pLines) {
            currentPage.push(`BT /F1 10 Tf ${GRAY} rg ${MARGIN} ${py} Td ${pdfStr(pl)} Tj ET`);
            py -= 14;
        }
        y = py - 6;
    }

    // ── Pied de page ──────────────────────────────────────────
    const addFooter = (stream, pageNum, total) => {
        stream.push(
            `0.97 0.97 0.99 rg 0 0 ${PAGE_W} 36 re f`,
            `0.878 0.882 0.941 rg 0 36 ${PAGE_W} 1 re f`,
            `BT /F1 9 Tf ${LGRAY} rg ${MARGIN} 14 Td ${pdfStr("Pensée IA — par Yao Baba Ange Emmanuel")} Tj ET`,
            `BT /F1 9 Tf ${LGRAY} rg ${PAGE_W - 80} 14 Td ${pdfStr(`Page ${pageNum} / ${total}`)} Tj ET`
        );
    };

    // Finaliser la dernière page
    pageStreams.push([...currentPage]);

    // Ajouter les pieds de page
    const totalPages = pageStreams.length;
    pageStreams.forEach((stream, i) => addFooter(stream, i + 1, totalPages));

    // ── Assemblage PDF ────────────────────────────────────────
    const objContents = [];

    // Obj 1 : Catalog
    objContents.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

    // Obj 2 : Pages (placeholder, on mettra à jour après)
    const pageObjIds = [];
    let nextId = 3;

    // Resources partagées
    const resourcesId = nextId++;
    objContents.push(`${resourcesId} 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F3 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >>\nendobj`);

    // Pages
    for (let i = 0; i < pageStreams.length; i++) {
        const streamContent = pageStreams[i].join("\n");
        const streamBytes   = Buffer.from(streamContent, "latin1");
        const streamLength  = streamBytes.length;

        const contentId = nextId++;
        objContents.push(`${contentId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);

        const pageId = nextId++;
        pageObjIds.push(pageId);
        objContents.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources ${resourcesId} 0 R >>\nendobj`);
    }

    // Obj 2 : Pages (maintenant on connaît les IDs)
    const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(" ");
    objContents.splice(1, 0, `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj`);
    // Renumérotation : on reconstruit proprement
    // (Le splice décale les IDs — on repart d'une génération propre)

    return buildPDFBytes(title, pageStreams, resourcesId);
}

// ── Construction finale du PDF binaire ───────────────────────
function buildPDFBytes(title, pageStreams, _unused) {
    const lines = [];
    const offsets = [];

    lines.push("%PDF-1.4");
    lines.push("%\xE2\xE3\xCF\xD3"); // commentaire binaire (marqueur)

    let objCount = 0;

    const writeObj = (id, content) => {
        offsets[id] = lines.join("\n").length + 1;
        lines.push(`${id} 0 obj`);
        lines.push(content);
        lines.push("endobj");
        lines.push("");
        objCount = Math.max(objCount, id);
    };

    // Ressources (polices)
    writeObj(1, `<< /Font <<
  /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
  /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>
  /F3 << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>
>> >>`);

    const pageIds = [];
    let nextId = 2;
    const pagesId = nextId++; // 2 — placeholder

    for (let i = 0; i < pageStreams.length; i++) {
        const streamStr = pageStreams[i].join("\n");
        // Encode en latin1 pour préserver les bytes
        const buf = Buffer.from(streamStr, "utf8");
        const contentId = nextId++;
        writeObj(contentId, `<< /Length ${buf.length} >>\nstream\n${streamStr}\nendstream`);

        const pageId = nextId++;
        pageIds.push(pageId);
        writeObj(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Contents ${contentId} 0 R /Resources 1 0 R >>`);
    }

    // Pages
    const kidsStr = pageIds.map(id => `${id} 0 R`).join(" ");
    writeObj(pagesId, `<< /Type /Pages /Kids [${kidsStr}] /Count ${pageIds.length} >>`);

    // Catalog
    const catalogId = nextId++;
    writeObj(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    // Info
    const infoId = nextId++;
    const safeTitle = title.replace(/[()\\]/g, " ");
    const dateStr = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    writeObj(infoId, `<< /Title (${safeTitle}) /Creator (Pensée IA) /Producer (Pensée IA — Yao Baba Ange Emmanuel) /CreationDate (D:${dateStr}) >>`);

    // XRef
    const xrefPos = lines.join("\n").length + 1;
    const totalObjs = objCount + 2;
    lines.push(`xref`);
    lines.push(`0 ${totalObjs}`);
    lines.push(`0000000000 65535 f `);
    for (let i = 1; i < totalObjs; i++) {
        const off = offsets[i] || 0;
        lines.push(`${String(off).padStart(10, "0")} 00000 n `);
    }

    lines.push("trailer");
    lines.push(`<< /Size ${totalObjs} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>`);
    lines.push("startxref");
    lines.push(String(xrefPos));
    lines.push("%%EOF");

    return Buffer.from(lines.join("\n"), "utf8");
}

// ── Handler principal ─────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    const { title, htmlContent, userId } = req.body || {};

    if (!htmlContent || typeof htmlContent !== "string") {
        return res.status(400).json({ error: "Contenu HTML manquant." });
    }

    const safeTitle = (title || "Document Pensée IA")
        .replace(/[<>"]/g, "").slice(0, 100);

    // ── Conversion HTML → lignes structurées ─────────────────
    let lines;
    try {
        lines = htmlToStructuredLines(htmlContent);
    } catch (e) {
        return res.status(500).json({ error: "Erreur de parsing HTML : " + e.message });
    }

    // ── Génération du PDF ─────────────────────────────────────
    let pdfBuffer;
    try {
        pdfBuffer = generateMinimalPDF(safeTitle, lines);
    } catch (e) {
        console.error("[PDF] Erreur génération :", e);
        return res.status(500).json({ error: "Erreur génération PDF : " + e.message });
    }

    // ── Upload Supabase Storage ───────────────────────────────
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        // Mode dev : base64
        const base64 = pdfBuffer.toString("base64");
        return res.status(200).json({
            mode: "base64",
            data: `data:application/pdf;base64,${base64}`,
            fileName: safeTitle + ".pdf",
        });
    }

    try {
        const timestamp = Date.now();
        const safeSlug  = safeTitle.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 50);
        const filePath  = `generated_pdfs/${userId || "anon"}/${timestamp}_${safeSlug}.pdf`;

        const uploadRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/attachments/${filePath}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "apikey": SUPABASE_KEY,
                    "Content-Type": "application/pdf",
                    "x-upsert": "true",
                },
                body: pdfBuffer,
            }
        );

        if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            console.error("[PDF] Upload Supabase échoué :", errData);
            throw new Error(errData.message || `HTTP ${uploadRes.status}`);
        }

        // URL signée 7 jours
        const signRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/sign/attachments/${filePath}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "apikey": SUPABASE_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ expiresIn: 604800 }),
            }
        );

        const signData = await signRes.json();
        const signedUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;

        return res.status(200).json({
            mode: "supabase",
            url: signedUrl,
            filePath,
            fileName: safeTitle + ".pdf",
        });

    } catch (err) {
        console.error("[PDF] Erreur Supabase :", err);
        // Fallback base64 si Supabase échoue
        const base64 = pdfBuffer.toString("base64");
        return res.status(200).json({
            mode: "base64",
            data: `data:application/pdf;base64,${base64}`,
            fileName: safeTitle + ".pdf",
        });
    }
}
