// ============================================================
//  PENSÉE IA — api/generate-pdf.js (v4 — accents + wrapping corrigés)
//  Génération PDF via construction manuelle du format PDF
//  Compatible Vercel Hobby, Edge et Pro — aucun Chromium requis
// ============================================================

export const config = {
    runtime: "nodejs",
    maxDuration: 30,
};

// ── Encodage Latin-1 avec support des accents français ───────
// Helvetica/WinAnsiEncoding couvre les 256 premiers codepoints Windows-1252.
// On convertit les caractères Unicode courants vers leurs équivalents WinAnsi.
function toWinAnsi(str) {
    if (!str) return "";
    return String(str)
        // Caractères spéciaux fréquents hors latin-1 de base
        .replace(/\u2019/g, "\x92") // apostrophe droite '
        .replace(/\u2018/g, "\x91") // apostrophe gauche '
        .replace(/\u201C/g, "\x93") // guillemet ouvrant "
        .replace(/\u201D/g, "\x94") // guillemet fermant "
        .replace(/\u2013/g, "\x96") // tiret demi-cadratin –
        .replace(/\u2014/g, "\x97") // tiret cadratin —
        .replace(/\u2026/g, "\x85") // ellipse …
        .replace(/\u20AC/g, "\x80") // euro €
        .replace(/\u00AB/g, "\xAB") // « guillemet français
        .replace(/\u00BB/g, "\xBB") // » guillemet français
        // Supprimer les caractères vraiment hors portée (>0xFF, non mappés)
        .replace(/[^\x00-\xFF]/g, "?");
}

// ── Conversion HTML → texte structuré ────────────────────────
function htmlToStructuredLines(html) {
    const lines = [];

    html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => {
        lines.push({ type: "h1", text: stripTags(t) }); return "";
    });
    html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => {
        lines.push({ type: "h2", text: stripTags(t) }); return "";
    });
    html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => {
        lines.push({ type: "h3", text: stripTags(t) }); return "";
    });
    html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => {
        lines.push({ type: "quote", text: stripTags(t) }); return "";
    });
    html = html.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => {
        lines.push({ type: "code", text: stripTags(t) }); return "";
    });
    html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => {
        lines.push({ type: "li", text: "• " + stripTags(t) }); return "";
    });
    html = html.replace(/<hr[^>]*\/?>/gi, () => {
        lines.push({ type: "hr" }); return "";
    });
    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => {
        const clean = stripTags(t).trim();
        if (clean) lines.push({ type: "p", text: clean });
        return "";
    });
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

// ── Mesure approchée de la largeur d'un texte en points PDF ──
// Largeurs de glyphes Helvetica standard (en unités/1000 pour 1pt)
// Source : Adobe Helvetica AFM. Valeurs moyennes pour les caractères manquants.
const HELVETICA_WIDTHS = {
    ' ':278,' ':278,'!':278,'"':355,'#':556,'$':556,'%':889,'&':667,"'":222,
    '(':333,')':333,'*':389,'+':584,',':278,'-':333,'.':278,'/':278,
    '0':556,'1':556,'2':556,'3':556,'4':556,'5':556,'6':556,'7':556,'8':556,'9':556,
    ':':278,';':278,'<':584,'=':584,'>':584,'?':556,'@':1015,
    'A':667,'B':667,'C':722,'D':722,'E':667,'F':611,'G':778,'H':722,'I':278,
    'J':500,'K':667,'L':556,'M':833,'N':722,'O':778,'P':667,'Q':778,'R':722,
    'S':667,'T':611,'U':722,'V':667,'W':944,'X':667,'Y':667,'Z':611,
    '[':278,'\\':278,']':278,'^':469,'_':556,'`':222,
    'a':556,'b':556,'c':500,'d':556,'e':556,'f':278,'g':556,'h':556,'i':222,
    'j':222,'k':500,'l':222,'m':833,'n':556,'o':556,'p':556,'q':556,'r':333,
    's':500,'t':278,'u':556,'v':500,'w':722,'x':500,'y':500,'z':500,
    '{':334,'|':260,'}':334,'~':584,
    // Accents français courants
    'à':556,'â':556,'ä':556,'æ':1000,'ç':500,'è':556,'é':556,'ê':556,'ë':556,
    'î':222,'ï':222,'ô':556,'ö':556,'ù':556,'û':556,'ü':556,'ÿ':500,
    'À':667,'Â':667,'Ä':667,'Æ':1000,'Ç':722,'È':667,'É':667,'Ê':667,'Ë':667,
    'Î':278,'Ï':278,'Ô':778,'Ö':778,'Ù':722,'Û':722,'Ü':722,
    '«':556,'»':556,'€':556,'•':350,'…':1000,'–':556,'—':1000,
};

