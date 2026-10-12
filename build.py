#!/usr/bin/env python3
"""Assemble vande-bharat.js: the vendored three.js prefix + the figure source, in one closure."""
import pathlib, re
root = pathlib.Path(__file__).parent
prefix = (root / "vendor/three-r184.prefix.js").read_text()
app = "".join((root / "src" / n).read_text() + "\n" for n in ["01-core.js", "02-train.js", "03-stage.js", "04-film.js", "06-points.js", "05-main.js"])
paints = set(re.findall(r'\["(\w+)", "[^"]+", "#', app))
options = set(re.findall(r"(\w+): ", re.search(r"const DEFAULTS = \{(.*?)\n\};", app, re.S).group(1)))
assert not paints & options, f"paint names clash with option names: {paints & options}"
out = prefix + "\n/* ---- Vande Bharat figure ---- */\n(()=>{\n" + app + "})();\n})();\n"
out = "".join(c if ord(c) < 128 else "\\u%04x" % ord(c) for c in out)   # keep the bundle pure ASCII
(root / "vande-bharat.js").write_text(out)
print("vande-bharat.js", len(out), "bytes")
