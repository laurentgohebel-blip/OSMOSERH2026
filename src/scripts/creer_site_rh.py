# creer_site_rh.py — crée TOUTES les listes du portail dans le site RH.
# ─────────────────────────────────────────────────────────────────────────────
# Script maître de la bascule (docs/Plan-bascule-osmoserh.md, phase 1).
# Colonnes générées DEPUIS LE CODE de l'API (annuaire.js, demande.js,
# personnel.js, admin.js) : chaque nom interne est exactement celui que
# l'API écrit ou lit. Idempotent : liste absente → créée complète ;
# liste existante → seules les colonnes manquantes sont ajoutées.
#
# NE CRÉE PAS (à faire à la main, voir le plan de bascule) :
#   - « Production contrat » : noms internes accentués hérités de
#     l'interface — à recréer via l'interface SharePoint (tableau des
#     libellés exacts dans le plan) ;
#   - la colonne « Options » (choix MULTIPLE) de « Paramètres clients » :
#     Graph ne sait pas créer un choix multiple — à ajouter via
#     l'interface (choix : embauche, acompte, attestation, paie —
#     autoriser plusieurs valeurs) ;
#   - les listes des chantiers dédiés : lancer AUSSI
#     creer_listes_demarches.py (Acompte, Demandes attestations)
#     et creer_leads_site.py (Leads site).
#
# Prérequis : app Graph app-only avec Sites.Manage.All.
# Utilisation : python creer_site_rh.py   (invite pour toute valeur absente)
#   ou GRAPH_TENANT_ID=… GRAPH_CLIENT_ID=… GRAPH_CLIENT_SECRET=… RH_SITE_ID=…
# ─────────────────────────────────────────────────────────────────────────────

import json
import os
import sys
import urllib.parse
import urllib.request

T = lambda: {"text": {}}                      # texte simple
TL = lambda: {"text": {"allowMultipleLines": True, "textType": "plain"}}
N = lambda: {"number": {}}
D = lambda: {"dateTime": {"format": "dateOnly"}}
DH = lambda: {"dateTime": {}}
B = lambda defaut: {"boolean": {}, "defaultValue": {"value": "1" if defaut else "0"}}


def CH(choix, defaut):
    return {
        "choice": {"allowTextEntry": False, "choices": choix, "displayAs": "dropDownMenu"},
        "defaultValue": {"value": defaut},
    }


def col(nom, spec):
    return {"name": nom, **spec}


# Socle commun des listes « gestion du personnel » (creerElementPersonnel)
SOCLE_PERSONNEL = [
    col("Reference", T()), col("CodeClient", T()), col("RaisonSociale", T()),
    col("SalarieNom", T()), col("SalariePrenom", T()),
    col("EmailDemandeur", T()), col("EmailGestionnaire", T()),
]

