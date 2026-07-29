import urllib.request
import json
import re

url = 'https://op.gg/palworld/skills/passive'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    # Save full html for regex analysis
    with open('opgg_page.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Saved opgg_page.html, size:", len(html))
except Exception as e:
    print("Error:", e)
