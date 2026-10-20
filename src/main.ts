import { EditorState, Compartment, StateEffect, StateField, Extension } from '@codemirror/state';
import { EditorView, keymap, Decoration, DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';

// Languages Packages
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';

// Named Themes
import { oneDark } from '@codemirror/theme-one-dark';
import { atomone } from '@uiw/codemirror-theme-atomone';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

// LiteRT WebGPU Engine
import { Engine /*, EngineSettings*/ } from '@litert-lm/core';

import { registerSW } from 'virtual:pwa-register';

// ---

// ! Students and Educators, extend this freely !

// Replace the AI models, or remove them, if you like.

// ---

// This handles the service worker lifecycle
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, reloading...');
    // If you want to force the update immediately:
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

// ---

const SANDBOX_CSS = `
  <style>
    * { all: revert; box-sizing: border-box; }
    html, body {
      height: 100%; width: 100%; margin: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #11111b; color: #cdd6f4;
      font-family: system-ui, sans-serif;
    }
  </style>
`;

// ==========================================
// CodeMirror Configurations
// ==========================================
const sampleRegistry: Record<string, { title: string; code: string }> = {
  python: {
    title: "High-Performance Iteration",
    code: `
def calculate_metrics(buffer):
    print("Hello world")
    elements = [x * 2 for x in buffer if x > 10]
    return sum(elements)

print(calculate_metrics([5, 12, 18, 3]))
    `.trim()
  },
  html: {
    title: "A Rectangular Region",
    code: `
<div style="padding: 20px; font-family: sans-serif; text-align: center;">
  <h1 style="color: #4f46e5;">A Rectangular Region</h1>
  <p>Rendered natively and safely within a div element.</p>
</div>
    `.trim()
  },
  javascript: {
    title: "State Synchronizer",
    code: `
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

console.log("Hello world");

const testRun = debounce(() => console.log("Debounced Execution Finished!"), 500);
testRun();
    `.trim()
  },
  tsx: {
    title: "A React Node",
    code: `
import React from 'react';

console.log('Hello world');

export const styles = \`
  .node-wrapper {
    background: #fff; padding: 16px;
    border: 1px solid #000; text-align: center;
  }
  h3 { color: #000; margin: 0 0 8px; font-size: 1rem; }
  p { color: #000; font-size: 1.25rem; font-weight: bold; margin: 0; }
\`;

export function MyDataNode({ balance }) {
  const cleanBalance = balance.split(',').join('');
  const val = parseFloat(cleanBalance);
  const unit = (val === 0 || val % 1 !== 0 || val > 1) ? 'Units' : 'Unit';

  return (
    <div className="node-wrapper">
      <h3>Balance</h3>
      <p>{balance} {unit}</p>
    </div>
  );
}

// Render element
root.render(<MyDataNode balance="2,048.00" />);
    `.trim()
  },
  jsx: {
    title: "Simple Component",
    code: `
import React from 'react';

export function SimpleBox() {
  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      <h1>JSX Component</h1>
      <p>This is a standard React functional component.</p>
    </div>
  );
}

// Render element
root.render(<SimpleBox />);
    `.trim()
  },
  ts: {
    title: "Type-Safe Logic",
    code: `
interface Metrics {
  id: number;
  value: number;
}

const data: Metrics = { id: 1, value: 100 };
console.log("Data processed:", data.value);
    `.trim()
  }
};

// Comprehensive Python standard libraries to hide from the UI badges
const PYTHON_STDLIB = new Set([
  // Core & Math
  'sys', 'os', 'math', 'time', 'datetime', 'random', 'collections', 'itertools', 'functools', 'statistics', 'decimal', 'fractions',
  // Async & Concurrency
  'asyncio', 'threading', 'multiprocessing', 'concurrent', 'subprocess',
  // Types & Data Structures
  'typing', 'dataclasses', 'enum', 'copy', 'string', 'uuid',
  // File System & Serialization
  'io', 'json', 'csv', 'pathlib', 'shutil', 'pickle', 'base64', 'sqlite3',
  // Web & Networking
  'urllib', 'http', 'socket', 'ssl', 'html', 'xml',
  // Cryptography & Hashing
  'hashlib', 'hmac', 'secrets',
  // Utilities
  're', 'argparse', 'logging', 'traceback', 'warnings', 'inspect', 'ast', 'unittest', 'pdb'
]);
// Map common import names to their actual PyPI package names
const PYPI_ALIASES: Record<string, string> = {
  // Web & Scraping
  'bs4': 'beautifulsoup4',
  'dotenv': 'python-dotenv',
  // Data Science & Imaging
  'cv2': 'opencv-python',
  'sklearn': 'scikit-learn',
  'skimage': 'scikit-image',
  'PIL': 'Pillow',
  'fitz': 'PyMuPDF',
  // Utilities & Formats
  'yaml': 'PyYAML',
  'dateutil': 'python-dateutil',
  'jwt': 'PyJWT',
  'serial': 'pyserial',
  'attr': 'attrs',
  'pkg_resources': 'setuptools',
  // APIs & Integrations
  'telegram': 'python-telegram-bot',
  'discord': 'discord.py',
  'docx': 'python-docx',
  'pptx': 'python-pptx'
};

function parsePythonDependencies(code: string): { parsed: string[], manual: string[] } {
  const parsed = new Set<string>();
  const manual = new Set<string>();

  const normalize = (pkg: string) => PYPI_ALIASES[pkg] || pkg;

  const importRegex = /^(?![ \t]*#)[ \t]*import[ \t]+([a-zA-Z0-9_, ]+)/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    match[1].split(',').forEach(p => {
      let baseModule = p.trim().split('.')[0].split(' ')[0];
      if (baseModule && !PYTHON_STDLIB.has(baseModule)) {
        parsed.add(normalize(baseModule));
      }
    });
  }

  const fromRegex = /^(?![ \t]*#)[ \t]*from[ \t]+([a-zA-Z0-9_.]+)[ \t]+import/gm;
  while ((match = fromRegex.exec(code)) !== null) {
    let baseModule = match[1].trim().split('.')[0];
    if (baseModule && !PYTHON_STDLIB.has(baseModule)) parsed.add(normalize(baseModule));
  }

  const reqMatch = code.match(/^#[ \t]*requirements:[ \t]*(.*)$/m);
  if (reqMatch) {
    reqMatch[1].split(',').forEach(p => {
      const clean = p.split('#')[0].trim();
      if (clean) {
        const normalized = normalize(clean);
        if (!parsed.has(normalized)) manual.add(normalized);
      }
    });
  }

  return { parsed: Array.from(parsed), manual: Array.from(manual) };
}

function writeRequirementsToEditor(view: EditorView, packages: string[]) {
  const code = view.state.doc.toString();
  const reqLineRegex = /^#\s*requirements:.*$/m;
  const newComment = packages.length > 0 ? `# requirements: ${packages.join(', ')}` : '';

  const match = code.match(reqLineRegex);

  if (match) {
    // Replace or remove existing line
    const start = match.index!;
    const end = start + match[0].length;

    if (packages.length === 0) {
      // Clean up the line entirely if empty, plus the trailing newline
      const endWithNewline = end + (code[end] === '\n' ? 1 : 0);
      view.dispatch({ changes: { from: start, to: endWithNewline, insert: '' } });
    } else {
      view.dispatch({ changes: { from: start, to: end, insert: newComment } });
    }
  } else if (packages.length > 0) {
    // Inject at the very top of the document
    view.dispatch({ changes: { from: 0, to: 0, insert: newComment + '\n\n' } });
  }
}

// ---

interface InstanceMetadata {
  id: string;
  view: EditorView;
  container: HTMLDivElement;
  statusElement: HTMLDivElement;
  stdoutElement: HTMLDivElement;
  webviewContainer: HTMLDivElement;
  initialLang: string;
  initialCode: string;
  currentRunListener?: (e: MessageEvent) => void;
  langComp: Compartment;
  themeComp: Compartment;
}

const instances: Map<string, InstanceMetadata> = new Map();
const readingInstances: Map<string, { view: EditorView, themeComp: Compartment }> = new Map();

const setHighlightEffect = StateEffect.define<{ pos: number; length: number } | null>();
const highlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(setHighlightEffect)) {
        if (e.value === null) {
          underlines = Decoration.none;
        } else {
          const mark = Decoration.mark({ class: 'error-line-highlight' });
          underlines = underlines.update({
            add: [mark.range(e.value.pos, e.value.pos + e.value.length)]
          });
        }
      }
    }
    return underlines;
  },
  provide: f => EditorView.decorations.from(f)
});

