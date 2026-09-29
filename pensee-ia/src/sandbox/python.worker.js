// ============================================================
//  PENSÉE IA — src/sandbox/python.worker.js
//  Interpréteur Python (Pyodide/WebAssembly) dans un Web Worker :
//  l'interface ne gèle jamais, et une boucle infinie se coupe en
//  terminant le worker. /workspace est remonté à chaque exécution
//  depuis le système de fichiers virtuel de la conversation.
// ============================================================

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/';
importScripts(PYODIDE_URL + 'pyodide.js');

// Imports Python → noms de paquets pip
const PIP_MAP = {
    cv2: 'opencv-python', PIL: 'Pillow', sklearn: 'scikit-learn', bs4: 'beautifulsoup4',
    dateutil: 'python-dateutil', docx: 'python-docx', pptx: 'python-pptx', yaml: 'pyyaml',
    dotenv: 'python-dotenv', fpdf: 'fpdf2', xlsxwriter: 'XlsxWriter',
};

const WS = '/workspace';
let pyodide = null;
let booting = null;
const namespaces = new Map(); // espace de noms Python persistant par conversation (comme un REPL)

async function boot() {
    pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
    await pyodide.loadPackage('micropip');
    pyodide.FS.mkdirTree(WS);
    pyodide.runPython("import os; os.environ['MPLBACKEND'] = 'AGG'");
}

function fnv1a(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193);
    }
    return `${bytes.length}:${h >>> 0}`;
}

function walk(dir, base = '') {
    const out = [];
    for (const name of pyodide.FS.readdir(dir)) {
        if (name === '.' || name === '..' || name === '__pycache__') continue;
        const full = `${dir}/${name}`;
        const rel = base ? `${base}/${name}` : name;
        const st = pyodide.FS.stat(full);
        if (pyodide.FS.isDir(st.mode)) out.push(...walk(full, rel));
        else out.push(rel);
    }
    return out;
}

function resetWorkspace(files) {
    for (const rel of walk(WS)) pyodide.FS.unlink(`${WS}/${rel}`);
    const before = new Map();
    const enc = new TextEncoder();
    for (const f of files) {
        const bytes = typeof f.data === 'string' ? enc.encode(f.data) : new Uint8Array(f.data);
        const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
        if (dir) pyodide.FS.mkdirTree(`${WS}/${dir}`);
        pyodide.FS.writeFile(`${WS}/${f.path}`, bytes);
        before.set(f.path, fnv1a(bytes));
    }
    return before;
}

async function installImports(code, post) {
    await pyodide.loadPackagesFromImports(code, {
        messageCallback: (m) => { if (/^Loading|^Loaded/.test(m)) post('status', { status: 'installing', detail: m }); },
        errorCallback: () => {},
    });

    // Modules introuvables après chargement : tentative micropip (paquets pur Python)
    pyodide.globals.set('_pensee_src', code);
    const missing = pyodide.runPython(`
import importlib.util
from pyodide.code import find_imports
[m for m in find_imports(_pensee_src) if importlib.util.find_spec(m) is None]
`).toJs();
    if (!missing.length) return;
    const micropip = pyodide.pyimport('micropip');
    for (const mod of missing) {
        const pkg = PIP_MAP[mod] || mod;
        post('status', { status: 'installing', detail: `pip install ${pkg}` });
        try {
            await micropip.install(pkg);
        } catch (_) {
            post('stderr', { data: `⚠ Module "${mod}" indisponible dans Python WebAssembly.\n` });
        }
    }
    micropip.destroy();
}

function cleanTraceback(msg) {
    const lines = String(msg || '').split('\n');
    const start = lines.findIndex(l => l.startsWith('Traceback'));
    return lines
        .slice(start === -1 ? 0 : start)
        .filter(l => !/\/lib\/python3\.\d+\/site-packages\/_pyodide|_pyodide\/_base\.py|pyodide\/code\.py|await_fut|run_async/.test(l))
        .join('\n')
        .trim();
}

const CAPTURE_FIGURES = `
import sys
_pensee_figs = []
if 'matplotlib.pyplot' in sys.modules:
    import matplotlib.pyplot as _plt
    for _num in _plt.get_fignums():
        _name = f'figure_{_num}.png'
        _plt.figure(_num).savefig('${WS}/' + _name, dpi=120, bbox_inches='tight')
        _pensee_figs.append(_name)
    _plt.close('all')
_pensee_figs
`;

self.onmessage = async ({ data }) => {
    const { id, code, files, ws } = data;
    const post = (type, payload = {}) => self.postMessage({ id, type, ...payload });

    try {
        if (!pyodide) {
            post('status', { status: 'loading' });
            await (booting ||= boot());
        }

        const before = resetWorkspace(files || []);
        await installImports(code, post);

        pyodide.setStdout({ batched: (s) => post('stdout', { data: s + '\n' }) });
        pyodide.setStderr({
            batched: (s) => { if (!/FigureCanvasAgg is non-interactive/.test(s)) post('stderr', { data: s + '\n' }); },
        });
        pyodide.setStdin({ error: true });

        if (!namespaces.has(ws)) namespaces.set(ws, pyodide.globals.get('dict')());
        const globals = namespaces.get(ws);

        post('status', { status: 'running' });
        pyodide.runPython(`import os; os.chdir('${WS}')`);

        let error = null;
        let result = null;
        try {
            const value = await pyodide.runPythonAsync(code, { globals, filename: '<pensee>' });
            if (value !== undefined && value !== null) {
                result = typeof value === 'object' && value.toString ? value.toString() : String(value);
                if (value?.destroy) value.destroy();
            }
        } catch (e) {
            error = cleanTraceback(e.message);
        }

        try { pyodide.runPython(CAPTURE_FIGURES, { globals }); } catch (_) { /* pas de figure */ }

        // Diff du workspace : fichiers créés / modifiés / supprimés
        const changed = [];
        const transfer = [];
        const seen = new Set();
        for (const rel of walk(WS)) {
            seen.add(rel);
            const bytes = pyodide.FS.readFile(`${WS}/${rel}`);
            if (before.get(rel) !== fnv1a(bytes)) {
                changed.push({ path: rel, data: bytes });
                transfer.push(bytes.buffer);
            }
        }
        const deleted = [...before.keys()].filter(p => !seen.has(p));

        self.postMessage({ id, type: 'done', error, result, changed, deleted }, transfer);
    } catch (e) {
        post('done', { error: 'Erreur interne Python : ' + (e?.message || e), changed: [], deleted: [] });
    }
};