function measureText(text, fontSize) {
    let width = 0;
    for (const ch of text) {
        width += (HELVETICA_WIDTHS[ch] || 556) * fontSize / 1000;
    }
    return width;
}

// ── Retour à la ligne basé sur la largeur réelle en points ───
function wrapTextPx(text, maxWidth, fontSize) {
    if (!text) return [""];
    const words = text.split(" ");
    const result = [];
    let cur = "";

    for (const w of words) {
        const candidate = cur ? cur + " " + w : w;
        if (measureText(candidate, fontSize) > maxWidth && cur) {
            result.push(cur);
            cur = w;
        } else {
            cur = candidate;
        }
    }
    if (cur) result.push(cur);
    return result.length ? result : [""];
}

// ── Générateur PDF ────────────────────────────────────────────
function generatePDF(title, lines) {
    const PAGE_W  = 595.28;
    const PAGE_H  = 841.89;
    const MARGIN  = 56;
    const MAX_W   = PAGE_W - MARGIN * 2;  // 483.28 pts utiles

    const ACCENT  = "0.000 0.639 0.447";
    const DARK    = "0.102 0.118 0.165";
    const GRAY    = "0.290 0.318 0.408";
    const LGRAY   = "0.565 0.596 0.690";

    // ── Encodage PDF sécurisé ─────────────────────────────────
    // 1. Convertit Unicode → WinAnsi (préserve les accents)
    // 2. Échappe les chars spéciaux PDF
    // 3. Ne filtre PAS les bytes > 0x7f (ils sont valides en WinAnsiEncoding)
    const pdfStr = (s) => {
        if (!s) return "()";
        const winAnsi = toWinAnsi(String(s));
        const safe = winAnsi
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " "); // ctrl chars seulement
        return `(${safe})`;
    };

    // ── Construction des pages ────────────────────────────────
    const pageStreams = [];
    let currentPage = [];
    let y = PAGE_H - MARGIN - 60;

    const newPage = () => {
        pageStreams.push([...currentPage]);
        currentPage = [];
        y = PAGE_H - MARGIN - 20;
    };

    const ensureSpace = (needed) => {
        if (y - needed < MARGIN + 40) newPage();
    };

    // En-tête première page
    const header = [
        `${DARK} rg`,
        `0 ${PAGE_H - 80} ${PAGE_W} 80 re f`,
        `${ACCENT} rg`,
        `${MARGIN} ${PAGE_H - 65} 36 36 re f`,
        `BT /F2 18 Tf 1 1 1 rg ${MARGIN + 12} ${PAGE_H - 52} Td ${pdfStr("P")} Tj ET`,
        `BT /F2 11 Tf 1 1 1 rg ${MARGIN + 46} ${PAGE_H - 42} Td ${pdfStr("PENSEE IA")} Tj ET`,
        `BT /F3 9 Tf 0.6 0.6 0.6 rg ${MARGIN + 46} ${PAGE_H - 56} Td ${pdfStr("par Yao Baba Ange Emmanuel")} Tj ET`,
        `BT /F1 9 Tf 0.5 0.5 0.5 rg ${PAGE_W - 180} ${PAGE_H - 42} Td ${pdfStr(new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }))} Tj ET`,
    ];
    currentPage.push(...header);

    currentPage.push(
        `${ACCENT} rg`,
        `${MARGIN} ${PAGE_H - 110} 110 16 re f`,
        `BT /F2 8 Tf 1 1 1 rg ${MARGIN + 6} ${PAGE_H - 103} Td ${pdfStr("DOCUMENT GENERE")} Tj ET`
    );

    const titleLines = wrapTextPx(title, MAX_W, 22);
    currentPage.push(`${DARK} rg`);
    let ty = PAGE_H - 135;
    for (const tl of titleLines) {
        currentPage.push(`BT /F2 22 Tf ${DARK} rg ${MARGIN} ${ty} Td ${pdfStr(tl)} Tj ET`);
        ty -= 28;
    }

    currentPage.push(
        `${LGRAY} rg`,
        `${MARGIN} ${ty - 6} ${MAX_W} 1 re f`
    );
    y = ty - 24;

    // Corps du document
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
            const qLines = wrapTextPx(line.text, MAX_W - 20, 10);
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
                // Courier est monospace : 600 unités/1000 par char à 9pt → max ~89 chars dans MAX_W
                const clSafe = cl.length > 88 ? cl.slice(0, 88) + "…" : cl;
                currentPage.push(`BT /F3 9 Tf 0.886 0.910 0.941 rg ${MARGIN + 10} ${cy} Td ${pdfStr(clSafe)} Tj ET`);
                cy -= 12;
            }
            y = cy - 10;
            continue;
        }

        if (line.type === "li") {
            const liLines = wrapTextPx(line.text, MAX_W - 12, 10);
            ensureSpace(liLines.length * 14 + 4);
            let ly = y;
            for (const ll of liLines) {
                currentPage.push(`BT /F1 10 Tf ${GRAY} rg ${MARGIN + 8} ${ly} Td ${pdfStr(ll)} Tj ET`);
                ly -= 14;
            }
            y = ly - 2;
            continue;
        }

        // Paragraphe
        const pLines = wrapTextPx(line.text, MAX_W, 10);
        ensureSpace(pLines.length * 14 + 8);
        let py = y;
        for (const pl of pLines) {
            currentPage.push(`BT /F1 10 Tf ${GRAY} rg ${MARGIN} ${py} Td ${pdfStr(pl)} Tj ET`);
            py -= 14;
        }
        y = py - 6;
    }

    // Finaliser la dernière page
    pageStreams.push([...currentPage]);

    // Pieds de page
    const totalPages = pageStreams.length;
    pageStreams.forEach((stream, i) => {
        stream.push(
            `0.97 0.97 0.99 rg 0 0 ${PAGE_W} 36 re f`,
            `0.878 0.882 0.941 rg 0 36 ${PAGE_W} 1 re f`,
            `BT /F1 9 Tf ${LGRAY} rg ${MARGIN} 14 Td ${pdfStr("Pensee IA - par Yao Baba Ange Emmanuel")} Tj ET`,
            `BT /F1 9 Tf ${LGRAY} rg ${PAGE_W - 80} 14 Td ${pdfStr(`Page ${i + 1} / ${totalPages}`)} Tj ET`
        );
    });

    return buildPDFBytes(title, pageStreams);
}

