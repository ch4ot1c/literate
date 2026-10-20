#!/usr/bin/env bash
ROOT="$(dirname "$0")"
mkdir -p "$ROOT/public"

urls=(
    "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm"
    "https://cdn.jsdelivr.net/npm/@litert-lm/core@0.12.0/wasm/litertlm_wasm_internal.js"
    "https://cdn.jsdelivr.net/npm/@litert-lm/core@0.12.0/wasm/litertlm_wasm_internal.wasm"
    "https://pyodide.org/_/static/javascript/readthedocs-addons.js"
    "https://github.com/pyodide/pyodide/releases/download/0.27.8/pyodide-0.27.8.tar.bz2"
)

for u in "${urls[@]}"; do
    fn=$(basename "$u")
    curl -sL "$u" -o "$ROOT/public/$fn"
    echo "✓ Downloaded $fn"
done
