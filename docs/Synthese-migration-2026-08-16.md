# Migration Osmose RH — synthèse du 16 août 2026

Point de reprise. Contient l'état réel du système, les décisions prises et leurs raisons, et ce qui reste à faire.

---

## Registre des valeurs

| Valeur | Contenu |
|---|---|
| Tenant workforce (production) | `5dc184d2-699a-4051-9f46-d040bc141669` |
| Domaine initial | `osmoserh83.onmicrosoft.com` — **figé, non renommable** |
| Domaine principal | `osmoserh.fr` |
| Compte d'administration | `lgohebel@osmoserh.fr` |
| Hôte SharePoint | `osmoserh83.sharepoint.com` |
| Site RH | `https://osmoserh83.sharepoint.com/sites/RH` |
| `RH_SITE_ID` | `osmoserh83.sharepoint.com,ac8bcc33-521f-4d94-bb53-fac93010637b,e2c157a4-925f-4f6b-abf5-e07d69a07ab0` |
| Tenant Entra External ID | `da198f21-6842-4cd2-91fb-72e91195d784` |
| Authority CIAM | `https://osmoserh.ciamlogin.com/da198f21-6842-4cd2-91fb-72e91195d784` |
| App portail (CIAM) | `09b5b72f-45e9-44cc-bd35-4472cf480c16` |
| App Graph app-only | `be0f7e69-1192-4582-a3f7-984fae4ff145` |
| Secret Graph | valeur détenue hors de cette synthèse — **noter sa date d'expiration** |
| Ancien tenant Synapse | `b9cfc83f-9274-459b-a7ea-62dca3451e8c` |
| Ancien `RH_SITE_ID` | `synapserhfr.sharepoint.com,73298212-7944-44a9-94e3-43965a264593,c0983aea-dd9b-4a7b-8bf2-9ee37c0f0077` |
| App créée par erreur | `d28a8309-3de7-4546-b3f1-155b9021bcae` — **à supprimer** |

### Deux tenants, deux rôles

Ce n'est pas un doublon, c'est l'architecture :

- **`da198f21`** — Entra External ID. Identités clients. Les clients créent leur compte eux-mêmes ; l'accès réel est contrôlé côté serveur par la liste `Utilisateurs portail`.
- **`5dc184d2`** — Workforce M365. SharePoint, Power Automate, production.

Les variables `AUTH_*` pointent le premier, les `GRAPH_*` le second.

---

## Variables SWA — phase 5

Aucune valeur de repli dans le code : chaque variable manquante provoque une panne franche.

| Variable | Valeur |
|---|---|
| `AUTH_TENANT_ID` | `da198f21-6842-4cd2-91fb-72e91195d784` |
| `AUTH_CLIENT_ID` | `09b5b72f-45e9-44cc-bd35-4472cf480c16` |
| `GRAPH_TENANT_ID` | `5dc184d2-699a-4051-9f46-d040bc141669` |
| `GRAPH_CLIENT_ID` | `be0f7e69-1192-4582-a3f7-984fae4ff145` |
| `GRAPH_CLIENT_SECRET` | à renseigner |
| `RH_SITE_ID` | voir registre |
| `FLOW_URL_ATT01` | après reconstruction du flux |
| `RAPPEL_SECRET` | au choix |

⚠️ Les variables `VITE_*` sont **compilées au build**. Les changer dans Azure ne suffit pas : commit + redéploiement GitHub Actions.

---

## Décisions prises, et pourquoi

**Tenant `5dc184d2` retenu malgré le `83`.** Le renommage SharePoint est une opération unique par tenant, avec deux obstacles cumulés (`osmoserh.onmicrosoft.com` occupé par le tenant CIAM, puis erreur 1104 sur un domaine déjà utilisé). Écarté parce que les clients n'accèdent jamais à SharePoint — l'application remonte tout via Graph.

→ **Règle qui en découle : aucun lien SharePoint direct ne doit jamais partir vers un client.** Ni dans les e-mails de flux, ni dans les accusés de réception. Les liens pointent vers le portail. C'est ce qui rend le `83` définitivement invisible.

**Production contrat — option A retenue.** Noms internes encodés (`Pr_x00e9_nom`, `Dateded_x00e9_but`, `N_x00b0_S_x00e9_curit_x00e9_Soci`…) conservés à l'identique. Motif : `annuaire.js` les contient en dur ligne 201, en plus de `echeances.js` et `rappel.js`. Zéro modification de code.

**Journal — écarté.** Aucune fonction ne l'écrit, aucun flux ne l'alimente. Le créer maintenant produirait une liste vide. C'est un chantier à part, hors périmètre d'une migration qui vise l'iso-fonctionnel.