function getLanguageExtension(lang: string): Extension {
  switch (lang.toLowerCase()) {
    case 'python': return python();
    case 'html': return html();
    case 'ts': case 'tsx': case 'js': case 'jsx': case 'javascript':
      return javascript({ jsx: true, typescript: true });
    default: return python();
  }
}

// ---

// 1. The Global Tracker Variable
let lastActiveWorkspaceId: string | null = null;

// 2. The Iframe Bridge (Catches clicks inside HTML/JS output visual frames)
window.addEventListener('message', (e) => {
  if (e.data?.type === 'workspace-focus' && e.data.id) {
    lastActiveWorkspaceId = e.data.id;
  }
});

// ==========================================

async function loadWasmInternals() {
  return new Promise((resolve, reject) => {
    if ((window as any).LiteRTWasm) {
      resolve(true);
      return;
    }

    console.log("Priming AI Engine with local WASM internals...");

    // IMPORTANT: This 'Module' object is what the litertlm_wasm_internal.js
    // looks for to find its .wasm file.
    (window as any).Module = {
      locateFile: (path: string) => {
        // If the library asks for the .wasm file, redirect it to our public folder
        if (path.endsWith('.wasm')) {
          console.log(`Redirecting WASM request from ${path} to /litertlm_wasm_internal.wasm`);
          return '/litertlm_wasm_internal.wasm';
        }
        return path;
      },
    };

    const script = document.createElement('script');
    script.src = '/litertlm_wasm_internal.js';
    script.async = true;
    script.onload = () => {
      console.log("✅ Local WASM loader and engine redirected successfully.");
      resolve(true);
    };
    script.onerror = () => {
      console.error("❌ Failed to load local WASM loader.");
      reject(new Error("Local WASM load failed"));
    };
    document.head.appendChild(script);
  });
}

// ==========================================
// LiteRT AI Engine & Global UI State
// ==========================================
let engine: Engine | null = null;
let isModelReady = false;

function setAIToolingState(state: 'booting' | 'ready' | 'error', message?: string) {
  const statusPill = document.getElementById('global-ai-status');
  const statusText = document.getElementById('global-ai-text');

  // 1. Update the Global Pill
  if (statusPill && statusText) {
    statusPill.className = `ai-status-pill ${state}`;
    if (message) statusText.innerText = message;
  }

  // 2. Lock or Unlock all AI buttons globally
  const aiButtons = document.querySelectorAll('.btn-analyze-full, .btn-analyze');

  aiButtons.forEach(el => {
    const btn = el as HTMLButtonElement;
    if (state === 'booting') {
      btn.disabled = true;
      btn.innerText = "⏳ AI Booting...";
      btn.style.cursor = "not-allowed";
    } else if (state === 'ready') {
      btn.disabled = false;
      btn.innerText = "Analyze Code & Output";
      btn.style.cursor = "pointer";
    } else if (state === 'error') {
      btn.disabled = true;
      btn.innerText = "❌ AI Unavailable";
      btn.style.cursor = "not-allowed";
    }
  });
}

async function initializeAIEngine() {
  try {
    if (!navigator.gpu) {
      setAIToolingState('error', 'WebGPU Not Supported');
      return;
    }

    setAIToolingState('booting', 'Initializing Local AI Engine (~1min)...');

    // Strategy: Use CDN if online, otherwise use local /public file
    const remoteModel = 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm';
    const localModel = '/gemma-4-E2B-it-web.litertlm';

    const modelPath = navigator.onLine ? remoteModel : localModel;

    const engineSettings = {
      model: modelPath,
      mainExecutorSettings: { maxNumTokens: 8192 },
      onProgress: (progressInfo: { text: string; progress: number }) => {
        setAIToolingState('booting', progressInfo.text);
        console.log(`[WebGPU] LLM AI Boot Progress: ${Math.round(progressInfo.progress * 100)}%`);
      }
    };

    try {
      engine = await Engine.create(engineSettings);
    } catch (e) {
      console.warn("Remote model failed, trying local fallback...", e);
      // Force local path if the remote one failed (e.g. DNS error or 404)
      engineSettings.model = localModel;
      engine = await Engine.create(engineSettings);
    }

    isModelReady = true;
    setAIToolingState('ready', 'AI Engine Online');

    setTimeout(() => {
      const pill = document.getElementById('global-ai-status');
      if (pill) pill.style.opacity = '0';
    }, 5000);

  } catch (err) {
    console.error("Engine Init Failed:", err);
    setAIToolingState('error', 'AI Boot Failed');
  }
}

