"""Prepare a replacement GLB as webpage scripts in a separate staging directory."""
import argparse
import base64
import json
import struct
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('edition', choices=('focus', 'grok'))
parser.add_argument('model', choices=('deer', 'box-closed', 'ampoule', 'usage'))
parser.add_argument('glb', type=Path)
parser.add_argument('output', type=Path, help='New directory for the replacement chunks and manifest')
args = parser.parse_args()

data = args.glb.read_bytes()
if len(data) < 20 or struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
    parser.error('Expected a complete GLB 2 file')
model_dir = repo / args.edition / 'assets' / 'models'
manifest_text = (model_dir / 'manifest.js').read_text()
manifest = json.loads(manifest_text.split('=', 1)[1].strip().rstrip(';'))
entry = next(item for item in manifest if item['name'] == args.model)
encoded = base64.b64encode(data).decode('ascii')
chunk_size = 1_500_000
chunks = [encoded[start:start + chunk_size] for start in range(0, len(encoded), chunk_size)]
args.output.mkdir(parents=True, exist_ok=False)
entry['files'] = []
for i, chunk in enumerate(chunks):
    name = f'{args.model}.{i}.js'
    (args.output / name).write_text(f"""__GLBP("{args.model}",{i},{len(chunks)},'{chunk}');\n""")
    entry['files'].append([name, len(chunk)])
(args.output / 'manifest.js').write_text('window.__GLB_MANIFEST=' + json.dumps(manifest) + ';\n')