**Flux — reconstruction plutôt qu'import.** L'export en package `.zip` a été retiré par Microsoft ; l'import en solution échoue sur `SecLib::CheckPrivilege failed / prvImportCustomization`. Réparable par le rôle Administrateur système Dataverse, mais un seul flux existe réellement (ATT-01) et l'import laisserait de toute façon tout le travail de reconnexion.

**E-mail — connecteur Office 365 Outlook, expéditeur `lgohebel@osmoserh.fr`.** Abandon du SMTP OVH : plus de mot de passe à gérer. Boîte partagée à envisager plus tard — le changement se limitera à remplacer l'action et renseigner un champ *Mailbox address*.

**Données legacy — fictives.** Repo GitHub `synapse-contrat` (public) et Supabase : aucun enjeu RGPD, vérification faite. Repo à supprimer ou passer en privé quand tu passeras par là.

---

## État de la couche données — terminée

### Listes lues par `annuaire.js` — 7/7

Le code résout les listes par leur **`displayName`**, correspondance stricte :

```js
listeIds = Object.fromEntries(j.value.map((l) => [l.displayName, l.id]));
```

| `displayName` attendu | État |
|---|---|
| `Paramètres clients` | ✅ |
| `Utilisateurs portail` | ✅ |
| `Cycle de paie` | ✅ |
| `Demandes d'accès portail` | ✅ |
| `Fins de contrat` | ✅ |
| `Variables de paie` | ✅ |
| `Production contrat` | ✅ |

⚠️ **Les accents des `displayName` de listes sont significatifs.** Un `Parametres clients` sans accent ne serait jamais trouvé, et l'erreur remonterait en 502 générique « Annuaire clients injoignable ». La règle « pas d'accent » ne vaut que pour les **noms internes de colonnes**.

### Autres listes créées

`Salaries` (sans accent — non lue par le code, sans conséquence), `DemandesAttestations`, `Acompte`, `Absences`, `Messages gestionnaire`.

`DemandesAttestations` : nom volontairement distinct de la bibliothèque `Attestations`. Aucun code ne la résout par son nom, seul le flux ATT-01 y écrit.

### Bibliothèques — 5/5

`Documents clients` (la GED), `Templates`, `Attestations`, `Documents RH`, `Pieces jointes`.

Les quatre sous-dossiers par client — `Attestations`, `Contrats`, `Paie`, `Dépôts` — sont créés **automatiquement par le code** (`annuaire.js` ligne 251) à la création d'un client. Rien à faire à la main.

`Général` n'est ni une liste ni un dossier : c'est l'étiquette de catégorie des fichiers posés à la racine du dossier client.

### Corrections apportées au passage

| Correction | Motif |
|---|---|
| `Acompte.Matricule` : Nombre → Texte | un matricule `007` devenait `7` |
| `Production contrat.N° Sécurité Sociale` : Nombre → Texte | 15 chiffres, zéros initiaux perdus et précision flottante dépassée |
| `DemandesAttestations.Statut` défaut : `Visée` → `Reçue` | une demande naissait visée avant approbation |
| `Acompte` : ajout de `Reference` et `EmailGestionnaire` | manquantes, toutes les autres démarches les portent |
| Valeurs résiduelles supprimées | `Choix 4` sur TypeContrat, `Choix 1/2/3` sur PosteTravail |
| `Fins de contrat` : dates en Date seule | l'heure d'une fin de contrat n'a pas de sens |

### Listes abandonnées

