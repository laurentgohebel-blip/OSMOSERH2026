#!/usr/bin/env python3
"""
Accorde un **Resource-Specific Consent** (Sites.Selected) à une application sur un **site SharePoint** précis.

Prérequis :
- Une **application admin** (CLIENT_ID_ADMIN/CLIENT_SECRET_ADMIN) avec **Sites.FullControl.All** (temporaire) pour réaliser le grant.
- Le **Site ID** cible (format composite host,siteId,webId) ou récupéré via /sites/{host}:{path}

Usage :
  python scripts/grant_rsc.py --tenant-id <TENANT>       --admin-client-id <ID> --admin-client-secret <SECRET>       --target-app-id <APP_ID> --site "{host,siteId,webId}" --role write

Rôles possibles : read | write | manage
"""
import argparse, requests, msal

parser = argparse.ArgumentParser()
parser.add_argument('--tenant-id', required=True)
parser.add_argument('--admin-client-id', required=True)
parser.add_argument('--admin-client-secret', required=True)
parser.add_argument('--target-app-id', required=True)
parser.add_argument('--site', required=True, help='site composite id (host,siteId,webId)')
parser.add_argument('--role', default='write', choices=['read','write','manage'])
args = parser.parse_args()

AUTHORITY = f"https://login.microsoftonline.com/{args.tenant_id}"
SCOPES = ["https://graph.microsoft.com/.default"]
app = msal.ConfidentialClientApplication(args.admin_client_id, authority=AUTHORITY, client_credential=args.admin_client_secret)
result = app.acquire_token_for_client(scopes=SCOPES)
if 'access_token' not in result:
    raise SystemExit(result)

token = result['access_token']
url = f"https://graph.microsoft.com/v1.0/sites/{args.site}/permissions"
body = {
  "roles": [args.role],
  "grantedToIdentities": [
    {"application": {"id": args.target_app_id}}
  ]
}
resp = requests.post(url, json=body, headers={"Authorization": f"Bearer {token}", "Content-Type":"application/json"})
print(resp.status_code, resp.text)
