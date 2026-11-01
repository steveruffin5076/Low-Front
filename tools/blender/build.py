"""
Builds every weapon and attachment model and exports them as GLB to public/models/.

    npm run models               # all models
    npm run models -- vx4        # only models whose key contains "vx4"
    npm run models -- --preview  # also render previews to tools/blender/previews/

Each module in guns/ and attachments/ has `models()`, returning a list of (key, Model).
The key is the file path under public/models/ without ".glb", e.g. "guns/vx4_fp".
"""
import importlib
import json
import os
import pkgutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import attachments  # noqa: E402
import guns  # noqa: E402

OUT = os.path.join(HERE, "..", "..", "public", "models")
PREVIEWS = os.path.join(HERE, "previews")


def collect():
    for pkg in (guns, attachments):
        for info in pkgutil.iter_modules(pkg.__path__):
            mod = importlib.import_module(f"{pkg.__name__}.{info.name}")
            yield from mod.models()


def main(argv):
    preview = "--preview" in argv
    only = [a for a in argv if not a.startswith("--")]
    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for key, model in collect():
        if only and not any(o in key for o in only):
            continue
        path = os.path.join(OUT, key + ".glb")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        prefix = None
        if preview:
            os.makedirs(PREVIEWS, exist_ok=True)
            prefix = os.path.join(PREVIEWS, key.replace("/", "_"))
        model.export(path, prefix)
        manifest[key] = {"file": key + ".glb", "triangles": model.triangles()}
        print(f"{key}: {model.triangles()} triangles")
    with open(manifest_path, "w") as f:
        json.dump(dict(sorted(manifest.items())), f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main(sys.argv[1:])