// ==========================================
// Pyodide Python Engine Initialization
// ==========================================
let isPythonReady = false;

function setPythonToolingState(state: 'booting' | 'ready' | 'error', message?: string) {
  const statusPill = document.getElementById('global-python-status');
  const statusText = document.getElementById('global-python-text');

  if (statusPill && statusText) {
    statusPill.className = `ai-status-pill ${state}`;
    if (message) statusText.innerText = message;
  }
}

async function initializePythonEngine() {
  setPythonToolingState('booting', 'Booting Python WASM...');

  try {
    // 1. Define Paths
    // Local path is priority for offline support
    const LOCAL_JS = "/cdn.jsdelivr.net/npm/pyodide@314.0.7/pyodide.js";
    const LOCAL_URL = "/cdn.jsdelivr.net/npm/pyodide@314.0.7";

    // CDN fallback for when you are online and local files are missing
    const CDN_JS = "https://cdn.jsdelivr.net/pyodide/v0.27.8/full/pyodide.js";
    const CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.8/full/";

    // 2. Inject script tag
    if (!(window as any).loadPyodide) {
      try {
        // Try Local first
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = LOCAL_JS;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Local JS not found"));
          document.head.appendChild(script);
        });
        console.log("Pyodide: Loaded from local storage.");
      } catch (err) {
        console.warn("Pyodide: Local JS not found, attempting CDN fallback...");
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = CDN_JS;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        } catch (cdnErr) {
          throw new Error("Pyodide failed to load from both Local and CDN.");
        }
      }
    }

    // 3. Initialize the Pyodide instance
    if (!(window as any).pyodide) {
      // Decide which indexURL to use based on where the script was loaded from
      const isLocal = (window as any).loadPyodide.src?.includes('localhost') ||
                      (window as any).loadPyodide.src?.includes('127.0.0.1') ||
                      !navigator.onLine;

      const finalIndexURL = isLocal ? LOCAL_URL : CDN_URL;

      try {
        (window as any).pyodide = await (window as any).loadPyodide({
          indexURL: finalIndexURL
        });
      } catch (e) {
        console.warn("Pyodide: indexURL failed, forcing local fallback...");
        (window as any).pyodide = await (window as any).loadPyodide({
          indexURL: LOCAL_URL
        });
      }
    }

    isPythonReady = true;
    setPythonToolingState('ready', 'Python Online');

    setTimeout(() => {
      const pill = document.getElementById('global-python-status');
      if (pill) pill.style.opacity = '0';
    }, 3000);

  } catch (err) {
    console.error("Pyodide Init Failed:", err);
    setPythonToolingState('error', 'Python Boot Failed');
  }
}


