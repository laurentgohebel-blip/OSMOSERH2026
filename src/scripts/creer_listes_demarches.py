# creer_listes_demarches.py — prépare les listes des démarches « standard ».
# ─────────────────────────────────────────────────────────────────────────────
# Chantier « fin du Premium » (docs/Infra-couts.md levier 1 et
# docs/Flux-standard-ACP-ATT.md) : l'API écrit directement les listes
# « Acompte » et « Demandes attestations », les flux se déclenchent
# « à la création d'un élément » (connecteur standard).
#
# À lancer UNE fois par tenant AVANT de retirer les variables FLOW_URL_*.
# Idempotent : liste absente → créée avec toutes les colonnes ;
# liste existante → seules les colonnes manquantes sont ajoutées
# (comparaison sur le nom INTERNE ; les colonnes historiques créées via
# l'interface SharePoint, comme « Montant demandé » → Montantdemand_x00e9_,
# ne sont ni touchées ni dupliquées : elles restent utilisées par l'API).
#
# Prérequis : app Graph app-only avec Sites.Manage.All (comme creer_leads_site).
#
# Utilisation (invite interactive pour toute valeur absente) :
#   python creer_listes_demarches.py
# ou : GRAPH_TENANT_ID=… GRAPH_CLIENT_ID=… GRAPH_CLIENT_SECRET=… RH_SITE_ID=… \
#        python creer_listes_demarches.py
# ─────────────────────────────────────────────────────────────────────────────

import json
import os
import sys
import urllib.parse
import urllib.request

