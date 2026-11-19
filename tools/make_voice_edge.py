#!/usr/bin/env python3
"""Renders every story line to public/voice/{hi,en}/<id>.ogg with Microsoft neural voices (edge-tts).
Hindi lines go through tools/lexicon.txt (Roman Hinglish -> Devanagari). One distinct voice per character.
Usage: python3 tools/make_voice_edge.py [--force] [--who Uncle]"""
import asyncio, json, os, re, subprocess, sys, edge_tts
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); os.chdir(ROOT)
FORCE = '--force' in sys.argv
ONLY = sys.argv[sys.argv.index('--who') + 1] if '--who' in sys.argv else None
L = json.load(open('public/voice/lines.json'))
EXTRA = {'awaaz_1': ('Awaaz', 'Yahan kya kar rahe ho?', 'What are you doing here?'),
         'awaaz_2': ('Awaaz', 'Nishaan... Nishaant...', 'Nishan... Nishant...'),
         'awaaz_3': ('Awaaz', 'Bhai... rasta kho gaya hoon.', 'Brother... I have lost my way.')}
for k, (w, h, e) in EXTRA.items(): L.setdefault(k, {'who': w, 'hi': h, 'en': e, 'src': 'extra'})
lex = {}
for tok in open('tools/lexicon.txt', encoding='utf8').read().split():
    a, b = tok.split('='); lex[a] = b
def dev(t):
    t = re.sub(r'\([^)]*\)\s*', '', t).replace('’', "'")
    t = re.sub(r"[A-Za-z]+", lambda m: lex.get(m.group(0).lower(), m.group(0).lower()), t)
    t = re.sub(r'\.\.\.', '…', t).replace('—', ', ')   # keep acting beats; do not flatten them
    t = re.sub(r'(?<=[\u0900-\u097F])\.(?=\s|$)', '।', t)
    return t.strip()
def en_clean(t): return re.sub(r'\([^)]*\)\s*', '', t).replace('—', ', ').replace('...', '…').strip()

# TTS-only acting pass. Subtitles and line hashes keep the story text; only the
# spoken text gets pauses, beats and emphasis so the delivery sounds performed
# instead of read flat. Applied before Hinglish -> Devanagari conversion.
_STARTERS = (r'(Haan|Ha|Nahi|Na|Bas|Theek hai|Achha|Arre|Oye|Bhai|Chal|Dekh|Sun|Uncle|Chacha|Mummy|'
             r'Yes|Yeah|No|Okay|Alright|Look|Listen|Come on|Wait|Well|So|But|And|Now)')
def act(t):
    t = re.sub(r'\s+', ' ', t.strip()).replace('’', "'").replace('...', '…')
    # a short opening acknowledgement gets a breath, not a clipped stop
    t = re.sub(r'^' + _STARTERS + r'\.\s+', r'\1… ', t)
    t = re.sub(r'^' + _STARTERS + r'\s+', r'\1, ', t)
    # a hard stop between two very short clauses reads like a list; soften it
    t = re.sub(r'(?<=[a-z])\. (?=[A-Z][a-z]{1,6}\b)', ', ', t)
    # short standalone lines land with a breath instead of a robot-full-stop
    if len(t) < 26 and not any(c in t for c in '?!…'):
        t = t.rstrip('.') + '…'
    return t.strip()

# punctuation-driven prosody: questions lift, exclamations push, beats slow down
def tune(text, rate, pitch):
    r = int(rate.replace('%', '')); q = int(pitch.replace('Hz', ''))
    if '!' in text: q += 8; r += 4
    if '…' in text: r -= 7; q -= 3
    if '?' in text: r -= 3; q += 5
    if len(text) < 22: r -= 4
    return f'{r:+d}%', f'{q:+d}Hz'