// ==========================================
// Code Execution & LLM Analysis
// ==========================================
async function executeActiveSourceCode(id: string) {
  const inst = instances.get(id);
  if (!inst) return;

  const runBtn = inst.container.querySelector('.btn-run') as HTMLButtonElement;
  if (runBtn.disabled) return; // Prevent spam-clicking

  const code = inst.view.state.doc.toString();
  const targetLang = (inst.container.querySelector('.local-lang-selector') as HTMLSelectElement).value;

  // 1. Lock UI & Dim (DO NOT clear the DOM yet to prevent vertical collapse)
  runBtn.disabled = true;
  runBtn.innerText = "⏳";

  const viewport = inst.container.querySelector('.output-viewport') as HTMLElement;
  viewport.style.opacity = '0.5';
  viewport.style.pointerEvents = 'none';
  viewport.style.transition = 'opacity 0.2s ease';

  inst.statusElement.innerHTML = `⏳ Executing...`;

  const unlockUI = () => {
    runBtn.disabled = false;
    runBtn.innerText = "▶ Run Code";
    viewport.style.opacity = '1';
    viewport.style.pointerEvents = 'auto';
  };

  // 2. Python Path (Synchronous/Awaited execution)
  if (targetLang === 'python') {
    if (!isPythonReady) {
      inst.statusElement.innerHTML = `⚠️ Python not ready`;
      unlockUI();
      return;
    }
    try {
      const py = (window as any).pyodide;
      inst.statusElement.innerHTML = `⏳ Resolving dependencies...`;

      // 1. Use unified parser
      const { parsed, manual } = parsePythonDependencies(code);
      const allDeps = [...new Set([...parsed, ...manual])];

      // 2a. Sync the magic comment in the editor silently before running
      writeRequirementsToEditor(inst.view, allDeps);

      // 2b. Re-grab the freshly synced code to run
      const finalCode = inst.view.state.doc.toString();

      // 3. Explicitly force Micropip to handle everything (Standard + Custom)
      if (allDeps.length > 0) {
        await py.loadPackage("micropip");
        const micropip = py.pyimport("micropip");
        await micropip.install(allDeps);
      }

      // 4. Execute the code with a clean, per-run buffer reset
      inst.statusElement.innerHTML = `⏳ Executing...`;
      await py.runPythonAsync(`
import sys, io
# Create a fresh buffer every time
new_buf = io.StringIO()
sys.stdout = new_buf
sys.stderr = new_buf
`);

      // Execute your code
      await py.runPythonAsync(finalCode);

      // Extract the output and reset stdout back to the original to avoid memory leaks
      const output = await py.runPythonAsync(`
val = sys.stdout.getvalue()
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
val
`);

      inst.webviewContainer.innerHTML = '';
      inst.stdoutElement.classList.remove('stderr');
      inst.stdoutElement.innerText = output.trim() ? output : '';
      inst.stdoutElement.style.display = output.trim() ? 'block' : 'none';
      inst.statusElement.innerHTML = `✅ Execution complete`;
    } catch (err: any) {
      inst.webviewContainer.innerHTML = '';
      inst.stdoutElement.classList.add('stderr');

      let cleanError = err.message;

      // Intercept the specific micropip JSON parsing crash
      if (cleanError.includes("Unsupported content type: text/plain")) {
        cleanError = "[Package Resolution Error]: The system tried to download a package from PyPI, but it doesn't exist. Check your import names or `# requirements:` spelling.";
      } else {
        // Fallback: Clean up standard Pyodide tracebacks
        cleanError = err.message.split('\n').slice(-3).join('\n') || err.message;
      }

      inst.stdoutElement.innerText =  err.message;
      inst.stdoutElement.style.display = 'block';
      inst.statusElement.innerHTML = `❌ Error in execution`;
    }
    unlockUI();
    return;
  }

  // 3. JS/TSX/HTML Path (Double-Buffered iframe execution)
  const safeCode = code
    .replace(/import\s+.*?from\s+['"]react.*?['"];?\n?/g, '')
    .replace(/export\s+const\s+(\w+)/g, 'window.$1')
    .replace(/export\s+function\s+(\w+)/g, 'window.$1 = function $1');

  // Mark existing iframes as stale (we won't delete them until the new one is ready)
  Array.from(inst.webviewContainer.children).forEach(child => child.classList.add('stale-frame'));

  const frame = document.createElement('iframe');
  frame.className = 'output-webview';
  frame.style.opacity = '0'; // Hide initially to prevent FOUC
  inst.webviewContainer.appendChild(frame);

if (targetLang === 'html') {
    frame.srcdoc = `<!DOCTYPE html><html><head>${SANDBOX_CSS}<script>window.addEventListener('pointerdown', () => window.parent.postMessage({ type: 'workspace-focus', id: '${id}' }, '*'), true);</script></head><body>${code}</body></html>`;

    // Atomic Swap
    inst.webviewContainer.querySelectorAll('.stale-frame').forEach(el => el.remove());
    frame.style.opacity = '1';
    inst.stdoutElement.innerText = '';
    inst.stdoutElement.style.display = 'none';

    inst.statusElement.innerHTML = `✅ Rendering complete`;
    unlockUI();
  } else {
    // Generate a unique ID for this specific run to prevent cross-talk from old frames
    const runId = `${id}-${Date.now()}`;

    // Hide the frame without pausing the browser's execution engine
    if (['js', 'javascript', 'ts', 'typescript'].includes(targetLang)) {
      frame.style.position = 'absolute';
      frame.style.visibility = 'hidden';
      frame.style.height = '0';
      frame.style.width = '0';
      frame.style.border = 'none';
    }

    frame.srcdoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          window.addEventListener('pointerdown', () => window.parent.postMessage({ type: 'workspace-focus', id: '${id}' }, '*'), true);
          const originalLog = console.log;
          console.log = function(...args) {
            originalLog.apply(console, args);
            window.parent.postMessage({ type: 'stdout', runId: '${runId}', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
          };
          window.onerror = function(msg) {
            window.parent.postMessage({ type: 'stderr', runId: '${runId}', text: msg }, '*');
          };
        </script>
        <script type="importmap">{"imports": {"react": "https://esm.sh/react@18.2.0","react-dom/client": "https://esm.sh/react-dom@18.2.0/client"}}</script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
      </head>
      <body>
        <div id="host"></div>
        <script type="text/babel" data-type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';

          // Broadcast that Babel has compiled and is about to run
          window.parent.postMessage({ type: 'status-start', runId: '${runId}' }, '*');

          const host = document.getElementById('host');
          const shadow = host.attachShadow({ mode: 'open' });
          const mountPoint = document.createElement('div');
          shadow.appendChild(mountPoint);

          const styleEl = document.createElement('style');
          styleEl.textContent = \`:host { display: flex; justify-content: center; padding: 20px; } .root-container { display: inline-block; }\`;
          shadow.appendChild(styleEl);

          window.React = React;
          const root = createRoot(mountPoint);
          window.root = root;

          try {
            ${safeCode}
            if (window.styles) {
              const compStyle = document.createElement('style');
              compStyle.textContent = window.styles;
              shadow.appendChild(compStyle);
            }
            window.parent.postMessage({ type: 'status-done', runId: '${runId}', success: true }, '*');
          } catch (err) {
            mountPoint.innerHTML = '<div style="color: #f38ba8; padding: 10px; font-family: monospace;">React Error: ' + err.message + '</div>';
            window.parent.postMessage({ type: 'status-done', runId: '${runId}', success: false }, '*');
          }
        </script>
      </body>
      </html>
    `;

    // 1. Clean up the PREVIOUS run's listener if it exists
    if (inst.currentRunListener) {
      window.removeEventListener('message', inst.currentRunListener);
    }

    const runListener = (e: MessageEvent) => {
      if (e.data?.runId !== runId) return;

      if (e.data.type === 'status-start') {
        inst.webviewContainer.querySelectorAll('.stale-frame').forEach(el => el.remove());
        frame.style.opacity = '1';
        inst.stdoutElement.classList.remove('stderr');
        inst.stdoutElement.innerText = '';
        inst.stdoutElement.style.display = 'none';
      }
      else if (e.data.type === 'stdout') {
        inst.stdoutElement.style.display = 'block';
        inst.stdoutElement.innerText += e.data.text + '\n';
      }
      else if (e.data.type === 'stderr') {
        inst.stdoutElement.style.display = 'block';
        inst.stdoutElement.classList.add('stderr');
        inst.stdoutElement.innerText += e.data.text + '\n';
      }
      else if (e.data.type === 'status-done') {
        inst.statusElement.innerHTML = e.data.success ? `✅ Execution complete` : `❌ Execution failed`;
        unlockUI();
        // Do NOT remove the event listener here.
        // We leave it alive so async tasks (like debounce/setTimeout) can continue logging to the terminal.
      }
    };

    // 2. Save the new listener to the instance and activate it
    inst.currentRunListener = runListener;
    window.addEventListener('message', runListener);

    setTimeout(() => {
      if (runBtn.disabled) {
        inst.statusElement.innerHTML = `❌ Sandbox timeout`;
        unlockUI();
        // We do remove it on a fatal timeout to prevent zombie memory leaks
        window.removeEventListener('message', runListener);
      }
    }, 5000);
  }
}

async function executeLLMAnalysis(id: string) {
  const workspaceInst = instances.get(id);
  const readingInst = typeof readingInstances !== 'undefined' ? readingInstances.get(id) : undefined;

  // Safely resolve the view
  const view = workspaceInst?.view || (readingInst && 'view' in readingInst ? (readingInst as any).view : readingInst);

  if (!view) return;

  // Extract the active language
  const activeLang = workspaceInst
    ? (workspaceInst.container.querySelector('.local-lang-selector') as HTMLSelectElement)?.value || workspaceInst.initialLang
    : 'typescript';

  // Dynamically resolve or inject the output viewport (fixes Reading Mode bug)
  let outputEl = document.getElementById(`llm-output-${id}`);
  if (!outputEl) {
    const parentContainer = view.dom.parentElement;
    if (parentContainer) {
      outputEl = document.createElement('div');
      outputEl.id = `llm-output-${id}`;
      outputEl.className = 'llm-output-viewport';
      outputEl.style.marginTop = '1rem';
      parentContainer.appendChild(outputEl);
    } else {
      console.error(`[System Error] Could not find mount point for instance ${id}`);
      return;
    }
  }

  const sysPromptEl = document.getElementById('llm-system-prompt') as HTMLTextAreaElement;
  const keywordSelect = document.getElementById('llm-keywords') as HTMLSelectElement;
  const triggerBtn = document.querySelector(`.btn-analyze-full[data-target="${id}"]`) as HTMLButtonElement;

  if (!isModelReady || !engine) {
    outputEl.classList.remove('hidden');
    outputEl.innerText = "[System Warning]: The LiteRT AI model is booting. Please wait a few seconds and try again.";
    return;
  }

  let originalBtnText = "Analyze";
  if (triggerBtn) {
    originalBtnText = triggerBtn.innerText;
    triggerBtn.disabled = true;
    triggerBtn.innerText = "Analyzing...";
  }

  const codePayload = view.state.doc.toString();
  let executionPayload = "(Terminal output empty)";

  if (workspaceInst && workspaceInst.stdoutElement) {
    const rawOutput = workspaceInst.stdoutElement.innerText.trim();
    if (rawOutput.length > 0) {
      executionPayload = rawOutput;
    }
  }

  const sysPrompt = sysPromptEl?.value || "Act as a senior principal engineer. Analyze this code snippet and its execution output.";
  const selectedKeywords = keywordSelect
    ? Array.from(keywordSelect.selectedOptions).map(opt => opt.value).join(', ')
    : "Code Review";

  // Explicitly tag the language in the markdown backticks
  const userMessage = `
FOCUS AREA KEYWORDS: ${selectedKeywords}

Please review the following ${activeLang.toUpperCase()} code, and its visual and terminal outputs, depending which are present.

CODE:
\\\${activeLang}
${codePayload}
\\\

TERMINAL OUTPUT:
\\\text
${executionPayload}
\\\
`;

  outputEl.classList.remove('hidden');
  outputEl.innerText = "[LLM] Thinking via local Gemma model...\n\n";

  try {
    const chatSession = await engine.createConversation({
      preface: {
        messages: [{ role: 'system', content: sysPrompt }]
      }
    });

    const stream = chatSession.sendMessageStreaming(userMessage);
    let isFirstToken = true;

    for await (const chunk of stream) {
      if (isFirstToken) {
        outputEl.innerText = ''; // Clear dispatch message
        isFirstToken = false;
      }

      for (const item of chunk.content) {
        if (item.type === 'text') {
          outputEl.innerText += item.text;
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      }
    }

    // outputEl.innerText += '\n\n[Local Analysis Complete]';

  } catch (err) {
    console.error("[LLM] Inference Error:", err);
    outputEl.innerText += `\n\n[LLM][FATAL ERROR]: ${err}`;
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerText = originalBtnText;
    }
  }
}

// ==========================================
// UI Boilerplate & Layout Initialization
// ==========================================
function setupGlobalControls() {
  document.getElementById('global-theme-changer')?.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;

    // Map the dropdown value to the actual theme extension
    let nextTheme;
    switch (target.value) {
      case 'atom-one':
        nextTheme = atomone;
        break;
      case 'vscode-dark':
        nextTheme = vscodeDark;
        break;
      case 'one-dark':
        nextTheme = oneDark;
        break;
      default:
        nextTheme = atomone;
        break;
    }

    // Dispatch to workspaces using their isolated compartment
    instances.forEach((inst) => {
      inst.view.dispatch({ effects: inst.themeComp.reconfigure(nextTheme) });
    });

    // Dispatch to reading instances using their isolated compartment
    readingInstances.forEach((inst) => {
      inst.view.dispatch({ effects: inst.themeComp.reconfigure(nextTheme) });
    });
  });
}

function initializeWorkbook() {
  const targetContainers = document.querySelectorAll('.editor-instance-container');
  targetContainers.forEach((el, index) => {
    const container = el as HTMLDivElement;

    const rawId = container.getAttribute('data-instance-id') || String(index);
    const id = `ws-${rawId}`;

    const initialLang = container.getAttribute('data-lang') || 'python';

    const wrapper = document.createElement('div');
    wrapper.className = 'editor-wrapper';

    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.innerHTML = `
      <div class="selector-group">
        <select class="local-lang-selector">
          <option value="python" ${initialLang === 'python' ? 'selected' : ''}>Python</option>
          <option value="ts" ${['ts', 'typescript'].includes(initialLang) ? 'selected' : ''}>TypeScript</option>
          <option value="tsx" ${initialLang === 'tsx' ? 'selected' : ''}>TSX/JSX</option>
          <option value="javascript" ${['js', 'javascript'].includes(initialLang) ? 'selected' : ''}>JavaScript</option>
          <option value="html" ${initialLang === 'html' ? 'selected' : ''}>HTML</option>
        </select>
      </div>
      <div class="meta-label">Instance Space #${rawId}</div>
    `;

    const editorTarget = document.createElement('div');
    editorTarget.className = 'editor-mount-point';

    // Scalable toolbar
    const matrixContainer = document.createElement('div');
    matrixContainer.className = 'editor-footer-toolbar';
    matrixContainer.innerHTML = `
      <div class="toolbar-group">
        <button class="btn-run">▶ Run Code</button>
      </div>

      <div class="toolbar-group utility-strip">
        <button class="btn-aux btn-reset" title="Reset Module">Reset</button>
        <div class="utility-divider"></div>
        <button class="btn-aux btn-copy" data-action="copy" title="Copy to Clipboard">Copy</button>
        <button class="btn-aux btn-export" data-action="export" title="Export (.py + requirements.txt)">Export</button>
        <!--<button class="btn-aux" data-action="sub-l" title="Spawn Sub-Process Left">Sub-L</button>-->
        <!--<button class="btn-aux" data-action="sub-r" title="Spawn Sub-Process Right">Sub-R</button>-->
      </div>

      <div class="toolbar-group">
        <button class="btn-analyze-full" data-target="${id}"
            ${isModelReady ? '' : 'disabled style="opacity:0.6; cursor:not-allowed;"'}>
            ${isModelReady ? 'Analyze Code & Output' : '⏳ AI Booting...'}
        </button>
      </div>
    `;

    // 1. Primary Run Listener
    matrixContainer.querySelector('.btn-run')?.addEventListener('click', () => executeActiveSourceCode(id));

    // 2. AI Analyze Listener
    matrixContainer.querySelector('.btn-analyze-full')?.addEventListener('click', (e) => {
      const targetId = (e.currentTarget as HTMLButtonElement).getAttribute('data-target');
      if (targetId) executeLLMAnalysis(targetId);
    });

    // 3. Core Utility Hooks (Clear & Format)
    matrixContainer.querySelector('.btn-reset')?.addEventListener('click', () => {
      const inst = instances.get(id);
      if (inst) {
        // Kill any surviving async listeners
        if (inst.currentRunListener) {
          window.removeEventListener('message', inst.currentRunListener);
          inst.currentRunListener = undefined;
        }

        // 1. Revert the Dropdown UI
        const select = inst.container.querySelector('.local-lang-selector') as HTMLSelectElement;
        if (select) select.value = inst.initialLang;

        // 2. Revert the Editor State (Language + Original Code)
        inst.view.dispatch({
          effects: langComp.reconfigure(getLanguageExtension(inst.initialLang)),
          changes: { from: 0, to: inst.view.state.doc.length, insert: inst.initialCode }
        });

        // 3. Clear Output & Reset Terminal UI
        inst.stdoutElement.innerText = '';
        inst.stdoutElement.style.display = 'none'; // Hides the terminal slot cleanly
        inst.webviewContainer.innerHTML = '';
        inst.statusElement.innerHTML = '(Terminal Idle)';

        const llmOut = document.getElementById(`llm-output-${id}`);
        if (llmOut) { llmOut.innerText = ''; llmOut.classList.add('hidden'); }
      }
    });

    // --- Auxiliary Buttons ---
    // --- 1. COPY LOGIC ---
    matrixContainer.querySelector('[data-action="copy"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const targetLang = (container.querySelector('.local-lang-selector') as HTMLSelectElement).value;

      let currentCode = view.state.doc.toString();

      // Just-In-Time Sync: Update magic comment before copying
      if (targetLang === 'python') {
        const { parsed, manual } = parsePythonDependencies(currentCode);
        const allDeps = [...new Set([...parsed, ...manual])];

        writeRequirementsToEditor(view, allDeps);
        currentCode = view.state.doc.toString(); // Re-grab the synced code
      }

      try {
        await navigator.clipboard.writeText(currentCode);
        const originalText = btn.innerText;
        btn.innerText = "✅ Copied!";
        setTimeout(() => btn.innerText = originalText, 2000);
      } catch (err) {
        console.error("Clipboard write failed", err);
        btn.innerText = "❌ Error";
        setTimeout(() => btn.innerText = "📋 Copy", 2000);
      }
    });

    // --- 2. EXPORT LOGIC ---
    matrixContainer.querySelector('[data-action="export"]')?.addEventListener('click', () => {
      const targetLang = (container.querySelector('.local-lang-selector') as HTMLSelectElement).value;
      let currentCode = view.state.doc.toString();

      if (targetLang === 'python') {
        // Just-In-Time Sync: Update magic comment before exporting
        const { parsed, manual } = parsePythonDependencies(currentCode);
        const allDeps = [...new Set([...parsed, ...manual])];

        writeRequirementsToEditor(view, allDeps);
        currentCode = view.state.doc.toString();

        const reqText = allDeps.length > 0
          ? allDeps.join('\n') + '\n'
          : '# No external dependencies detected\n';

        downloadBlob(`script_${rawId}.py`, currentCode, 'text/x-python');

        if (allDeps.length > 0) {
          // Delay prevents browser from blocking the second download as spam
          setTimeout(() => downloadBlob(`requirements.txt`, reqText, 'text/plain'), 100);
        }
      } else {
        // Generic fallback for non-Python languages
        const extMap: Record<string, string> = {
          'ts': 'ts', 'html': 'html', 'c': 'c', 'cpp': 'cpp', 'rust': 'rs', 'go': 'go'
        };
        const ext = extMap[targetLang] || 'txt';
        downloadBlob(`script_${rawId}.${ext}`, currentCode, 'text/plain');
      }
    });

    const outputViewport = document.createElement('div');
    outputViewport.className = 'output-viewport';

    const outputHeader = document.createElement('div');
    outputHeader.className = 'output-header';
    const statusElement = document.createElement('div');
    statusElement.className = 'output-status';
    statusElement.innerHTML = `(Terminal Idle)`;
    outputHeader.appendChild(statusElement);

    const stdoutContainer = document.createElement('div');
    stdoutContainer.className = 'output-stdout';
    stdoutContainer.id = `stdout-${id}`;

    const webviewContainer = document.createElement('div');
    webviewContainer.className = 'webview-container';

    outputViewport.append(outputHeader, stdoutContainer, webviewContainer);

    const llmOutputViewport = document.createElement('div');
    llmOutputViewport.id = `llm-output-${id}`;
    llmOutputViewport.className = 'llm-output-viewport hidden';

    // ---

    const reqStrip = document.createElement('div');
    reqStrip.className = 'requirements-strip hidden';

    // Mount the strip above the editor
    wrapper.append(toolbar, reqStrip, editorTarget, matrixContainer, outputViewport, llmOutputViewport);
    container.appendChild(wrapper);

    // --- State Management for the Strip ---
    const renderReqStrip = (code: string, view: EditorView) => {
      const targetLang = (container.querySelector('.local-lang-selector') as HTMLSelectElement).value;

      // Only show this UI for Python
      if (targetLang !== 'python') {
        reqStrip.classList.add('hidden');
        return;
      }

      const { parsed, manual } = parsePythonDependencies(code);
      const allDeps = [...parsed, ...manual];

      // Hide if completely empty, otherwise show
      if (allDeps.length === 0) {
        reqStrip.classList.add('hidden');
        return;
      }

      reqStrip.classList.remove('hidden');
      reqStrip.innerHTML = `<span style="color:#6c7086; margin-right: 8px;">Pip:</span>`;

      // Render auto-detected imports
      parsed.forEach(pkg => {
        reqStrip.innerHTML += `<span class="req-badge auto-detected" title="Auto-detected from import">${pkg}</span>`;
      });

      // Render manually added requirements
      manual.forEach(pkg => {
        const badge = document.createElement('span');
        badge.className = 'req-badge';
        badge.innerHTML = `${pkg} <span class="remove-btn">×</span>`;

        badge.querySelector('.remove-btn')?.addEventListener('click', () => {
          const updated = allDeps.filter(p => p !== pkg);
          writeRequirementsToEditor(view, updated);
        });

        reqStrip.appendChild(badge);
      });

      // The Native Autocomplete Input
      const input = document.createElement('input');
      input.className = 'req-input';
      input.placeholder = '+ Add package...';
      input.setAttribute('list', 'pypi-suggestions'); // Binds to the native datalist

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          e.preventDefault();
          // 1. Capture exactly what the user typed
          const rawPkg = input.value.trim().toLowerCase();
          // 2. Translate it if it exists in our dictionary, otherwise keep it
          const newPkg = PYPI_ALIASES[rawPkg] || rawPkg;
          if (!allDeps.includes(newPkg)) {
            writeRequirementsToEditor(view, [...allDeps, newPkg]);
          }
          input.value = '';
        }
      });

      reqStrip.appendChild(input);
    };

    // ---

    // 1. Create fresh, unique compartments for THIS specific editor
    const langComp = new Compartment();
    const themeComp = new Compartment();

    const entry = sampleRegistry[initialLang] || { code: "// Select a module..." };
    const initialCode = entry.code || '# Type code here';

    const state = EditorState.create({
      doc: initialCode,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), history(), highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        langComp.of(getLanguageExtension(initialLang)), // Use local compartment
        themeComp.of(atomone), highlightField,          // Use local compartment
        EditorView.updateListener.of((update) => {
          // 2. USE NATIVE CODEMIRROR TRACKING (Bypasses all DOM event bugs)
          if (update.view.hasFocus) {
            lastActiveWorkspaceId = id;
          }

          if (update.docChanged) {
            renderReqStrip(update.state.doc.toString(), view);
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: editorTarget });
    renderReqStrip(initialCode, view);

    // 3. Save the compartments to the Map so we can update them later
    instances.set(id, {
      id, view, container: wrapper, statusElement,
      stdoutElement: stdoutContainer, webviewContainer,
      initialLang, initialCode, langComp, themeComp
    });

    toolbar.querySelector('.local-lang-selector')?.addEventListener('change', (e) => {
      const selected = (e.target as HTMLSelectElement).value;
      // 4. Dispatch using the local compartment
      view.dispatch({ effects: langComp.reconfigure(getLanguageExtension(selected)) });

      let placeholder = `// Type ${selected} code here`;
      if (selected === 'python') placeholder = `# Type python code here`;
      else if (selected === 'html') placeholder = ``;

      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: placeholder } });
    });
  });
}

