"""Rebuild the Sunny Side Up collision layout from an externally supplied official DATA v4 map.
The original Ravie map and adapted layout retain the upstream CC-BY-SA license.
Source: https://github.com/ddnet/ddnet/blob/master/data/maps/license.txt
"""
import sys
from pathlib import Path
import struct, zlib, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
def layers(path):
    blob = path.read_bytes()
    if blob[:4] != b'DATA': raise ValueError('Not a Teeworlds DATA map')
    version, _, _, nt, ni, nd, item_size, data_size = struct.unpack_from('<8i', blob, 4)
    if version != 4: raise ValueError('Only map version 4 is supported')
    offset = 36 + nt * 12
    item_offsets = struct.unpack_from(f'<{ni}i', blob, offset); offset += ni * 4
    data_offsets = struct.unpack_from(f'<{nd}i', blob, offset); offset += nd * 4
    raw_sizes = struct.unpack_from(f'<{nd}i', blob, offset); offset += nd * 4
    def raw(index):
        end = data_offsets[index + 1] if index + 1 < nd else data_size
        data = zlib.decompress(blob[offset + item_size + data_offsets[index]:offset + item_size + end])
        if len(data) != raw_sizes[index]: raise ValueError('Map data length mismatch')
        return data
    found = {}
    for item_offset in item_offsets:
        type_id, size = struct.unpack_from('<2i', blob, offset + item_offset)
        if type_id >> 16 != 5: continue
        a = struct.unpack_from(f'<{size // 4}i', blob, offset + item_offset + 8)
        if len(a) < 15 or a[1] != 2: continue
        if a[6] & 1: found['game'] = (a[4], a[5], raw(a[14]))
        if a[6] & 8: found['front'] = (a[4], a[5], raw(a[20]))
        if a[6] & 2: found['tele'] = (a[4], a[5], raw(a[18]))
        if a[6] & 4: found['speed'] = (a[4], a[5], raw(a[19]))
        if a[6] & 16: found['switch'] = (a[4], a[5], raw(a[21]))
    return found, hashlib.sha256(blob).hexdigest()

def convert():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'work/Sunny Side Up.map'
    data, sha = layers(source)
    width, height, game = data['game']; front = data['front'][2]
    legend = {0: '.', 1: '#', 2: '^', 3: 'X', 9: '~', 11: 'U', 33: '>', 34: 'F', 192: 'S'}
    unknown = set(game[::4]) - legend.keys()
    if unknown: raise ValueError(f'Unimplemented collision types: {unknown}')
    tiles = [legend[t] for t in game[::4]]
    through = 0
    for i, tile in enumerate(front[::4]):
        if tile == 5 and tiles[i] in '#X': tiles[i] = 'O'; through += 1
        elif tile not in (0, 5) and not 35 <= tile <= 59: raise ValueError(f'Unsupported front tile: {tile}')
    result = dict(id='dd-sunny', name='Sunny Side Up', description='Ravie作。公式マップの配置・フック透過壁を移植したプレリリース。独自エンジンでの通しクリアは未検証です。', minPlayers=2,
        width=width, height=height, tiles=[''.join(tiles[y*width:(y+1)*width]) for y in range(height)], hints=[],
        source=dict(author='Ravie', url='https://ddnet.org/maps/Sunny-32-Side-32-Up', sha256=sha, license='CC-BY-SA, as stated by upstream'))
    (ROOT / 'shared/dd-sunny.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Converted {width}x{height}; preserved {through} hook-through wall tiles; source SHA-256 {sha}')
if __name__ == '__main__':
    convert()
