#!/usr/bin/env python3
"""Batch replace legacy slate/indigo/purple UI with MediaFlow mf-* tokens."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "src/app"

REPLACEMENTS = [
    ("font-semibold text-slate-700", "font-semibold text-mf-text"),
    ("text-slate-700", "text-mf-text"),
    ("text-slate-600", "text-mf-muted"),
    ("text-slate-500", "text-mf-muted"),
    ("text-slate-400", "text-mf-muted"),
    ("border-slate-200", "border-mf-border"),
    ("border-slate-300", "border-mf-border"),
    ("bg-slate-50", "bg-mf-canvas"),
    ("hover:border-slate-300", "hover:border-mf-border"),
    ("hover:bg-white", "hover:bg-mf-surface"),
    ("border-indigo-500 bg-indigo-50", "border-mf-cta bg-mf-accent-soft"),
    ("color='purple'", "color='green'"),
    ('color="purple"', 'color="green"'),
    (
        "background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',\n                border: 'none',\n                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'",
        "border: 'none'",
    ),
    ("shrink-0 bg-[#6366f1]", "shrink-0 !bg-mf-cta"),
    ("bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]", "bg-mf-cta"),
    ("rounded-2xl rounded-tr-md bg-[#6366f1]", "rounded-2xl rounded-tr-md bg-mf-cta"),
]

FILES = [
    "page.jsx",
    "components/AssetZipConvert.jsx",
    "components/VapToolInternal.jsx",
    "components/VideoWatermarkRemover.jsx",
    "components/SvgaToolInternal.jsx",
    "components/SvgaTool.jsx",
    "components/ImageGenerate.jsx",
    "components/AiChatAssistant.jsx",
]

def migrate_file(path: Path) -> int:
    text = path.read_text()
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text)
        return 1
    return 0

def main():
    n = 0
    for rel in FILES:
        p = ROOT / rel
        if p.exists() and migrate_file(p):
            print(f"updated {rel}")
            n += 1
    print(f"done: {n} files")

if __name__ == "__main__":
    main()
