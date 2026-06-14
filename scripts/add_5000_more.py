"""
Add 5000 more products with verified working images to NowCart_5000.csv,
bringing the total to 10000. Only adds products not already in the CSV.
Verifies images are real (not BigBasket's 6434-byte placeholder).
"""
import csv
import math
import random
import urllib.request
import openpyxl
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

PLACEHOLDER_SIZE = 6434
TARGET_NEW = 5000
random.seed(123)

csv_path = Path(__file__).resolve().parents[1] / "NowCart_5000.csv"
xlsx_path = Path(__file__).resolve().parents[1] / "BigBasket.xlsx"

# Load existing products from CSV to avoid duplicates
print("Loading existing CSV...")
existing_rows = []
existing_products = set()
with open(csv_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames
    for row in reader:
        existing_rows.append(row)
        existing_products.add(row["Product"].strip())

print(f"Existing products: {len(existing_rows)}")

# Load all candidates from BigBasket.xlsx that aren't in the CSV
print("Loading BigBasket.xlsx for new candidates...")
wb = openpyxl.load_workbook(xlsx_path, read_only=True)
ws = wb.active

candidates_by_cat = defaultdict(list)
for row in ws.iter_rows(min_row=2, values_only=True):
    name = str(row[2]).strip() if row[2] else ""
    cat = str(row[6]).strip() if row[6] else ""
    img = str(row[8]).strip() if row[8] else ""

    if not name or not cat or not img.startswith("http"):
        continue
    if name in existing_products:
        continue

    candidates_by_cat[cat].append(row)

wb.close()

total_candidates = sum(len(v) for v in candidates_by_cat.values())
print(f"New candidates available: {total_candidates}")
print("By category:")
cats = sorted(candidates_by_cat.keys())
for cat in cats:
    print(f"  {cat}: {len(candidates_by_cat[cat])}")

# We need to verify images. With ~70% pass rate and placeholder filtering,
# let's take a larger pool and verify.
# Proportional allocation for the pool
POOL_MULTIPLIER = 1.8  # Take 1.8x what we need to account for bad images
pool_per_cat = {}
for cat in cats:
    proportion = len(candidates_by_cat[cat]) / total_candidates
    target = int(math.ceil(proportion * TARGET_NEW * POOL_MULTIPLIER))
    pool_per_cat[cat] = min(target, len(candidates_by_cat[cat]))

# Sample candidates
candidate_pool = []
for cat in cats:
    pool = candidates_by_cat[cat]
    n = pool_per_cat[cat]
    if n >= len(pool):
        candidate_pool.extend([(row, cat) for row in pool])
    else:
        candidate_pool.extend([(row, cat) for row in random.sample(pool, n)])

random.shuffle(candidate_pool)
print(f"\nCandidate pool size: {len(candidate_pool)}")


def verify_image(item):
    """Verify image is real (not placeholder, not broken)."""
    row, cat = item
    url = str(row[8]).strip()
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        resp = urllib.request.urlopen(req, timeout=8)
        size = int(resp.headers.get("Content-Length", 0))
        if size == 0:
            data = resp.read()
            size = len(data)
        if size > 0 and size != PLACEHOLDER_SIZE:
            return (row, cat, True)
        return (row, cat, False)
    except Exception:
        return (row, cat, False)


# Verify images in batches
print("Verifying images (this will take a few minutes)...")
verified_by_cat = defaultdict(list)
total_checked = 0
total_passed = 0
total_failed = 0

BATCH_SIZE = 100
MAX_WORKERS = 20

for batch_start in range(0, len(candidate_pool), BATCH_SIZE):
    # Check if we have enough
    current_total = sum(len(v) for v in verified_by_cat.values())
    if current_total >= TARGET_NEW + 100:
        break

    batch = candidate_pool[batch_start:batch_start + BATCH_SIZE]

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(verify_image, item) for item in batch]
        for future in as_completed(futures):
            row, cat, passed = future.result()
            total_checked += 1
            if passed:
                total_passed += 1
                verified_by_cat[cat].append(row)
            else:
                total_failed += 1

    current_total = sum(len(v) for v in verified_by_cat.values())
    print(f"  Checked: {total_checked}, Passed: {total_passed}, Failed: {total_failed}, Pool: {current_total}")

