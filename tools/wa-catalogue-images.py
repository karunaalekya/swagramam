#!/usr/bin/env python3
"""Makes the JPG photos for the WhatsApp catalogue from the site's own dish photos.
   python3 tools/wa-catalogue-images.py whatsapp-catalogue.csv wa-photos
Reads image_file_name and source_photo from the CSV. Writes square 1024 px JPGs (WhatsApp shows items square), quality 88, sRGB.
Items with no source photo are skipped and listed (WhatsApp needs a photo per item)."""
import csv, sys
from pathlib import Path
from PIL import Image

csv_path, out = Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else "wa-photos")
root = Path(__file__).resolve().parents[1]
out.mkdir(parents=True, exist_ok=True)
made, missing = 0, []
for row in csv.DictReader(open(csv_path, encoding="utf-8")):
    src, name = row.get("source_photo", ""), row.get("image_file_name", "")
    if not src or not name:
        missing.append(row["name"]); continue
    im = Image.open(root / src).convert("RGB")
    s = min(im.size); left, top = (im.width - s) // 2, (im.height - s) // 2
    im = im.crop((left, top, left + s, top + s)).resize((1024, 1024), Image.LANCZOS)
    im.save(out / name, "JPEG", quality=88, optimize=True, progressive=True); made += 1
print(f"photos written: {made} in {out}/")
print(f"needs a real photo first ({len(missing)}): " + ", ".join(missing))
