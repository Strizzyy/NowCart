"""Find products whose images are BigBasket's placeholder (3278 bytes)."""
import csv
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

csv_path = Path(__file__).resolve().parents[1] / "NowCart_5000.csv"

# First, check what the 3278 byte "image" looks like
print("Checking placeholder size threshold...")
placeholder_url = "https://www.bigbasket.com/media/uploads/p/s/40019777_3-fresho-grapes-red-globe-indian.jpg"
req = urllib.request.Request(placeholder_url)
req.add_header("User-Agent", "Mozilla/5.0")
resp = urllib.request.urlopen(req, timeout=10)
placeholder_data = resp.read()
placeholder_size = len(placeholder_data)
print(f"Placeholder image size: {placeholder_size} bytes")

# Now scan fruits & vegetables category for images that are this same size
fruits_veg = []
with open(csv_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row["Category"] == "fruits vegetables":
            fruits_veg.append(row)

print(f"\nChecking {len(fruits_veg)} fruits & vegetables products...")
print("(Looking for images with size <= {placeholder_size} bytes)\n")


def check_size(row):
    url = row["image_small"]
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        resp = urllib.request.urlopen(req, timeout=8)
        size = int(resp.headers.get("Content-Length", 0))
        return row, size
    except Exception:
        return row, -1


# Check first 60 products (pages 1-3)
results = []
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(check_size, row): row for row in fruits_veg[:60]}
    for future in as_completed(futures):
        row, size = future.result()
        results.append((row, size))

# Sort by original order
row_order = {id(row): i for i, row in enumerate(fruits_veg[:60])}
results.sort(key=lambda x: row_order.get(id(x[0]), 999))

placeholder_products = []
for row, size in results:
    idx = fruits_veg.index(row) + 1
    if size == placeholder_size:
        placeholder_products.append(row)
        print(f"  #{idx} PLACEHOLDER: {row['Product'][:50]} ({size} bytes)")

print(f"\nFound {len(placeholder_products)} products with placeholder images in first 60")