verified_total = sum(len(v) for v in verified_by_cat.values())
print(f"\nVerification done: {total_passed}/{total_checked} passed ({total_passed*100//max(total_checked,1)}%)")
print(f"Verified pool: {verified_total}")

if verified_total < TARGET_NEW:
    print(f"WARNING: Only {verified_total} verified, adjusting target")
    actual_target = verified_total
else:
    actual_target = TARGET_NEW

# Proportional allocation from verified
allocation = {}
for cat in cats:
    if not verified_by_cat[cat]:
        allocation[cat] = 0
        continue
    proportion = len(verified_by_cat[cat]) / verified_total
    allocation[cat] = min(int(math.ceil(proportion * actual_target)), len(verified_by_cat[cat]))

# Adjust to exactly actual_target
current = sum(allocation.values())
if current > actual_target:
    diff = current - actual_target
    for cat in sorted(cats, key=lambda c: allocation.get(c, 0), reverse=True):
        if diff <= 0:
            break
        reduce = min(diff, max(allocation.get(cat, 0) - 1, 0))
        allocation[cat] -= reduce
        diff -= reduce
elif current < actual_target:
    diff = actual_target - current
    for cat in sorted(cats, key=lambda c: len(verified_by_cat.get(c, [])) - allocation.get(c, 0), reverse=True):
        if diff <= 0:
            break
        available = len(verified_by_cat.get(cat, [])) - allocation.get(cat, 0)
        add = min(diff, max(available, 0))
        allocation[cat] += add
        diff -= add

new_total = sum(allocation.values())
print(f"\nNew allocation (total={new_total}):")
for cat in cats:
    print(f"  {cat}: {allocation.get(cat, 0)}")

# Select new products
new_rows = []
for cat in cats:
    pool = verified_by_cat.get(cat, [])
    n = allocation.get(cat, 0)
    if n <= 0:
        continue
    if n >= len(pool):
        new_rows.extend(pool)
    else:
        new_rows.extend(random.sample(pool, n))

random.shuffle(new_rows)
print(f"\nNew products selected: {len(new_rows)}")

# Append to CSV
start_index = len(existing_rows) + 1
print(f"Appending to {csv_path.name} (starting at index {start_index})...")

with open(csv_path, "a", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    for i, row in enumerate(new_rows, start=start_index):
        writer.writerow({
            "index": str(i),
            "Brand": str(row[1]).strip() if row[1] else "",
            "Product": str(row[2]).strip() if row[2] else "",
            "Quantity": str(row[3]).strip() if row[3] else "",
            "Price": str(row[4]).strip() if row[4] else "",
            "MRP": str(row[5]).strip() if row[5] else "",
            "Category": str(row[6]).strip() if row[6] else "",
            "Sub-Category": str(row[7]).strip() if row[7] else "",
            "image_small": str(row[8]).strip() if row[8] else "",
        })

# Verify final count
with open(csv_path, encoding="utf-8") as f:
    reader = csv.reader(f)
    next(reader)  # skip header
    final_count = sum(1 for _ in reader)

print(f"\nDone! CSV now has {final_count} total products.")
print(f"  Previously: {len(existing_rows)}")
print(f"  Added: {len(new_rows)}")

# Final category breakdown
print("\nFinal category breakdown (new additions):")
cat_counts = defaultdict(int)
for row in new_rows:
    cat_counts[str(row[6]).strip()] += 1
for cat in sorted(cat_counts.keys()):
    print(f"  {cat}: {cat_counts[cat]}")