# Noms internes SANS accent ni espace (figés à la création — piège connu).
LISTES = [
    {
        # Liste HISTORIQUE (déjà écrite par le flux HTTP actuel) : on la
        # complète des colonnes que l'API écrira en mode standard. Les
        # colonnes d'origine (Nom, Pr_x00e9_nom, Montantdemand_x00e9_,
        # Statut…) existent déjà et sont réutilisées telles quelles.
        "nom": "Acompte",
        # L'API standard écrit UNIQUEMENT ces noms canoniques — jamais les
        # internes accentués créés jadis via l'interface (Pr_x00e9_nom,
        # Montantdemand_x00e9_), qui restent en lecture pour l'historique
        # (le tableau de bord lit les deux générations).
        "colonnes": [
            {"name": "Prenom", "text": {}},
            {"name": "Montantdemande", "number": {}},
            {"name": "Matricule", "number": {}},
            {"name": "DateVersement", "dateTime": {"format": "dateOnly"}},
            {"name": "Reference", "text": {}},
            {"name": "EmailDemandeur", "text": {}},
            {"name": "EmailGestionnaire", "text": {}},
            # Avance sur salaire (26/08) : un PRÊT remboursé par retenues
            # au 1/10e (L.3251-3) — distinct de l'acompte (travail déjà
            # fait, déduit en une fois). L'échéancier est stocké en clair
            # pour le gestionnaire de paie.
            {"name": "TypeVersement", "choice": {"allowTextEntry": False,
                "choices": ["Acompte", "Avance"], "displayAs": "dropDownMenu"},
                "defaultValue": {"value": "Acompte"}},
            {"name": "NetMensuel", "number": {}},
            {"name": "Echeancier", "text": {"allowMultipleLines": True, "textType": "plain"}},
        ],
        # Colonnes supplémentaires si la liste est créée de zéro
        # (p. ex. dans le NOUVEAU tenant) :
        "colonnes_creation": [
            {"name": "CodeClient", "text": {}},
            {"name": "Nom", "text": {}},
            {
                "name": "Statut",
                "choice": {"allowTextEntry": False, "choices": ["Nouveau", "Traité"], "displayAs": "dropDownMenu"},
                "defaultValue": {"value": "Nouveau"},
            },
        ],
    },
    {
        # Liste NEUVE du circuit attestation standard (remplace le corps
        # HTTP du kit ATT-01) : chaque champ du formulaire + identité
        # employeur = une colonne → l'élément est autoportant, le flux
        # n'a AUCUNE recherche à faire.
        "nom": "Demandes attestations",
        "colonnes": [
            {"name": "Reference", "text": {}},
            {"name": "CodeClient", "text": {}},
            {"name": "EmailDemandeur", "text": {}},
            {"name": "EmailGestionnaire", "text": {}},
            {"name": "Civilite", "text": {}},
            {"name": "DateNaissance", "dateTime": {"format": "dateOnly"}},
            {"name": "DateEntree", "dateTime": {"format": "dateOnly"}},
            {"name": "Poste", "text": {}},
            {"name": "TypeContrat", "text": {}},
            {
                "name": "FormatSouhaite",
                "choice": {"allowTextEntry": False, "choices": ["PDF", "Word"], "displayAs": "dropDownMenu"},
                "defaultValue": {"value": "PDF"},
            },
            {"name": "RaisonSociale", "text": {}},
            {"name": "AdresseEntreprise", "text": {}},
            {"name": "Siret", "text": {}},
            {"name": "Representant", "text": {}},
            {"name": "FonctionRepresentant", "text": {}},
            {"name": "LieuEdition", "text": {}},
            {
                "name": "Statut",
                "choice": {"allowTextEntry": False, "choices": ["Reçue", "En production", "Produite", "Envoyée"], "displayAs": "dropDownMenu"},
                "defaultValue": {"value": "Reçue"},
            },
        ],
        "colonnes_creation": [],
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


def traiter_liste(site, jeton, listes_existantes, spec):
    nom = spec["nom"]
    if nom not in listes_existantes:
        print(f"→ Création de « {nom} »…")
        toutes = spec["colonnes_creation"] + spec["colonnes"]
        statut, rep = requete(
            "POST",
            f"https://graph.microsoft.com/v1.0/sites/{site}/lists",
            jeton,
            corps={"displayName": nom, "list": {"template": "genericList"}, "columns": toutes},
        )
        if statut not in (200, 201):
            sys.exit(f"   ÉCHEC ({statut}) : {rep}\n"
                     "   (403 → il manque probablement Sites.Manage.All à l'app Graph)")
        print(f"   créée avec {len(toutes)} colonnes")
        return

    liste_id = listes_existantes[nom]
    print(f"→ « {nom} » existe — vérification des colonnes…")
    statut, rep = requete(
        "GET",
        f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns?$select=name,displayName",
        jeton,
    )
    if statut != 200:
        sys.exit(f"   ÉCHEC de lecture des colonnes ({statut}) : {rep}")
    internes = {c["name"] for c in rep.get("value", [])}
    ajoutees = 0
    for col in spec["colonnes"]:
        if col["name"] in internes:
            continue
        statut, rep = requete(
            "POST",
            f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns",
            jeton,
            corps=col,
        )
        if statut not in (200, 201):
            sys.exit(f"   ÉCHEC d'ajout de {col['name']} ({statut}) : {rep}")
        ajoutees += 1
        print(f"   + {col['name']}")
    print(f"   {ajoutees} colonne(s) ajoutée(s)" if ajoutees else "   rien à faire, tout est là")


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
            sys.exit(f"   ÉCHEC de lecture ({statut}) : {rep}")
        for l in rep.get("value", []):
            listes[l["displayName"]] = l["id"]
        url = rep.get("@odata.nextLink")
    print(f"   {len(listes)} listes trouvées")

    print("3. Préparation des listes des démarches…")
    for spec in LISTES:
        traiter_liste(site, jeton, listes, spec)

    print("\nTerminé. Étapes suivantes : construire les deux flux standard")
    print("(docs/Flux-standard-ACP-ATT.md) PUIS retirer FLOW_URL_ACOMPTE et")
    print("FLOW_URL_ATTESTATION_EMPLOYEUR des variables de la Static Web App.")


if __name__ == "__main__":
    main()