`Adhésions mutuelles`, `Demandes de contrat`, `Visites médicales`, `Production contrats` (doublon vide), `salaries_fictifs_enrichis-0204…` (résidu d'import, colonnes `field_2` à `field_36`).

---

## Pièges rencontrés — à ne pas réapprendre

**Noms internes SharePoint figés à la création.** Le libellé saisi détermine le nom interne, définitivement. Renommer ensuite ne le change pas. Via Graph, `name` et `displayName` sont dissociables — l'interface graphique ne le permet pas.

**OVH : `@` pour la racine du domaine**, pas un champ vide. Un champ vide crée l'enregistrement sur `www`.

**Graph — `/sites/{host}:/sites/{path}:/lists/...` ne fonctionne pas.** Il faut passer par l'identifiant composite du site.

**Graph Explorer renvoie `200` avec `"value": []`** quand la permission manque, au lieu d'un 403. Vérifier *Modify Permissions* avant de conclure à une absence de données.

**Créer des listes via Graph exige `Sites.Manage.All`**, pas `Sites.ReadWrite.All`.

**Colonnes date seule** : stockées à minuit heure de Paris, soit 22:00Z (23:00Z l'hiver) **la veille**. Tronquer l'ISO UTC recule d'un jour. Géré par `dateParis()` dans `annuaire.js` — mais le piège resurgit si une colonne est recréée en *Date et heure* là où elle était en *Date seule*.

**PnP.PowerShell v2+ exige sa propre application Entra** (`Register-PnPEntraIDApp`). Sans objet ici, création faite via Graph.

---

## Reste à faire

### Phase 4 — reconstruire ATT-01

Environnement **OSMOSE RH** sur make.powerautomate.com. Garder l'ancien flux ouvert en parallèle pour recopier expressions et corps HTML.

1. **Déclencheur** *Lorsqu'une requête HTTP est reçue*, mode **signature** (`&sig=` dans l'URL, pas OAuth). Récupérer le **schéma JSON du corps** depuis l'ancien flux — ne pas le réécrire de mémoire.
2. Écriture dans `DemandesAttestations`
3. Lecture de `Paramètres clients` — identité employeur
4. Approbation
5. **Word Online Business** — remplir le modèle
6. Conversion PDF
7. Dépôt dans `Documents clients/{CodeClient}/Attestations`
8. Accusé de réception — **Office 365 Outlook**, expéditeur `lgohebel@osmoserh.fr`

Relever l'URL du déclencheur → `FLOW_URL_ATT01`. **C'est un secret** : elle donne le droit de déclencher le flux.

⚠️ Les modèles Word re-téléversés ont de **nouveaux identifiants de fichier**. Les actions Word les référencent par identifiant, pas par nom — chaque action doit être re-sélectionnée même si le nom est identique. Panne silencieuse classique : le flux s'exécute, échoue, et le message ne mentionne jamais le mot « modèle ».

### Phase 5 — configuration

Variables SWA, secrets GitHub Actions, `.env.local`. **Zéro modification de code** : si tu te retrouves à éditer un fichier source, c'est qu'une valeur est en dur et doit être sortie en variable.

À nettoyer : `VITE_DEV_NO_AUTH` traîne sur `main`.

### Phase 6 — recette et fermeture

ATT-01 de bout en bout : connexion CIAM → formulaire → `/api/demande` → validation du jeton → résolution email/CodeClient → flux → approbation → Word/PDF → dépôt GED → accusé → (Journal, si un jour créé).

Puis bascule DNS, retrait des anciennes Redirect URI, et **attente de 30 jours** avant de décommissionner l'ancien tenant.

---

## Points ouverts

**Rôle Administrateur système Dataverse** sur l'environnement OSMOSE RH — non attribué. Bloque l'import de solutions et l'affichage de l'onglet Solutions. Contourné par la reconstruction du flux, mais restera nécessaire pour administrer l'environnement.
→ admin.powerplatform.microsoft.com → Environnements → OSMOSE RH → Paramètres → Utilisateurs + autorisations

**Licence Power Automate Premium** — état non vérifié. Nécessaire pour le connecteur HTTP et les déclencheurs signés. Si les flux tournaient sur l'ancien tenant, c'est que la licence y existait — elle ne suit pas la migration. À confirmer avant la phase 4.

**Deux enregistrements SPF concurrents** sur `osmoserh.fr` :
```
v=spf1 include:mx.ovh.com -all
v=spf1 include:spf.protection.outlook.com -all
```
Configuration invalide — la norme n'en autorise qu'un. Les serveurs destinataires renvoient une erreur permanente : les accusés de réception partiraient en spam ou seraient rejetés. À fusionner **avant tout envoi réel** :
```
v=spf1 include:mx.ovh.com include:spf.protection.outlook.com -all
```
Garder `mx.ovh.com` tant que `sendmail.php` du site vitrine passe par OVH.

**`osmoserh.fr` — vérifier dans quel tenant il est vérifié.** Un domaine ne vit que dans un tenant à la fois. Le TXT `MS=ms34924687` a peut-être atterri sur le tenant CIAM. Contrôle : Domain names sur les deux tenants.

**Dette technique legacy** : `auth.js` a `LOGIN_PAGE` figé sur `https://synapserh.fr/Connexion.html`. `Acceuil.html` contient un chemin `file:///C:/Users/laure/...`. Repo `synapse-contrat` public avec mécanisme d'écriture GitHub actif.

**App `OsmoseRH-Portail`** (`d28a8309-…`) créée par erreur dans le tenant workforce — inutile, le `clientId` du portail vient du tenant CIAM. À supprimer.
