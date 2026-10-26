"""Convert downloaded CC0 Foley to small, onset-aligned mono PCM files."""
import array
from pathlib import Path
import sys
import wave

root = Path(__file__).resolve().parents[1]
downloads = Path.home() / 'Downloads'
output = root / 'public' / 'audio'
output.mkdir(exist_ok=True)
sources = [
    ('326868__johnbuhr__sword_clash-7.wav', 'sword-clash-light.wav', 1.0),
    ('364530__christopherderp__swords-clash-high-quality-2.wav', 'sword-clash-heavy.wav', 1.25),
    ('507466__danjocross__clean-fast-swoosh.aiff', 'sword-swish-dry.wav', .2),
]
for original, name, duration in sources:
    endian='little'
    if original.endswith('.aiff'):
        data=(downloads/original).read_bytes(); chunks={}; cursor=12
        if data[:4]!=b'FORM' or data[8:12]!=b'AIFF': raise ValueError('Expected uncompressed AIFF')
        while cursor+8<=len(data):
            key=data[cursor:cursor+4]; size=int.from_bytes(data[cursor+4:cursor+8],'big')
            chunks[key]=data[cursor+8:cursor+8+size];cursor+=8+size+(size%2)
        comm=chunks[b'COMM'];channels=int.from_bytes(comm[:2],'big');width=int.from_bytes(comm[6:8],'big')//8
        rate=round(int.from_bytes(comm[10:18],'big')*2**((int.from_bytes(comm[8:10],'big')&0x7fff)-16383-63))
        sound=chunks[b'SSND'];offset=int.from_bytes(sound[:4],'big');raw=sound[8+offset:];endian='big'
    else:
        with wave.open(str(downloads / original), 'rb') as source:
            channels, width, rate = source.getnchannels(), source.getsampwidth(), source.getframerate()
            raw = source.readframes(source.getnframes())
    if width not in (2, 3):
        raise ValueError(f'Unsupported PCM width: {width}')
    decoded = [int.from_bytes(raw[i:i+width], endian, signed=True) / (1 << (8*width-1)) for i in range(0, len(raw), width)]
    samples = [sum(decoded[i:i+channels])/channels for i in range(0, len(decoded), channels)]
    peak = max(map(abs, samples))
    if 'swish' in name:
        center = max(range(len(samples)), key=lambda i: abs(samples[i]))
        start = max(0, center-int(rate*.07))
    else:
        start = max(0, next(i for i,x in enumerate(samples) if abs(x)>peak*.055)-int(rate*.003))
    samples = samples[start:start+int(rate*duration)]
    gain = .8 / max(map(abs, samples))
    fade = min(int(rate*.025), len(samples)//4)
    for i in range(fade): samples[-1-i] *= i/fade
    pcm = array.array('h', (round(max(-1, min(1, x*gain))*32767) for x in samples))
    if sys.byteorder != 'little': pcm.byteswap()
    with wave.open(str(output / name), 'wb') as target:
        target.setparams((1, 2, rate, len(pcm), 'NONE', 'not compressed'))
        target.writeframes(pcm.tobytes())
    print(f'{name}: {len(pcm)/rate:.3f}s, {(output/name).stat().st_size:,} bytes')
