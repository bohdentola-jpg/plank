#!/usr/bin/env python3
"""Contact sheets for a shotlog run: qa/<prefix>/index.json → qa/<prefix>/sheet_N.jpg
   python3 coldboot/tools/contact.py <prefix> [cols=4] [rows=4]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
prefix = sys.argv[1]
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
rows = int(sys.argv[3]) if len(sys.argv) > 3 else 4
d = os.path.join(ROOT, 'qa', prefix)
idx = json.load(open(os.path.join(d, 'index.json')))['index']
TW, TH, CAP = 480, 270, 34
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except OSError:
    font = ImageFont.load_default()
per = cols * rows
for s in range(0, len(idx), per):
    sheet = Image.new('RGB', (cols * TW, rows * (TH + CAP)), (16, 16, 16))
    dr = ImageDraw.Draw(sheet)
    for i, e in enumerate(idx[s:s + per]):
        x, y = (i % cols) * TW, (i // cols) * (TH + CAP)
        try:
            im = Image.open(os.path.join(d, e['file'])).resize((TW, TH))
            sheet.paste(im, (x, y))
        except OSError:
            pass
        line = e.get('line') or {}
        cap = f"#{e['n']} {e.get('screen') or ''} d{e.get('day') or '-'} dof={e.get('dof')}"
        cap2 = (f"{line.get('who', '')}: {line.get('en', '')}" if line else (e.get('obj') or ''))[:70]
        dr.text((x + 4, y + TH + 2), cap, fill=(230, 200, 120), font=font)
        dr.text((x + 4, y + TH + 17), cap2, fill=(220, 220, 220), font=font)
    out = os.path.join(d, f'sheet_{s // per + 1}.jpg')
    sheet.save(out, quality=82)
    print(out)
