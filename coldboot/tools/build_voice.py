#!/usr/bin/env python3
"""Render every voiced line in COLD BOOT to assets/vo/<id>.ogg.

  python3 build_voice.py --models <dir with *.onnx + silero/v4_ru.pt> [--qa] [--only prefix] [--force]

Reads the lines via `node tools/export_lines.mjs`, the casting from
tools/voices.json. Russian lines use Silero v4 (models.silero.ai); English
lines use Piper (rhasspy/piper-voices). Each take is pitch/tempo-shaped with
rubberband (formants kept), trimmed, high-passed, loudness-normalised and
encoded as mono Opus. assets/vo/manifest.json records a hash of text+voice
(unchanged lines are skipped) and each line's duration for the game.
--qa transcribes every take with Whisper and lists lines that came out wrong.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
VO = os.path.join(ROOT, 'assets', 'vo')

ap = argparse.ArgumentParser()
ap.add_argument('--models', required=True)
ap.add_argument('--qa', action='store_true')
ap.add_argument('--only', default='')
ap.add_argument('--force', action='store_true')
args = ap.parse_args()

lines = json.loads(subprocess.run(['node', os.path.join(HERE, 'export_lines.mjs')], capture_output=True, text=True, check=True).stdout)
voices = json.load(open(os.path.join(HERE, 'voices.json')))
os.makedirs(VO, exist_ok=True)
man_path = os.path.join(VO, 'manifest.json')
manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}

_silero = None
_piper = {}


def silero():
    global _silero
    if _silero is None:
        import torch
        torch.set_num_threads(4)
        _silero = torch.package.PackageImporter(os.path.join(args.models, 'silero', 'v4_ru.pt')).load_pickle('tts_models', 'model')
        _silero.to('cpu')
    return _silero


def piper(name):
    if name not in _piper:
        from piper import PiperVoice
        _piper[name] = PiperVoice.load(os.path.join(args.models, 'voices', name + '.onnx'))
    return _piper[name]


def clean_ru(t):
    t = t.replace('«', '').replace('»', '').replace('…', '... ').replace(' — ', ', ').replace('—', ', ')
    return re.sub(r'\s+', ' ', t).strip(' .,') + ('.' if not re.search(r'[.!?]$', t.strip()) else '')


def clean_en(t):
    t = t.replace('—', ', ').replace('…', '... ')
    return re.sub(r'\s+', ' ', t).strip()


def synth(L, v, path):
    if v['engine'] == 'silero':
        m = silero()
        audio = m.apply_tts(text=clean_ru(L['text']), speaker=v['speaker'], sample_rate=48000, put_accent=True, put_yo=True)
        a = (np.clip(audio.numpy(), -1, 1) * 32767).astype(np.int16)
        sr = 48000
    else:
        from piper.config import SynthesisConfig
        vc = piper(v['model'])
        cfg = SynthesisConfig(speaker_id=v.get('speaker')) if v.get('speaker') is not None else SynthesisConfig()
        text = clean_ru(L['text']) if L['lang'] == 'ru' else clean_en(L['text'])
        chunks = list(vc.synthesize(text, syn_config=cfg))
        a = np.concatenate([c.audio_int16_array for c in chunks])
        sr = chunks[0].sample_rate
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(a.tobytes())


def shape(src, dst, v):
    filt = []
    pitch = v.get('pitch', 0.0)
    tempo = v.get('tempo', 1.0)
    if abs(pitch) > 0.01 or abs(tempo - 1) > 0.001:
        filt.append(f"rubberband=pitch={2 ** (pitch / 12):.5f}:tempo={tempo:.4f}:formant=preserved")
    filt += [
        'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05',
        'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12', 'areverse',
        'highpass=f=70', 'acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120',
        'loudnorm=I=-17:TP=-1.5:LRA=9',
        'aresample=48000',
    ]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', ','.join(filt), '-ac', '1',
                    '-c:a', 'libopus', '-b:a', '28k', '-application', 'voip', dst], check=True)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    return round(float(out.strip() or 0), 3)


todo = [L for L in lines if L['id'].startswith(args.only)]
missing_cast = sorted({L['who'] for L in todo if L['who'] not in voices})
if missing_cast:
    print('NO VOICE FOR:', ', '.join(missing_cast))
    sys.exit(1)
done = 0
with tempfile.TemporaryDirectory() as tmp:
    for L in todo:
        v = voices[L['who']]
        h = hashlib.sha1(json.dumps([L['text'], v], sort_keys=True).encode()).hexdigest()[:12]
        out = os.path.join(VO, L['id'] + '.ogg')
        if not args.force and manifest.get(L['id'], {}).get('h') == h and os.path.exists(out):
            continue
        raw = os.path.join(tmp, 'raw.wav')
        synth(L, v, raw)
        shape(raw, out, v)
        manifest[L['id']] = {'h': h, 'd': duration(out), 'who': L['who']}
        done += 1
        print(f"{L['id']:28s} {manifest[L['id']]['d']:5.2f}s  {L['text'][:70]}", flush=True)
# drop lines that no longer exist
ids = {L['id'] for L in lines}
for k in list(manifest):
    if k not in ids:
        manifest.pop(k)
        try:
            os.remove(os.path.join(VO, k + '.ogg'))
        except FileNotFoundError:
            pass
json.dump(manifest, open(man_path, 'w'), indent=0, sort_keys=True)
total = sum(os.path.getsize(os.path.join(VO, f)) for f in os.listdir(VO) if f.endswith('.ogg'))
print(f'rendered {done} new takes; {len(manifest)} lines, {sum(m["d"] for m in manifest.values())/60:.1f} min, {total/1e6:.2f} MB')

if args.qa:
    import difflib
    from faster_whisper import WhisperModel
    models = {}

    def norm(s):
        s = s.lower().replace('ё', 'е')
        return ' '.join(re.sub(r"[^a-zа-я0-9' ]+", ' ', s).split())

    bad = []
    for L in todo:
        lang = L['lang']
        if lang not in models:
            models[lang] = WhisperModel('small' if lang == 'ru' else 'small.en', device='cpu', compute_type='int8')
        raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', os.path.join(VO, L['id'] + '.ogg'), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
        a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        segs, _ = models[lang].transcribe(a, language=lang, beam_size=5)
        hyp = ' '.join(s.text for s in segs)
        sim = difflib.SequenceMatcher(None, norm(L['text']), norm(hyp)).ratio()
        if sim < 0.85:
            bad.append((sim, L['id'], L['text'], hyp.strip()))
    for sim, i, t, hyp in sorted(bad):
        print(f'QA {sim:.2f} {i}\n   want: {t}\n   heard: {hyp}')
    print(f'QA: {len(todo) - len(bad)}/{len(todo)} takes clear')