function setupNavigationAndSidebar() {
  const sidebar = document.getElementById('hotkey-sidebar');
  const btnToggle = document.getElementById('btn-toggle-hotkeys');
  const btnClose = document.getElementById('btn-close-hotkeys');
  const viewWorkspace = document.getElementById('btn-view-workspace');
  const viewReading = document.getElementById('btn-view-reading');
  const appWorkspace = document.getElementById('app');
  const appReading = document.getElementById('reading-view');

  btnToggle?.addEventListener('click', () => sidebar?.classList.toggle('closed'));
  btnClose?.addEventListener('click', () => sidebar?.classList.add('closed'));

  viewWorkspace?.addEventListener('click', () => {
    appWorkspace?.classList.remove('hidden'); appReading?.classList.add('hidden');
    viewWorkspace.classList.add('active'); viewReading?.classList.remove('active');
  });

  viewReading?.addEventListener('click', () => {
    appReading?.classList.remove('hidden'); appWorkspace?.classList.add('hidden');
    viewReading.classList.add('active'); viewWorkspace?.classList.remove('active');
  });

  const list = document.getElementById('hotkey-list');
  if (list) {
    [...defaultKeymap, ...historyKeymap].forEach(binding => {
      if (!binding.key) return;
      const li = document.createElement('li');
      li.className = 'hotkey-item';
      li.innerHTML = `<span class="hotkey-desc">${binding.run?.name || 'Custom Action'}</span><span class="hotkey-key">${binding.mac ? `${binding.key} / ${binding.mac} (Mac)` : binding.key}</span>`;
      list.appendChild(li);
    });
  }
}

