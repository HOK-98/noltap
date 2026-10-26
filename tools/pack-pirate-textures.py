"""Lossless GLB structure repack + smaller web textures. Requires Pillow."""
import io
import json
import struct
import sys
from pathlib import Path
from PIL import Image

for name in sys.argv[1:]:
    path = Path(name)
    original = path.read_bytes()
    json_size = struct.unpack_from('<I', original, 12)[0]
    data = json.loads(original[20:20 + json_size])
    binary = original[28 + json_size:]
    base_images = set()
    normal_images = set()
    for mat in data.get('materials', []):
        texture = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if texture:
            base_images.add(data['textures'][texture['index']]['source'])
        texture = mat.get('normalTexture')
        if texture:
            normal_images.add(data['textures'][texture['index']]['source'])
    replacements = {}
    for index, image in enumerate(data.get('images', [])):
        view = data['bufferViews'][image['bufferView']]
        offset = view.get('byteOffset', 0)
        picture = Image.open(io.BytesIO(binary[offset:offset + view['byteLength']])).convert('RGB')
        limit = 1024 if index in base_images else 512
        picture.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        if index in normal_images:
            picture.save(encoded, format='PNG', optimize=True)
            image['mimeType'] = 'image/png'
        else:
            picture.save(encoded, format='JPEG', quality=88, optimize=True)
            image['mimeType'] = 'image/jpeg'
        replacements[image['bufferView']] = encoded.getvalue()
    output = bytearray()
    for index, view in enumerate(data['bufferViews']):
        offset = view.get('byteOffset', 0)
        payload = replacements.get(index, binary[offset:offset + view['byteLength']])
        output.extend(b'\0' * ((-len(output)) % 4))
        view['byteOffset'] = len(output)
        view['byteLength'] = len(payload)
        output.extend(payload)
    data['buffers'][0]['byteLength'] = len(output)
    output.extend(b'\0' * ((-len(output)) % 4))
    header = json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode()
    header += b' ' * ((-len(header)) % 4)
    packed = struct.pack('<III', 0x46546C67, 2, 28 + len(header) + len(output)) + struct.pack('<II', len(header), 0x4E4F534A) + header + struct.pack('<II', len(output), 0x004E4942) + output
    path.write_bytes(packed)
    print(f'{path.name}: {len(original):,} -> {len(packed):,} bytes')
