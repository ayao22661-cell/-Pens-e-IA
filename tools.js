// ============================================================
//  PENSÉE IA — tools.js (L'Arsenal Complet des 33 API)
// ============================================================

export async function getLiveContext(message) {
    let context = "";
    const text = message.toLowerCase();

    async function quickFetch(url) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000); 
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            return res.ok ? await res.json() : null;
        } catch (e) { return null; }
    }

    try {
        // --- CODE & ARCHITECTURE (1-7) ---
        if (text.match(/(?:npm|package|module)\s+([a-z0-9\-_]+)/i)) {
            const pkg = text.match(/(?:npm|package|module)\s+([a-z0-9\-_]+)/i)[1];
            const d = await quickFetch(`https://registry.npmjs.org/${pkg}`);
            if(d) context += `[NPM] ${d.name} v${d['dist-tags']?.latest}: ${d.description}\n`;
        }
        if (text.match(/(?:python|pypi|lib)\s+([a-z0-9\-_]+)/i)) {
            const lib = text.match(/(?:python|pypi|lib)\s+([a-z0-9\-_]+)/i)[1];
            const d = await quickFetch(`https://pypi.org/pypi/${lib}/json`);
            if(d) context += `[PYPI] ${d.info.name} v${d.info.version}: ${d.info.summary}\n`;
        }
        if (text.match(/(?:logo|visuel)\s+(?:de\s+)?([a-z0-9.\-_]+\.[a-z]{2,})/i)) {
            const domain = text.match(/(?:logo|visuel)\s+(?:de\s+)?([a-z0-9.\-_]+\.[a-z]{2,})/i)[1];
            context += `[DESIGN] Logo URL: https://logo.clearbit.com/${domain}\n`;
        }

        // --- VISIONNAIRE & GÉO (8-14) ---
        if (text.match(/(?:pays|économie|capitale|habitant)\s+([a-zà-ÿ\s]+)/i)) {
            const c = text.match(/(?:pays|économie|capitale|habitant)\s+([a-zà-ÿ\s]+)/i)[1].trim();
            const d = await quickFetch(`https://restcountries.com/v3.1/translation/${encodeURIComponent(c)}`);
            if(d?.[0]) context += `[GEOPOLITIQUE] ${d[0].name.common}: Pop ${d[0].population}, Monnaie: ${Object.keys(d[0].currencies)[0]}\n`;
        }
        if (text.match(/(?:météo|température|climat|pluie)\s+(?:à\s+)?([a-zà-ÿ\s]+)/i)) {
            const res = await quickFetch(`https://api.open-meteo.com/v1/forecast?latitude=5.30&longitude=-4.00&current_weather=true`);
            if(res) context += `[METEO] Abidjan Live: ${res.current_weather.temperature}°C\n`;
        }

        // --- STRATÉGIE & MARCHÉS (15-19) ---
        if (text.match(/(?:prix|cours|bitcoin|crypto|eth|sol)/i)) {
            const d = await quickFetch(`https://api.coincap.io/v2/assets?limit=5`);
            if(d) context += "[CRYPTO] " + d.data.map(c => `${c.symbol}: $${parseFloat(c.priceUsd).toFixed(2)}`).join(", ") + "\n";
        }
        if (text.match(/(?:change|devise|taux|euro|dollar)/i)) {
            const d = await quickFetch(`https://api.frankfurter.app/latest`);
            if(d) context += `[FOREX] Base EUR: 1 USD = ${d.rates.USD}\n`;
        }

        // --- CRÉATIF & CULTURE (20-30) ---
        if (text.match(/(?:c'est quoi|qui est|définition|parle moi de)\s+([^?.,]+)/i)) {
            let sujet = text.match(/(?:c'est quoi|qui est|définition|parle moi de)\s+([^?.,]+)/i)[1].trim();
            const d = await quickFetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(sujet)}`);
            if(d) context += `[WIKIPEDIA] ${d.title}: ${d.extract}\n`;
        }
        if (text.match(/(?:livre|auteur|roman|littérature)\s+([a-z0-9\s]+)/i)) {
            const query = text.match(/(?:livre|auteur|roman|littérature)\s+([a-z0-9\s]+)/i)[1];
            const d = await quickFetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`);
            if(d?.docs?.[0]) context += `[LIVRE] "${d.docs[0].title}", Auteur: ${d.docs[0].author_name?.join(', ')}\n`;
        }
        if (text.match(/(?:film|série|casting)\s+([a-z0-9\s]+)/i)) {
            const query = text.match(/(?:film|série|casting)\s+([a-z0-9\s]+)/i)[1];
            const d = await quickFetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
            if(d?.[0]) context += `[MEDIA] ${d[0].show.name}: ${d[0].show.summary?.replace(/<[^>]*>/g, '')}\n`;
        }
        if (text.match(/(?:rime|synonyme|mots|lexique)\s+([a-zà-ÿ]+)/i)) {
            const word = text.match(/(?:rime|synonyme|mots|lexique)\s+([a-zà-ÿ]+)/i)[1];
            const d = await quickFetch(`https://api.datamuse.com/words?rel_rhy=${word}&max=5`);
            if(d) context += `[LINGUISTIQUE] Rimes pour ${word}: ${d.map(w => w.word).join(', ')}\n`;
        }

        // --- EXTRA & UTILS (31-33) ---
        if (text.match(/(?:dictionnaire|veut dire)\s+([a-zà-ÿ]+)/i)) {
            const word = text.match(/(?:dictionnaire|veut dire)\s+([a-zà-ÿ]+)/i)[1];
            const d = await quickFetch(`https://api.dictionaryapi.dev/api/v2/entries/fr/${word}`);
            if(d?.[0]) context += `[DICO] ${word}: ${d[0].meanings[0].definitions[0].definition}\n`;
        }
        if (text.match(/(?:mac|constructeur|vendeur)\s+([a-f0-9:]{17})/i)) {
            const mac = text.match(/(?:mac|constructeur|vendeur)\s+([a-f0-9:]{17})/i)[1];
            const d = await fetch(`https://api.macvendors.com/${mac}`).then(r => r.text()).catch(() => null);
            if(d) context += `[MATÉRIEL] Fabricant MAC ${mac}: ${d}\n`;
        }
        if (text.includes("altitude") || text.includes("élévation")) {
            const d = await quickFetch(`https://api.open-elevation.com/api/v1/lookup?locations=5.30,-4.00`);
            if(d) context += `[TOPOGRAPHIE] Altitude Abidjan: ${d.results[0].elevation}m\n`;
        }

    } catch (e) { console.warn("Tool failure:", e); }

    return context ? `### DONNÉES TEMPS RÉEL :\n${context}\n---\n\n` : "";
}