// --- ASK ANYTHING COMPONENT ---
const floatingWidget = document.getElementById('floating-ai-widget') as HTMLElement;
const btnToggle = document.getElementById('btn-floating-toggle') as HTMLButtonElement;
const btnClose = document.getElementById('btn-floating-close') as HTMLButtonElement;
const askInput = document.getElementById('llm-ask-anything') as HTMLTextAreaElement;
const btnSend = document.getElementById('btn-ask-anything-send') as HTMLButtonElement;
const floatingOutput = document.getElementById('floating-llm-output') as HTMLElement;

// Toggle Logic
btnToggle.addEventListener('click', () => {
  floatingWidget.classList.add('expanded');
  askInput.focus();
});

btnClose.addEventListener('click', () => {
  floatingWidget.classList.remove('expanded');
});

// Dedicated Floating LLM Execution
async function executeFloatingLLM() {
  const text = askInput.value.trim();
  if (!text) return;

  // 1. Check the state of the toggle
  const toggleEl = document.getElementById('toggle-editor-context') as HTMLInputElement;
  const useContext = toggleEl ? toggleEl.checked : true;

  floatingOutput.style.display = 'block';
  btnSend.disabled = true;
  btnSend.style.opacity = '0.5';

  let finalPrompt = "";

  // 2. Branch Logic: Context OFF
  if (!useContext) {
    floatingOutput.innerHTML = `<em style="color:#a6adc8;">Thinking... (No editor context attached)</em>\n\n`;
    finalPrompt = text; // Send exactly what the user typed, nothing else.
  }
  // 3. Branch Logic: Context ON
  else {
    const activeId = lastActiveWorkspaceId;

    if (!activeId) {
      console.error("[Floating LLM] Could not resolve an active workspace ID.");
      floatingOutput.innerHTML = `<span style="color:#f38ba8;">[Error]: Click inside an editor first to select it as context. (Or uncheck the "Use selected editor" box)</span>`;
      btnSend.disabled = false;
      btnSend.style.opacity = '1';
      return;
    }

    floatingOutput.innerHTML = `<em style="color:#a6adc8;">Thinking... (Context locked to: ${activeId})</em>\n\n`;

    const workspaceInst = instances.get(activeId);
    const readingInst = typeof readingInstances !== 'undefined' ? readingInstances.get(activeId) : undefined;
    const view = workspaceInst?.view || (readingInst && 'view' in readingInst ? (readingInst as any).view : readingInst);

    if (!view) {
       floatingOutput.innerHTML = `<span style="color:#f38ba8;">[Error]: Failed to extract code from ${activeId}.</span>`;
       btnSend.disabled = false;
       btnSend.style.opacity = '1';
       return;
    }

    const activeLang = workspaceInst
      ? (workspaceInst.container.querySelector('.local-lang-selector') as HTMLSelectElement)?.value || workspaceInst.initialLang
      : 'typescript';

    const codeContext = view.state.doc.toString();
    let executionPayload = "(Terminal output empty)";

    if (workspaceInst && workspaceInst.stdoutElement) {
      const rawOutput = workspaceInst.stdoutElement.innerText.trim();
      if (rawOutput.length > 0) {
        executionPayload = rawOutput;
      }
    }

    // Construct as an array to formally prevent IDE auto-indentation
    // from breaking the Markdown backticks, and put the prompt at the end.
    finalPrompt = [
      `Please address the directive at the bottom using the following ${activeLang.toUpperCase()} code as context.`,
      ``,
      `--- ACTIVE EDITOR CODE ---`,
      `\`\`\`${activeLang}`,
      codeContext,
      `\`\`\``,
      ``,
      `--- RECENT TERMINAL OUTPUT ---`,
      `\`\`\`text`,
      executionPayload,
      `\`\`\``,
      ``,
      `PRIMARY USER DIRECTIVE:`,
      text
    ].join('\n');
  }

  // 4. Send Payload to LLM
  try {
    if (!isModelReady || !engine) {
      throw new Error("Local AI model is not ready yet.");
    }

    // --- Dynamically restore the STRICT system prompt ---
    const systemInstruction = useContext
      ? 'You are a concise, expert senior engineer assisting a user in their IDE. Always answer their PRIMARY USER DIRECTIVE first and foremost, using the provided code as context.'
      : 'You are a concise, expert senior engineer. Answer the user\'s question directly.';

    const chatSession = await engine.createConversation({
      preface: {
        messages: [{ role: 'system', content: systemInstruction }]
      }
    });

    const stream = chatSession.sendMessageStreaming(finalPrompt);
    let isFirstToken = true;

    for await (const chunk of stream) {
      if (isFirstToken) {
        floatingOutput.innerText = '';
        isFirstToken = false;
      }

      for (const item of chunk.content) {
        if (item.type === 'text') {
          floatingOutput.innerText += item.text;
          floatingOutput.scrollTop = floatingOutput.scrollHeight;
        }
      }
    }

  } catch (err: any) {
    console.error("[Floating LLM] Error:", err);
    floatingOutput.innerText += `\n\n[Error]: ${err.message || err}`;
  } finally {
    btnSend.disabled = false;
    btnSend.style.opacity = '1';
  }
}
// Fire on click
btnSend.addEventListener('click', executeFloatingLLM);

