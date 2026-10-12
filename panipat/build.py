#!/usr/bin/env python3
"""Build both Panipat bundles from src/: the diorama (two-tone + ink, the train's style) and the point cloud."""
import pathlib, re
root = pathlib.Path(__file__).parent
repo = root.parent
prefix = (repo / "vendor/three-r184.prefix.js").read_text()
src = lambda n: (root / "src" / n).read_text()
ascii_ = lambda s: "".join(c if ord(c) < 128 else "\\u%04x" % ord(c) for c in s)
def write(name, app):
    out = ascii_(prefix + "\n(()=>{\n" + app + "})();\n})();\n")
    (root / name).write_text(out); print(name, len(out))
# diorama: reuses the train's two-tone material core and theme table
core = (repo / "src/01-core.js").read_text()
themes = re.search(r"const THEMES = \[.*?\n\];", (repo / "src/04-film.js").read_text(), re.S).group(0)
solid = src("21-solid.js")
head, tail = solid.split("/* ----- animated figures", 1)
write("panipat-diorama.js", core + "\n" + themes + "\n" + head + src("11-scene.js") + "\n/* ----- animated figures" + tail + "\n" + src("22-main.js"))
# point cloud
write("panipat-points.js", "".join(src(n) + "\n" for n in ["10-core.js", "11-scene.js", "12-build.js", "13-main.js"]))
