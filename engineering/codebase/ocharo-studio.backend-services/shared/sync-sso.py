#!/usr/bin/env python3
"""Check or update the generated Ocharo SSO source snapshot without network access."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check", action="store_true", help="verify the checked-in manifest (default)")
parser.add_argument("--source", type=Path, help="authoritative Ocharo.Sso project directory")
parser.add_argument("--update", action="store_true", help="copy authoritative sources and regenerate manifest")
args = parser.parse_args()
target = Path(__file__).resolve().parent / "Ocharo.Sso"
manifest_path = target / "snapshot.json"
manifest = json.loads(manifest_path.read_text())
def sources(root):
    return {p.name: p.read_bytes() for p in root.iterdir() if p.is_file() and p.suffix in (".cs", ".csproj")}
def hashes(values):
    return {name: hashlib.sha256(body).hexdigest() for name, body in sorted(values.items())}
if args.update:
    if args.source is None:
        parser.error("--update requires --source")
    incoming = sources(args.source)
    if "Ocharo.Sso.csproj" not in incoming or "SsoMiddleware.cs" not in incoming:
        parser.error("source must be the Ocharo.Sso project")
    for old in sources(target):
        if old not in incoming:
            (target / old).unlink()
    for name, body in incoming.items():
        (target / name).write_bytes(body)
    manifest["files"] = hashes(incoming)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
actual = hashes(sources(target))
if actual != manifest["files"]:
    raise SystemExit("SSO snapshot differs from its manifest; update from the authoritative source.")
if args.source is not None and actual != hashes(sources(args.source)):
    raise SystemExit("SSO snapshot differs from authoritative source.")
print(f"Verified {len(actual)} Ocharo SSO source files.")
