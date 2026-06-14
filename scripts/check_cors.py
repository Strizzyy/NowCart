"""Check if BigBasket images have CORS issues or redirect to error pages."""
import urllib.request
from pathlib import Path

urls = [
    ("Grapes - Red Globe Indian", "https://www.bigbasket.com/media/uploads/p/s/40019777_3-fresho-grapes-red-globe-indian.jpg"),
    ("Tomato - Cherry", "https://www.bigbasket.com/media/uploads/p/s/10000198_10-fresho-tomato-cherry.jpg"),
    # Control: one that definitely shows
    ("Carrot - Orange", "https://www.bigbasket.com/media/uploads/p/s/10000071_14-fresho-carrot-orange.jpg"),
]

for name, url in urls:
    print(f"\n{name}: {url}")
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        req.add_header("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
        resp = urllib.request.urlopen(req, timeout=10)
        print(f"  Status: {resp.status}")
        print(f"  Content-Type: {resp.headers.get('Content-Type')}")
        print(f"  Content-Length: {resp.headers.get('Content-Length')}")
        print(f"  Access-Control-Allow-Origin: {resp.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        # Read first few bytes to check if it's actually an image
        data = resp.read(16)
        # JPEG starts with FF D8 FF, PNG with 89 50 4E 47
        if data[:2] == b'\xff\xd8':
            print("  Content: JPEG image ✓")
        elif data[:4] == b'\x89PNG':
            print("  Content: PNG image ✓")
        elif data[:4] == b'RIFF':
            print("  Content: WebP image ✓")
        else:
            print(f"  Content: Unknown ({data[:10]})")
    except Exception as e:
        print(f"  ERROR: {e}")
