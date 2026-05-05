// api/run-python.js
// Exécute du code Python via Piston API (gratuit, sans config)
// Retourne : { output, files: [{name, data}], error }

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { code } = req.body;
    if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Paramètre 'code' manquant." });
    }

    // Le code utilisateur est injecté dans le wrapper via remplacement de marqueur
    // Le wrapper intercepte les fichiers écrits et les encode en base64
    const wrapper = `
import sys, io, base64, builtins, json, traceback

_files_out = []
_logs = []
_real_open = builtins.open

def _open_patch(path, mode='r', *a, **kw):
    if isinstance(mode, str) and 'b' in mode and ('w' in mode or 'x' in mode):
        buf = io.BytesIO()
        buf._path = str(path)
        return buf
    return _real_open(path, mode, *a, **kw)

builtins.open = _open_patch

_orig_close = io.BytesIO.close
def _close_patch(self):
    if hasattr(self, '_path') and not self.closed:
        try:
            self.seek(0)
            data = self.read()
            if data:
                _files_out.append({
                    'name': self._path,
                    'data': base64.b64encode(data).decode()
                })
        except Exception:
            pass
    _orig_close(self)
io.BytesIO.close = _close_patch

class _Capture:
    def write(self, s):
        if s.strip(): _logs.append(s)
    def flush(self): pass

sys.stdout = _Capture()
sys.stderr = _Capture()

_error = None
try:
    exec(compile("""
__USER_CODE__
""", '<pensee>', 'exec'), {})
except Exception:
    _error = traceback.format_exc()

sys.stdout = sys.__stdout__
print(json.dumps({
    'output': '\\n'.join(_logs),
    'files': _files_out,
    'error': _error
}))
`;

    const finalCode = wrapper.replace('__USER_CODE__', code);

    try {
        const pistonRes = await fetch("https://emkc.org/api/v2/piston/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                language: "python",
                version: "3.10.0",
                files: [{ name: "main.py", content: finalCode }],
                stdin: "",
                args: [],
                run_timeout: 20000,
                compile_timeout: 5000
            })
        });

        if (!pistonRes.ok) {
            return res.status(502).json({
                error: "Piston API indisponible",
                detail: await pistonRes.text()
            });
        }

        const piston = await pistonRes.json();
        const stdout = (piston?.run?.stdout || "").trim();
        const stderr = (piston?.run?.stderr || "").trim();

        try {
            const result = JSON.parse(stdout);
            return res.status(200).json({
                output: result.output || "",
                files:  result.files  || [],
                error:  result.error  || null,
                stderr
            });
        } catch {
            return res.status(200).json({
                output: stdout || stderr,
                files:  [],
                error:  null,
                stderr
            });
        }

    } catch (err) {
        return res.status(500).json({
            error: "Erreur serveur interne",
            detail: err.message
        });
    }
}
