
#!/usr/bin/env python3
import json, sys, os

if len(sys.argv) < 6:
    print("Usage: add_tenant.py CLIENT_CODE DISPLAY_NAME SITE_HOST SITE_PATH BRAND_NAME")
    sys.exit(1)

client, display, host, path, brand = sys.argv[1:6]
base = os.path.dirname(os.path.dirname(__file__))
file = os.path.join(base, 'tenants.json')
with open(file, 'r', encoding='utf-8') as f:
    data = json.load(f)

data[client] = {
  "displayName": display,
  "branding": {"name": brand, "logoUrl": "", "colors": {"primary":"#6a5cff","bg":"#0b1020","text":"#e9ecff"}},
  "sharepoint": {
    "siteHost": host,
    "sitePath": path,
    "lists": {"contracts": "Contrats", "ideas": "BoiteIdees", "dpae": "DPAE"},
    "libraries": {"contracts": "Contrats"}
  }
}

with open(file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f"Added/updated tenant {client}")
