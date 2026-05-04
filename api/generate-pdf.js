// ============================================================
//  PENSÉE IA — api/generate-pdf.js
//  Génération de PDF stylisé → Upload Supabase Storage
//  Dépendances : puppeteer-core, @sparticuz/chromium
//  Installation : npm install puppeteer-core @sparticuz/chromium
// ============================================================

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = {
    runtime: "nodejs", // Puppeteer est incompatible avec le runtime Edge
    maxDuration: 60,   // Vercel Pro : 60s max pour la génération
};

// ── Template HTML stylisé aux couleurs de Pensée IA ─────────
function buildHtmlTemplate(title, htmlContent) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* ── Polices système (pas de Google Fonts en Puppeteer headless) ── */
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Fraunces:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');

    :root {
      --accent:  #00a372;
      --accent2: #00e5a0;
      --bg:      #ffffff;
      --text:    #1a1e2a;
      --text2:   #4a5168;
      --text3:   #9098b0;
      --border:  #e8eaf0;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Syne', 'Helvetica Neue', Arial, sans-serif;
      color: var(--text);
      background: var(--bg);
      padding: 0;
      font-size: 14px;
      line-height: 1.7;
    }

    /* ── En-tête ── */
    .header {
      background: linear-gradient(135deg, #0d1117 0%, #1a1e2a 100%);
      padding: 32px 48px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo {
      width: 36px;
      height: 36px;
      background: var(--accent);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Fraunces', serif;
      font-weight: 600;
      font-size: 18px;
      color: #fff;
      flex-shrink: 0;
    }
    .header-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .header-subtitle {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      font-family: 'JetBrains Mono', monospace;
      margin-top: 2px;
    }
    .header-date {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      font-family: 'JetBrains Mono', monospace;
      text-align: right;
    }

    /* ── Titre du document ── */
    .doc-title-section {
      padding: 36px 48px 0;
      border-bottom: 2px solid var(--border);
      padding-bottom: 28px;
      margin-bottom: 32px;
    }
    .doc-tag {
      display: inline-block;
      background: rgba(0, 163, 114, 0.12);
      color: var(--accent);
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 14px;
    }
    .doc-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 28px;
      font-weight: 600;
      color: var(--text);
      line-height: 1.2;
    }

    /* ── Corps du document ── */
    .doc-body {
      padding: 0 48px 40px;
    }

    /* ── Typographie du contenu ── */
    h1, h2, h3, h4 {
      font-family: 'Fraunces', Georgia, serif;
      margin-top: 28px;
      margin-bottom: 10px;
      color: var(--text);
    }
    h1 { font-size: 22px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    h2 { font-size: 18px; color: var(--accent); }
    h3 { font-size: 15px; }
    h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text2); }

    p { margin-bottom: 12px; color: var(--text2); }

    strong { color: var(--text); font-weight: 600; }
    em { color: var(--text2); font-style: italic; }

    ul, ol {
      padding-left: 24px;
      margin-bottom: 14px;
    }
    li {
      margin-bottom: 6px;
      color: var(--text2);
    }
    li::marker { color: var(--accent); }

    a { color: var(--accent); text-decoration: underline; }

    blockquote {
      border-left: 3px solid var(--accent);
      padding: 10px 16px;
      margin: 16px 0;
      background: rgba(0, 163, 114, 0.06);
      border-radius: 0 6px 6px 0;
      color: var(--text2);
      font-style: italic;
    }

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: #f4f5f8;
      padding: 2px 6px;
      border-radius: 4px;
      color: #e11d48;
    }

    pre {
      background: #0d1117;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 16px 0;
      overflow-x: auto;
    }
    pre code {
      background: none;
      color: #e2e8f0;
      padding: 0;
      font-size: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    th {
      background: var(--text);
      color: #fff;
      padding: 10px 14px;
      text-align: left;
      font-family: 'Syne', sans-serif;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text2);
    }
    tr:nth-child(even) td { background: #f8f9fc; }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 24px 0;
    }

    /* ── Alerte / Callout ── */
    .callout {
      background: rgba(0, 163, 114, 0.08);
      border: 1px solid rgba(0, 163, 114, 0.25);
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0;
    }

    /* ── Pied de page ── */
    .footer {
      margin-top: 48px;
      padding: 20px 48px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8f9fc;
    }
    .footer-brand {
      font-size: 11px;
      color: var(--text3);
      font-family: 'JetBrains Mono', monospace;
    }
    .footer-brand strong {
      color: var(--accent);
      font-weight: 600;
    }
    .footer-copy {
      font-size: 10px;
      color: var(--text3);
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>

  <!-- EN-TÊTE -->
  <div class="header">
    <div class="header-brand">
      <div class="header-logo">P</div>
      <div>
        <div class="header-title">Pensée IA</div>
        <div class="header-subtitle">par Yao Baba Ange Emmanuel</div>
      </div>
    </div>
    <div class="header-date">
      Généré le ${new Date().toLocaleDateString("fr-FR", {
          day: "2-digit", month: "long", year: "numeric"
      })}<br>
      à ${new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit", minute: "2-digit"
      })}
    </div>
  </div>

  <!-- TITRE -->
  <div class="doc-title-section">
    <div class="doc-tag">Document généré</div>
    <div class="doc-title">${title}</div>
  </div>

  <!-- CONTENU -->
  <div class="doc-body">
    ${htmlContent}
  </div>

  <!-- PIED DE PAGE -->
  <div class="footer">
    <div class="footer-brand">
      Document produit par <strong>Pensée IA</strong>
    </div>
    <div class="footer-copy">
      © ${new Date().getFullYear()} — Yao Baba Ange Emmanuel. Tous droits réservés.
    </div>
  </div>