LISTES = [
    ("Paramètres clients", [
        col("CodeClient", T()), col("RaisonSociale", T()),
        col("AdresseEntreprise", T()), col("Siret", T()),
        col("Representant", T()), col("FonctionRepresentant", T()),
        col("LieuEdition", T()), col("EmailGestionnaire", T()),
        col("Actif", B(True)),
        # Identification URSSAF de l'employeur (DPAE, 22/08) —
        # AdresseEntreprise = rue seule, ville et CP à part (norme DPAE).
        col("CodeUrssaf", T()), col("CodeApe", T()),
        col("VilleEntreprise", T()), col("CodePostalEntreprise", T()),
        col("TelephoneEntreprise", T()), col("SanteTravail", T()),
        # + colonne « Options » (choix multiple) À LA MAIN — voir en-tête
    ]),
    ("Utilisateurs portail", [
        col("Email", T()), col("CodeClient", T()), col("Actif", B(True)),
    ]),
    ("Demandes d'accès portail", [
        col("Email", T()), col("NomComplet", T()), col("Entreprise", T()),
        col("Telephone", T()), col("Message", TL()),
        col("Statut", CH(["Nouvelle", "Traitée"], "Nouvelle")),
    ]),
    ("Salariés", [
        col("CodeClient", T()), col("Matricule", T()),
        col("Nom", T()), col("Prenom", T()), col("Poste", T()),
        col("TypeContrat", T()), col("DateEntree", D()), col("DateSortie", D()),
        col("Statut", T()), col("Email", T()), col("Telephone", T()),
        # Dossier salarié (enrichi le 22/08 — état civil, banque, paie)
        col("AdressePostale", T()), col("NumeroSS", T()),
        col("DateNaissance", D()), col("Sexe", T()),
        col("NomNaissance", T()), col("NomMarital", T()),
        col("SituationFamiliale", T()),
        col("DepartementNaissance", T()), col("CodeDepartementNaissance", T()),
        col("PaysNaissance", T()), col("CodePaysNaissance", T()),
        col("Iban", T()), col("Bic", T()),
        col("BulletinDematerialise", B(False)),
    ]),
    ("Absences", SOCLE_PERSONNEL + [
        col("DateDebut", D()), col("DateFin", D()), col("Motif", T()),
        col("JustificatifUrl", T()),
        col("Statut", CH(["Nouvelle", "Vue", "Traitée"], "Nouvelle")),
    ]),
    ("Visites médicales", SOCLE_PERSONNEL + [
        col("DateVisite", D()),
        col("Statut", CH(["À planifier", "Planifiée", "Réalisée"], "À planifier")),
    ]),
    ("Adhésions mutuelles", SOCLE_PERSONNEL + [
        col("Mutuelle", T()), col("DateAdhesion", D()),
        col("Statut", CH(["Demande", "Transmise", "Active"], "Demande")),
    ]),
    ("Fins de contrat", [
        col("CodeClient", T()), col("EmailDemandeur", T()), col("EmailGestionnaire", T()),
        col("Matricule", T()), col("Nom", T()), col("Prenom", T()),
        col("TypeContrat", T()), col("Motif", T()), col("DateFin", D()),
        col("Preavis", T()), col("DernierJourTravaille", D()),
        col("CongesRestants", N()), col("Commentaire", TL()),
        col("Statut", CH(["Nouvelle", "En cours", "Traitée"], "Nouvelle")),
    ]),
    ("Messages gestionnaire", [
        col("Message", TL()), col("Reference", T()), col("CodeClient", T()),
        col("RaisonSociale", T()), col("EmailDemandeur", T()), col("EmailGestionnaire", T()),
        col("Statut", CH(["Nouveau", "Répondu"], "Nouveau")),
        # Fil de discussion du portail (docs/Fil-messagerie-portail.md) :
        # un élément = un fil ; message initial dans Message, réponses en
        # JSON dans Echanges [{qui, quand, texte}]. Relancer ce script
        # ajoute ces colonnes aux listes existantes (traiter_liste).
        col("Echanges", TL()), col("DerniereMaj", DH()), col("DernierAuteur", T()),
        col("Clos", B(False)), col("NonLuClient", B(False)), col("NonLuGestionnaire", B(False)),
        # Dernier texte du gestionnaire, recopié à plat par l'API : le
        # flux e-mail le cite d'un simple jeton, sans parser Echanges.
        col("DerniereReponse", TL()),
        # Anti-doublon du flux « réponse gestionnaire → e-mail client » :
        # l'API la passe à faux à chaque réponse, le flux notifie puis la
        # remet à vrai. Défaut vrai : l'existant ne déclenche rien.
        col("NotifEnvoyee", B(True)),
    ]),
    ("Variables de paie", [
        col("CodeClient", T()), col("EmailDemandeur", T()), col("Mois", T()),
        col("Matricule", T()), col("Nom", T()), col("Prenom", T()),
        col("HeuresNormales", N()), col("HeuresComplementaires", N()),
        col("HeuresSup25", N()), col("HeuresSup50", N()), col("HeuresNuit", N()),
        col("HeuresDimancheFerie", N()),
        col("AbsenceType", T()), col("AbsenceDu", T()), col("AbsenceAu", T()),
        col("PrimeLibelle", T()), col("PrimeMontant", N()), col("Acompte", N()),
        col("TitresResto", N()), col("FraisPro", N()), col("AvantagesNature", N()),
        col("Commentaire", TL()),
        col("Statut", CH(["Nouvelle", "Intégrée"], "Nouvelle")),
    ]),
    ("Cycle de paie", [
        col("CodeClient", T()), col("Mois", T()), col("RaisonSociale", T()),
        col("Statut", CH(
            ["En attente variables", "Variables reçues", "Saisie Cegid", "Contrôlée", "Bulletins déposés"],
            "En attente variables")),
        col("VariablesRecuesLe", DH()),
    ]),
]

