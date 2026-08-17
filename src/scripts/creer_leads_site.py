# creer_leads_site.py — crée la liste « Leads site » dans le site RH.
# ─────────────────────────────────────────────────────────────────────────────
# Cible des formulaires publics du site vitrine (voir docs/Leads-site-vitrine.md
# et api/src/functions/lead.js). À lancer UNE fois quand l'accès Microsoft est
# rétabli — idempotent : si la liste existe déjà, seules les colonnes
# manquantes sont ajoutées.
#
# Prérequis : l'app Graph app-only du tenant (permission Sites.Manage.All —
# la création de listes exige Manage, pas seulement ReadWrite ; voir la
# synthèse du 16/08).
#
# Utilisation (invite interactive pour toute valeur absente) :
#   python creer_leads_site.py
# ou tout par variables d'environnement :
#   GRAPH_TENANT_ID=… GRAPH_CLIENT_ID=… GRAPH_CLIENT_SECRET=… RH_SITE_ID=… \
#     python creer_leads_site.py
#
# Valeurs du tenant Osmose (registre de la synthèse du 16/08) :
#   GRAPH_TENANT_ID  5dc184d2-699a-4051-9f46-d040bc141669
#   GRAPH_CLIENT_ID  be0f7e69-1192-4582-a3f7-984fae4ff145
#   RH_SITE_ID       osmoserh83.sharepoint.com,ac8bcc33-…,e2c157a4-…
# ─────────────────────────────────────────────────────────────────────────────

import json
import os
import sys
import urllib.parse
import urllib.request

NOM_LISTE = "Leads site"  # displayName EXACT — l'API la résout par ce nom

# Noms internes SANS accent (figés à la création — piège connu).
COLONNES = [
    {"name": "Prenom", "text": {}},
    {"name": "Nom", "text": {}},
    {"name": "Email", "text": {}},
    {"name": "Entreprise", "text": {}},
    {"name": "Effectif", "text": {}},
    {"name": "Sujet", "text": {}},
    {"name": "Message", "text": {"allowMultipleLines": True, "textType": "plain"}},
    {"name": "Formulaire", "text": {}},
    {"name": "PageOrigine", "text": {}},
    {
        "name": "Statut",
        "choice": {"allowTextEntry": False, "choices": ["Nouveau", "Contacté", "Clos"], "displayAs": "dropDownMenu"},
        "defaultValue": {"value": "Nouveau"},
    },
]


def valeur(nom, secret=False):
    v = os.environ.get(nom, "").strip()
    if v:
        return v
    if secret:
        import getpass
        return getpass.getpass(f"{nom} : ").strip()
    return input(f"{nom} : ").strip()


def requete(methode, url, jeton=None, corps=None, formulaire=None):
    donnees = None
    entetes = {}
    if formulaire is not None:
        donnees = urllib.parse.urlencode(formulaire).encode()
        entetes["Content-Type"] = "application/x-www-form-urlencoded"
    elif corps is not None:
        donnees = json.dumps(corps).encode()
        entetes["Content-Type"] = "application/json"
    if jeton:
        entetes["Authorization"] = f"Bearer {jeton}"
    req = urllib.request.Request(url, data=donnees, headers=entetes, method=methode)
    try:
        with urllib.request.urlopen(req) as r:
            texte = r.read().decode()
            return r.status, json.loads(texte) if texte else {}
    except urllib.error.HTTPError as e:
        texte = e.read().decode()
        try:
            return e.code, json.loads(texte)
        except json.JSONDecodeError:
            return e.code, {"brut": texte[:400]}


def main():
    tenant = valeur("GRAPH_TENANT_ID")
    client = valeur("GRAPH_CLIENT_ID")
    secret = valeur("GRAPH_CLIENT_SECRET", secret=True)
    site = valeur("RH_SITE_ID")

    print("\n1. Jeton Graph…")
    statut, rep = requete(
        "POST",
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        formulaire={
            "grant_type": "client_credentials",
            "client_id": client,
            "client_secret": secret,
            "scope": "https://graph.microsoft.com/.default",
        },
    )
    if statut != 200:
        sys.exit(f"   ÉCHEC du jeton ({statut}) : {rep}")
    jeton = rep["access_token"]
    print("   ok")

    print("2. Listes du site…")
    listes = {}
    url = f"https://graph.microsoft.com/v1.0/sites/{site}/lists?$select=id,displayName"
    while url:
        statut, rep = requete("GET", url, jeton)
        if statut != 200:
            sys.exit(f"   ÉCHEC de lecture ({statut}) : {rep}\n"
                     "   (rappel : une réponse vide peut aussi signaler une permission manquante)")
        for l in rep.get("value", []):
            listes[l["displayName"]] = l["id"]
        url = rep.get("@odata.nextLink")
    print(f"   {len(listes)} listes trouvées")

    if NOM_LISTE not in listes:
        print(f"3. Création de « {NOM_LISTE} »…")
        statut, rep = requete(
            "POST",
            f"https://graph.microsoft.com/v1.0/sites/{site}/lists",
            jeton,
            corps={"displayName": NOM_LISTE, "list": {"template": "genericList"}, "columns": COLONNES},
        )
        if statut not in (200, 201):
            sys.exit(f"   ÉCHEC ({statut}) : {rep}\n"
                     "   (403 → il manque probablement Sites.Manage.All à l'app Graph)")
        liste_id = rep["id"]
        print("   créée")
    else:
        liste_id = listes[NOM_LISTE]
        print(f"3. « {NOM_LISTE} » existe déjà — vérification des colonnes…")
        statut, rep = requete(
            "GET",
            f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns?$select=name",
            jeton,
        )
        if statut != 200:
            sys.exit(f"   ÉCHEC de lecture des colonnes ({statut}) : {rep}")
        existantes = {c["name"] for c in rep.get("value", [])}
        for col in COLONNES:
            if col["name"] in existantes:
                continue
            statut, rep = requete(
                "POST",
                f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns",
                jeton,
                corps=col,
            )
            if statut not in (200, 201):
                sys.exit(f"   ÉCHEC sur la colonne {col['name']} ({statut}) : {rep}")
            print(f"   colonne ajoutée : {col['name']}")

    print("4. Contrôle final…")
    statut, rep = requete(
        "GET",
        f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns?$select=name",
        jeton,
    )
    noms = {c["name"] for c in rep.get("value", [])}
    manquantes = [c["name"] for c in COLONNES if c["name"] not in noms]
    if manquantes:
        sys.exit(f"   colonnes manquantes : {manquantes}")
    print(f"   toutes les colonnes sont en place ({', '.join(c['name'] for c in COLONNES)})")

    print(f"""
Terminé. Reste à faire (2 min, dans Power Automate) :
  flux « Lorsqu'un élément est créé » sur « {NOM_LISTE} »
  → Envoyer un e-mail (V2) à lgohebel@osmoserh.fr
  (l'AR au prospect attendra la fusion des deux SPF de osmoserh.fr)
""")


if __name__ == "__main__":
    main()
