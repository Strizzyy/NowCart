"""Replace products with placeholder images (6434 bytes) with working alternatives."""
import csv
import urllib.request
import openpyxl
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

PLACEHOLDER_SIZE = 6434

csv_path = Path(__file__).resolve().parents[1] / "NowCart_5000.csv"
xlsx_path = Path(__file__).resolve().parents[1] / "BigBasket.xlsx"

# First find which products in our CSV have placeholder images in fruits & vegetables
print("Scanning CSV for placeholder images in fruits & vegetables...")
all_rows = []
placeholder_indices = []  # indices in all_rows that need replacement

with open(csv_path, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    headers = reader.fieldnames
    for i, row in enumerate(reader):
        all_rows.append(row)
        if row["Category"] == "fruits vegetables":
            if row["Product"].strip() in ["Grapes - Red Globe  Indian", "Tomato - Cherry"]:
                placeholder_indices.append(i)

print(f"Found {len(placeholder_indices)} products to replace:")
for idx in placeholder_indices:
    print(f"  Row {idx}: {all_rows[idx]['Product']}")

# Find replacement products from BigBasket.xlsx that are NOT already in our CSV
existing_products = {row["Product"].strip() for row in all_rows}

print("\nSearching BigBasket.xlsx for replacement fruits & vegetables...")
wb = openpyxl.load_workbook(xlsx_path, read_only=True)
ws = wb.active

candidates = []
for row in ws.iter_rows(min_row=2, values_only=True):
    name = str(row[2]).strip() if row[2] else ""
    cat = str(row[6]).strip() if row[6] else ""
    img = str(row[8]).strip() if row[8] else ""
    
    if cat == "fruits vegetables" and name and img.startswith("http") and name not in existing_products:
        candidates.append(row)

wb.close()
print(f"Found {len(candidates)} candidate replacements")


def check_real_image(row):
    """Check if image is a real photo (not a placeholder)."""
    url = str(row[8]).strip()
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0")
        resp = urllib.request.urlopen(req, timeout=8)
        size = int(resp.headers.get("Content-Length", 0))
        if size == 0:
            # Read to get actual size
            data = resp.read()
            size = len(data)
        return row, size
    except Exception:
        return row, -1


# Check candidates until we find 2 good replacements
print("Verifying candidate images...")
replacements = []
batch_start = 0
BATCH = 20

while len(replacements) < len(placeholder_indices) and batch_start < len(candidates):
    batch = candidates[batch_start:batch_start + BATCH]
    batch_start += BATCH
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(check_real_image, row): row for row in batch}
        for future in as_completed(futures):
            row, size = future.result()
            if size > 0 and size != PLACEHOLDER_SIZE:
                replacements.append(row)
                name = str(row[2]).strip()
                print(f"  Found: {name} ({size} bytes)")
                if len(replacements) >= len(placeholder_indices):
                    break

print(f"\nGot {len(replacements)} replacements")

# Replace in CSV
for i, idx in enumerate(placeholder_indices):
    if i >= len(replacements):
        break
    repl = replacements[i]
    old_name = all_rows[idx]["Product"]
    new_row = {
        "index": all_rows[idx]["index"],
        "Brand": str(repl[1]).strip() if repl[1] else "",
        "Product": str(repl[2]).strip() if repl[2] else "",
        "Quantity": str(repl[3]).strip() if repl[3] else "",
        "Price": str(repl[4]).strip() if repl[4] else "",
        "MRP": str(repl[5]).strip() if repl[5] else "",
        "Category": str(repl[6]).strip() if repl[6] else "",
        "Sub-Category": str(repl[7]).strip() if repl[7] else "",
        "image_small": str(repl[8]).strip() if repl[8] else "",
    }
    all_rows[idx] = new_row
    print(f"  Replaced '{old_name}' with '{new_row['Product']}'")

# Write updated CSV
print(f"\nWriting updated {csv_path.name}...")
with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writeheader()
    writer.writerows(all_rows)

print("Done!")