# who -> (hindi voice, hi rate, hi pitch, english voice, en rate, en pitch)
V = {
 'Nishan':   ('hi-IN-MadhurNeural',            '+0%',  '+0Hz',  'en-IN-PrabhatNeural',   '+0%',  '+0Hz'),
 'Nishant':  ('en-US-BrianMultilingualNeural', '+0%',  '+0Hz',  'en-US-BrianNeural',     '+2%',  '+0Hz'),
 'Uncle':    ('en-AU-WilliamMultilingualNeural','-12%','-14Hz', 'en-IN-PrabhatNeural',   '-14%', '-22Hz'),
 'Mummy':    ('hi-IN-SwaraNeural',             '-4%',  '+0Hz',  'en-IN-NeerjaNeural',    '-4%',  '+0Hz'),
 'Padosi':   ('en-AU-WilliamMultilingualNeural','-4%', '-6Hz',  'en-GB-ThomasNeural',    '-4%',  '-6Hz'),
 'Awaaz':    ('hi-IN-MadhurNeural',            '-18%', '-26Hz', 'en-GB-RyanNeural',      '-18%', '-24Hz'),
 'Dost':     ('en-US-BrianMultilingualNeural', '-6%',  '-8Hz',  'en-US-GuyNeural',       '-4%',  '-6Hz'),
 'Ghar waala':('en-AU-WilliamMultilingualNeural','-8%','-10Hz', 'en-IN-PrabhatNeural',   '-8%',  '-14Hz'),
 'Chacha':   ('en-AU-WilliamMultilingualNeural','-10%','-14Hz', 'en-IN-PrabhatNeural',   '-10%', '-16Hz'),
 'Ajnabi':   ('en-US-BrianMultilingualNeural', '-8%',  '-12Hz', 'en-US-ChristopherNeural','-6%',  '-8Hz'),
 'Chaiwala': ('hi-IN-MadhurNeural',            '-2%',  '-8Hz',  'en-IN-PrabhatNeural',   '-2%',  '-6Hz'),
}
DEF = V['Nishant']
os.makedirs('public/voice/hi', exist_ok=True); os.makedirs('public/voice/en', exist_ok=True); os.makedirs('/tmp/vo', exist_ok=True)
def post(mp3, ogg, whisper):
    f = []
    if whisper: f += ['highpass=f=380', 'lowpass=f=5200', 'volume=0.6', 'aecho=0.8:0.55:35:0.12']
    f += ['silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05', 'areverse',
          'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08', 'areverse',
          'loudnorm=I=-17:TP=-2:LRA=9', 'apad=pad_dur=0.12']
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-af', ','.join(f), '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '5', ogg], check=True)
def dur(ogg): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ogg]).decode().strip())
sem = asyncio.Semaphore(4)
async def one(k, l, lang, voice, rate, pitch, text, whisper):
    ogg = f'public/voice/{lang}/{k}.ogg'
    if os.path.exists(ogg) and not FORCE:
        l['d_' + lang] = round(dur(ogg), 2); return 0
    if not text.strip(' ,.'): l.pop('d_' + lang, None); return 0
    if whisper: rate = f'{int(rate[:-1]) - 10:+d}%'
    rate, pitch = tune(text, rate, pitch)
    mp3 = f'/tmp/vo/{lang}_{k}.mp3'
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(mp3); break
            except Exception as e:
                if attempt == 3: print('SKIP', k, lang, text[:40], str(e)[:60], flush=True); l.pop('d_' + lang, None); return 0
                await asyncio.sleep(1.5 * (attempt + 1))
    post(mp3, ogg, whisper); os.remove(mp3); l['d_' + lang] = round(dur(ogg), 2); return 1
async def main():
    jobs = []
    for k, l in L.items():
        if ONLY and l['who'] != ONLY: continue
        hv, hr, hp, ev, er, ep = V.get(l['who'], DEF)
        whisper = bool(re.search(r'\((fusfusakar|whisper)', l['hi'], re.I)) or l['en'].lower().startswith('(whisper')
        en_txt = en_clean(act(l['en']))
        if not en_txt.strip(' ,.…') and l['who'] == 'Awaaz': en_txt = dev(act(l['hi'])); ev = hv  # stage-direction-only English: speak the called words
        jobs.append(one(k, l, 'hi', hv, hr, hp, dev(act(l['hi'])), whisper)); jobs.append(one(k, l, 'en', ev, er, ep, en_txt, whisper))
    r = await asyncio.gather(*jobs); print('rendered', sum(r), 'clips of', len(jobs))
asyncio.run(main())
json.dump(L, open('public/voice/lines.json', 'w'), ensure_ascii=False, indent=1)
