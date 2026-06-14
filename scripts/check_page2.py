"""Check page 2 of fruits & vegetables for broken images."""
import csv
import urllib.request
from pathlib import Path

csv_path = Path(__file__).resolve().parents[1] / "NowCart_5000.csv"
fruits_veg = []
with open(csv_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row["Category"] == "fruits vegetables":
            fruits_veg.append(row)

print(f"Total fruits & vegetables: {len(fruits_veg)}")
# Page 2 = items 21-40 (20 per page)
print(f"\nPage 2 products (items 21-40):")
for i, row in enumerate(fruits_veg[20:40], start=21):
    img = row["image_small"]
    name = row["Product"]
    # Check the URL
    try:
        req = urllib.request.Request(img, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0")
        resp = urllib.request.urlopen(req, timeout=8)
        status = f"{resp.status} OK"
    except Exception as e:
        status = f"BROKEN ({e})"
    print(f"  {i}. {name[:50]}")
    print(f"     {status} | {img[:80]}")