</body>
</html>`;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée" });
    }

    // ── 1. VALIDATION DE L'ENTRÉE ────────────────────────────
    const { title, htmlContent, userId } = req.body || {};

    if (!htmlContent || typeof htmlContent !== "string") {
        return res.status(400).json({ error: "Contenu HTML manquant." });
    }

    const safeTitle = (title || "Document Pensée IA")
        .replace(/[<>]/g, "")
        .slice(0, 100);

    // ── 2. GÉNÉRATION DU PDF ─────────────────────────────────
    let pdfBuffer;
    try {
        const executablePath = await chromium.executablePath();

        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        const fullHtml = buildHtmlTemplate(safeTitle, htmlContent);
        await page.setContent(fullHtml, { waitUntil: "networkidle0" });

        pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
        });

        await browser.close();
    } catch (err) {
        console.error("[PDF] Erreur Puppeteer :", err);
        return res.status(500).json({ error: "Échec de génération du PDF : " + err.message });
    }

    // ── 3. UPLOAD VERS SUPABASE STORAGE ─────────────────────
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        // Mode dev : retourne le PDF en base64 directement
        console.warn("[PDF] Supabase non configuré — retour base64.");
        const base64 = Buffer.from(pdfBuffer).toString("base64");
        return res.status(200).json({
            mode: "base64",
            data: `data:application/pdf;base64,${base64}`,
            fileName: safeTitle,
        });
    }

    try {
        const timestamp  = Date.now();
        const safeSlug   = safeTitle.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 50);
        const filePath   = `generated_pdfs/${userId || "anon"}/${timestamp}_${safeSlug}.pdf`;

        // Upload binaire dans Supabase Storage (bucket "attachments")
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

        // Génération d'une URL signée valable 7 jours (604800 secondes)
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
            fileName: `${safeTitle}.pdf`,
        });

    } catch (err) {
        console.error("[PDF] Erreur Supabase :", err);
        return res.status(500).json({ error: "Échec de l'upload : " + err.message });
    }
}