// ── Construction finale du PDF — offsets calculés en bytes réels ──
function buildPDFBytes(title, pageStreams) {
    const chunks = [];
    let byteOffset = 0;
    const offsets = {};

    const write = (str) => {
        const buf = Buffer.from(str, "latin1");
        chunks.push(buf);
        byteOffset += buf.length;
    };

    const writeObj = (id, content) => {
        offsets[id] = byteOffset;
        write(`${id} 0 obj\n${content}\nendobj\n\n`);
    };

    // En-tête PDF
    write("%PDF-1.4\n");
    write("%\xE2\xE3\xCF\xD3\n\n");

    // Obj 1 — Ressources (polices)
    writeObj(1, `<< /Font <<
  /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
  /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>
  /F3 << /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>
>> >>`);

    const PAGES_ID  = 2;
    let nextId      = 3;
    const pageIds   = [];

    for (let i = 0; i < pageStreams.length; i++) {
        const streamStr = pageStreams[i].join("\n");
        const streamBuf = Buffer.from(streamStr, "latin1");
        const streamLen = streamBuf.length;

        const contentId = nextId++;
        offsets[contentId] = byteOffset;
        write(`${contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n`);
        chunks.push(streamBuf);
        byteOffset += streamBuf.length;
        write(`\nendstream\nendobj\n\n`);

        const pageId = nextId++;
        pageIds.push(pageId);
        writeObj(pageId, `<< /Type /Page /Parent ${PAGES_ID} 0 R /MediaBox [0 0 595.28 841.89] /Contents ${contentId} 0 R /Resources 1 0 R >>`);
    }

    const kidsStr = pageIds.map(id => `${id} 0 R`).join(" ");
    offsets[PAGES_ID] = byteOffset;
    write(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageIds.length} >>\nendobj\n\n`);

    const catalogId = nextId++;
    writeObj(catalogId, `<< /Type /Catalog /Pages ${PAGES_ID} 0 R >>`);

    const infoId = nextId++;
    const safeTitle = title.replace(/[()\\]/g, " ");
    const dateStr   = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    writeObj(infoId, `<< /Title (${safeTitle}) /Creator (Pensee IA) /Producer (Pensee IA - Yao Baba Ange Emmanuel) /CreationDate (D:${dateStr}) >>`);

    const xrefPos   = byteOffset;
    const totalObjs = nextId;

    write(`xref\n`);
    write(`0 ${totalObjs}\n`);
    write(`0000000000 65535 f \n`);
    for (let i = 1; i < totalObjs; i++) {
        const off = offsets[i] !== undefined ? offsets[i] : 0;
        write(`${String(off).padStart(10, "0")} 00000 n \n`);
    }

    write(`trailer\n`);
    write(`<< /Size ${totalObjs} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n`);
    write(`startxref\n`);
    write(`${xrefPos}\n`);
    write(`%%EOF\n`);

    return Buffer.concat(chunks);
}

// ── Handler principal ─────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Methode non autorisee" });
    }

    const { title, htmlContent, userId } = req.body || {};

    if (!htmlContent || typeof htmlContent !== "string") {
        return res.status(400).json({ error: "Contenu HTML manquant." });
    }

    const safeTitle = (title || "Document Pensee IA")
        .replace(/[<>"]/g, "").slice(0, 100);

    let lines;
    try {
        lines = htmlToStructuredLines(htmlContent);
    } catch (e) {
        return res.status(500).json({ error: "Erreur de parsing HTML : " + e.message });
    }

    let pdfBuffer;
    try {
        pdfBuffer = generatePDF(safeTitle, lines);
    } catch (e) {
        console.error("[PDF] Erreur generation :", e);
        return res.status(500).json({ error: "Erreur generation PDF : " + e.message });
    }

    // ── Upload Supabase Storage ───────────────────────────────
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
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
            throw new Error(errData.message || `HTTP ${uploadRes.status}`);
        }

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

        const signData  = await signRes.json();
        const signedUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;

        return res.status(200).json({
            mode: "supabase",
            url: signedUrl,
            filePath,
            fileName: safeTitle + ".pdf",
        });

    } catch (err) {
        console.error("[PDF] Erreur Supabase :", err);
        const base64 = pdfBuffer.toString("base64");
        return res.status(200).json({
            mode: "base64",
            data: `data:application/pdf;base64,${base64}`,
            fileName: safeTitle + ".pdf",
        });
    }
}