BIBLIOTHEQUE = "Documents clients"  # documentLibrary — un dossier par CodeClient


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


def traiter_liste(site, jeton, listes_existantes, nom, colonnes, gabarit="genericList"):
    if nom not in listes_existantes:
        statut, rep = requete(
            "POST", f"https://graph.microsoft.com/v1.0/sites/{site}/lists", jeton,
            corps={"displayName": nom, "list": {"template": gabarit}, "columns": colonnes},
        )
        if statut not in (200, 201):
            sys.exit(f"   ÉCHEC création « {nom} » ({statut}) : {rep}\n"
                     "   (403 → il manque probablement Sites.Manage.All à l'app Graph)")
        print(f"   « {nom} » créée ({len(colonnes)} colonnes)")
        return
    liste_id = listes_existantes[nom]
    statut, rep = requete(
        "GET", f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns?$select=name", jeton)
    if statut != 200:
        sys.exit(f"   ÉCHEC lecture colonnes « {nom} » ({statut}) : {rep}")
    internes = {c["name"] for c in rep.get("value", [])}
    ajoutees = [c for c in colonnes if c["name"] not in internes]
    for c in ajoutees:
        statut, rep = requete(
            "POST", f"https://graph.microsoft.com/v1.0/sites/{site}/lists/{liste_id}/columns", jeton, corps=c)
        if statut not in (200, 201):
            sys.exit(f"   ÉCHEC ajout {c['name']} à « {nom} » ({statut}) : {rep}")
    print(f"   « {nom} » : {len(ajoutees)} colonne(s) ajoutée(s)" if ajoutees else f"   « {nom} » : complète")


def main():
    tenant = valeur("GRAPH_TENANT_ID")
    client = valeur("GRAPH_CLIENT_ID")
    secret = valeur("GRAPH_CLIENT_SECRET", secret=True)
    site = valeur("RH_SITE_ID")

    print("\n1. Jeton Graph…")
    statut, rep = requete(
        "POST", f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        formulaire={"grant_type": "client_credentials", "client_id": client,
                    "client_secret": secret, "scope": "https://graph.microsoft.com/.default"})
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

    print("3. Création/complétion des listes du portail…")
    for nom, colonnes in LISTES:
        traiter_liste(site, jeton, listes, nom, colonnes)

    print("4. Bibliothèque de documents…")
    traiter_liste(site, jeton, listes, BIBLIOTHEQUE, [], gabarit="documentLibrary")

    # « Production contrat » existe déjà (créée à la main, noms internes
    # accentués) : on ne fait qu'AJOUTER le suivi DPAE — jamais la créer
    # ici, ses colonnes historiques ne sont pas dans ce script.
    print("5. Suivi DPAE sur « Production contrat »…")
    if "Production contrat" in listes:
        traiter_liste(site, jeton, listes, "Production contrat", [
            col("DpaeStatut", T()), col("DpaeIdFlux", T()),
            col("DpaeCertificat", T()), col("DpaeMessage", TL()),
            col("DpaeDeclareLe", DH()),
        ])
    else:
        print("   IGNORÉ : liste absente — créez-la d'abord (plan de bascule).")

    print("""
Terminé. RESTE À FAIRE À LA MAIN (voir docs/Plan-bascule-osmoserh.md) :
  1. « Paramètres clients » → colonne « Options » : type Choix, valeurs
     embauche / acompte / attestation / paie, AUTORISER PLUSIEURS VALEURS.
  2. « Production contrat » : créer via l'interface avec les libellés
     exacts du plan (noms internes accentués attendus par l'API).
  3. Lancer aussi : creer_listes_demarches.py puis creer_leads_site.py.""")


if __name__ == "__main__":
    main()