// Fire on Ctrl/Cmd + Enter
askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    executeFloatingLLM();
  }
});

// ---

function initializeReadingView() {
  document.querySelectorAll('.reading-editor-container').forEach((el, index) => {
    const id = `read-${index}`;
    const lang = el.getAttribute('data-lang') || 'ts';

    el.setAttribute('data-read-id', id);

    // 1. Create fresh compartments
    const langComp = new Compartment();
    const themeComp = new Compartment();

    const state = EditorState.create({
      doc: `// Pre-allocated array to avoid GC spikes\nconst maxEntities = 10000;\nconst entityBuffer = new Float32Array(maxEntities * 16);\n\nfunction updateTick() {\n  for (let i = 0; i < maxEntities; i++) {\n    // process memory linearly\n  }\n}`,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), keymap.of([...defaultKeymap, ...historyKeymap]),
        langComp.of(getLanguageExtension(lang)), // Use local
        themeComp.of(oneDark),                   // Use local
        highlightField,
        EditorView.updateListener.of((update) => {
          // 2. Native focus tracking
          if (update.view.hasFocus) {
            lastActiveWorkspaceId = id;
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: el as Element });
    // 3. Save to map
    readingInstances.set(id, { view, themeComp });

    // Find the button inside or adjacent to this specific container and update its target
    const containerWrapper = el.closest('.reading-view-wrapper') || el.parentElement;
    const analyzeBtn = containerWrapper?.querySelector('.btn-analyze');

    if (analyzeBtn) {
      analyzeBtn.setAttribute('data-target', id); // Update the HTML attribute safely
      analyzeBtn.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLButtonElement).getAttribute('data-target');
        if (targetId) executeLLMAnalysis(targetId);
      });
    }
    // Sync the hardcoded DOM id so executeLLMAnalysis can find it
    const outputDiv = containerWrapper?.querySelector('.llm-output-viewport');
    if (outputDiv) {
      outputDiv.id = `llm-output-${id}`;
    }
  });
}

// Utility function for triggering local browser downloads
function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

// ==========================================
// Boot
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initializeWorkbook();
  setupGlobalControls();
  setupNavigationAndSidebar();
  initializeReadingView();

  try {
    // STAGE 1: Boot Python
    await initializePythonEngine();

    // STAGE 2: Prime the AI WASM Internals LOCALLY
    // This prevents the library from ever calling the CDN
    await loadWasmInternals();

    // STAGE 3: Boot the AI Engine
    await initializeAIEngine();

  } catch (err) {
    console.error("Boot sequence failed:", err);
  }
});