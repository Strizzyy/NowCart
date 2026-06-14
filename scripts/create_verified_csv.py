"""
Create a verified CSV of 5000 products from BigBasket.xlsx,
distributed across all categories, with VERIFIED working image URLs.

Uses concurrent HTTP HEAD requests to check image availability.
"""
import csv
import math
import random
import urllib.request
import openpyxl
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

TARGET_TOTAL = 5000
random.seed(42)

path = Path(__file__).resolve().parents[1] / "BigBasket.xlsx"
output_path = Path(__file__).resolve().parents[1] / "NowCart_5000.csv"


def check_image_url(url: str) -> bool:
    """Check if an image URL is accessible (returns HTTP 2xx/3xx)."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        resp = urllib.request.urlopen(req, timeout=8)
        return resp.status < 400
    except Exception:
        return False


print("Loading BigBasket.xlsx...")
wb = openpyxl.load_workbook(path, read_only=True)
ws = wb.active

# Read all rows with image URLs, grouped by category
rows_by_category = defaultdict(list)

for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=1):
    name = str(row[2]).strip() if row[2] else ""
    if not name:
        continue
    
    cat = str(row[6]).strip() if row[6] else ""
    if not cat:
        continue
    
    img = str(row[8]).strip() if len(row) > 8 and row[8] else ""
    if not img or not img.startswith("http"):
        continue
    
    rows_by_category[cat].append(row)

wb.close()

total_with_images = sum(len(rows) for rows in rows_by_category.values())
print(f"Total products with image URLs: {total_with_images}")
print(f"Categories: {len(rows_by_category)}")

# We need more than 5000 candidates since some images will be broken.
# Take a larger pool (e.g., 8000) to account for ~45% breakage rate.
POOL_SIZE = 9000

# Calculate proportional pool per category
cats = sorted(rows_by_category.keys())
pool_allocation = {}
for cat in cats:
    proportion = len(rows_by_category[cat]) / total_with_images
    pool_allocation[cat] = min(int(math.ceil(proportion * POOL_SIZE)), len(rows_by_category[cat]))

print(f"\nSelecting pool of ~{sum(pool_allocation.values())} candidates...")

# Sample from each category
candidate_rows = []
for cat in cats:
    pool = rows_by_category[cat]
    n = pool_allocation[cat]
    if n >= len(pool):
        candidate_rows.extend([(row, cat) for row in pool])
    else:
        candidate_rows.extend([(row, cat) for row in random.sample(pool, n)])

random.shuffle(candidate_rows)
print(f"Candidate pool: {len(candidate_rows)} products")

# Verify image URLs concurrently
print("\nVerifying image URLs (this may take a few minutes)...")
verified_by_category = defaultdict(list)
total_checked = 0
total_working = 0
total_broken = 0

# Process in batches
BATCH_SIZE = 100
MAX_WORKERS = 20

for batch_start in range(0, len(candidate_rows), BATCH_SIZE):
    batch = candidate_rows[batch_start:batch_start + BATCH_SIZE]
    
    # Check if we already have enough
    current_verified = sum(len(v) for v in verified_by_category.values())
    if current_verified >= TARGET_TOTAL + 200:  # some buffer
        break
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {}
        for row, cat in batch:
            url = str(row[8]).strip()
            future = executor.submit(check_image_url, url)
            futures[future] = (row, cat)
        
        for future in as_completed(futures):
            row, cat = futures[future]
            total_checked += 1
            if future.result():
                total_working += 1
                verified_by_category[cat].append(row)
            else:
                total_broken += 1
    
    current_verified = sum(len(v) for v in verified_by_category.values())
    print(f"  Checked: {total_checked}, Working: {total_working}, Broken: {total_broken}, Verified pool: {current_verified}")

print(f"\nVerification complete: {total_working}/{total_checked} images working ({total_working*100//max(total_checked,1)}%)")

# Now distribute 5000 from verified products proportionally
verified_total = sum(len(v) for v in verified_by_category.values())
print(f"Total verified products available: {verified_total}")

if verified_total < TARGET_TOTAL:
    print(f"WARNING: Only {verified_total} verified products available, less than target {TARGET_TOTAL}")
    TARGET_TOTAL = verified_total

# Proportional allocation from verified pool
allocation = {}
for cat in cats:
    if cat not in verified_by_category or not verified_by_category[cat]:
        allocation[cat] = 0
        continue
    proportion = len(verified_by_category[cat]) / verified_total
    allocation[cat] = min(int(math.ceil(proportion * TARGET_TOTAL)), len(verified_by_category[cat]))

# Adjust to hit exactly TARGET_TOTAL
current_total = sum(allocation.values())
if current_total > TARGET_TOTAL:
    diff = current_total - TARGET_TOTAL
    sorted_cats = sorted(cats, key=lambda c: allocation.get(c, 0), reverse=True)
    for cat in sorted_cats:
        if diff <= 0:
            break
        reduce = min(diff, max(allocation.get(cat, 0) - 1, 0))
        allocation[cat] = allocation.get(cat, 0) - reduce
        diff -= reduce
elif current_total < TARGET_TOTAL:
    diff = TARGET_TOTAL - current_total
    sorted_cats = sorted(cats, key=lambda c: len(verified_by_category.get(c, [])) - allocation.get(c, 0), reverse=True)
    for cat in sorted_cats:
        if diff <= 0:
            break
        available = len(verified_by_category.get(cat, [])) - allocation.get(cat, 0)
        add = min(diff, max(available, 0))
        allocation[cat] = allocation.get(cat, 0) + add
        diff -= add

print(f"\nFinal allocation (total={sum(allocation.values())}):")
for cat in cats:
    print(f"  {cat}: {allocation.get(cat, 0)} / {len(verified_by_category.get(cat, []))} verified")

# Select final products
selected_rows = []
for cat in cats:
    pool = verified_by_category.get(cat, [])
    n = allocation.get(cat, 0)
    if n <= 0:
        continue
    if n >= len(pool):
        selected_rows.extend(pool)
    else:
        selected_rows.extend(random.sample(pool, n))

random.shuffle(selected_rows)
print(f"\nTotal selected: {len(selected_rows)}")

# Write CSV
headers = ["index", "Brand", "Product", "Quantity", "Price", "MRP", "Category", "Sub-Category", "image_small"]
print(f"Writing {output_path.name}...")
with open(output_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    for i, row in enumerate(selected_rows, start=1):
        writer.writerow([
            i,
            str(row[1]).strip() if row[1] else "",
            str(row[2]).strip() if row[2] else "",
            str(row[3]).strip() if row[3] else "",
            str(row[4]).strip() if row[4] else "",
            str(row[5]).strip() if row[5] else "",
            str(row[6]).strip() if row[6] else "",
            str(row[7]).strip() if row[7] else "",
            str(row[8]).strip() if row[8] else "",
        ])

print(f"\nDone! {len(selected_rows)} products with verified images written to {output_path.name}")

# Final category breakdown
print("\nFinal breakdown:")
cat_counts = defaultdict(int)
for row in selected_rows:
    cat_counts[str(row[6]).strip()] += 1
for cat in sorted(cat_counts.keys()):
    print(f"  {cat}: {cat_counts[cat]}")
