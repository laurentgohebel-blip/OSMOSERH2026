# Infrastructure Osmose RH — étude de coûts (19/08/2026)

Photographie de tout ce qui tourne, ce que chaque brique coûte, et les
leviers d'économie classés par gain. Prix ≈ HT/mois, à vérifier sur les
pages tarifs au moment de décider (ils bougent).

## 1. Photographie de l'infrastructure

| Brique | Rôle | Coût estimé | Statut |
|---|---|---|---|
| **Microsoft 365** (tenant Osmose) | E-mails, SharePoint (données), Power Automate standard | ≈ 5,60 €/mois (Basic) à 11,70 €/mois (Standard) par utilisateur | Nécessaire |
| **Microsoft 365** (ancien tenant synapserh) | Idem, en doublon pendant la transition | idem — **en double** | À décommissionner J+30 |
| **Power Automate Premium** | Uniquement pour les flux à déclencheur HTTP | ≈ 13,70 €/mois/utilisateur | **Évitable** (levier n° 1) |
| **Azure Static Web App** | Portail + API (fonctions managées) | 0 € (offre Free) ou ≈ 8 €/mois (Standard) | Vérifier l'offre |
| **Microsoft Entra External ID** (CIAM) | Comptes de connexion des clients | 0 € jusqu'à 50 000 utilisateurs actifs/mois | Gratuit à notre échelle |
| **Graph API** (app be0f7e69) | Lectures/écritures SharePoint depuis l'API | 0 € (aucune licence requise) | Gratuit |
| **OVH hébergement web** | Site vitrine osmoserh.fr + vidéo | ≈ 4-7 €/mois | Nécessaire (décision : vitrine indépendante) |
| **OVH domaines** ×2 | synapserh.fr, osmoserh.fr | ≈ 2,50 €/mois (équiv. annuel) | Nécessaire |
| **OVH e-mail / SMTP** | Boîtes et envoi SMTP des flux | selon option souscrite | **Inutile** (levier n° 4) |
| **GitHub** (dépôt privé) | Code + CI (déploiement, tests) | 0 € dans le forfait 2 000 min/mois | Régime CI posé le 19/08 |

Ordre de grandeur actuel (transition, 1 utilisateur) : **≈ 40-50 €/mois**.
Cible après leviers : **≈ 20 €/mois** — soit environ la moitié.

## 2. Leviers, par gain décroissant

### Levier 1 — Supprimer le besoin de Power Automate Premium (~165 €/an)

Seul le déclencheur « requête HTTP reçue » est Premium. Sur nos
10 démarches, **8 écrivent déjà directement dans les listes SharePoint**
(le flux se déclenche « à la création d'un élément » : connecteur
standard, inclus dans Microsoft 365). Ne passent encore par HTTP que :

- **ACP-01 Acompte** (`FLOW_URL_ACOMPTE`)
- **ATT-01 Attestation employeur** (`FLOW_URL_ATTESTATION_EMPLOYEUR`)

**Action** : convertir ces deux démarches au même modèle que les huit
autres (l'API écrit la liste, le flux se déclenche à la création).
Comme les flux doivent de toute façon être **reconstruits dans le
nouveau tenant**, les reconstruire en standard ne coûte aucun travail
supplémentaire — c'est le même effort, en moins cher. Bénéfices
annexes : plus d'URL secrètes à gérer (variables `FLOW_URL_*`
supprimées), plus de schéma de déclencheur à maintenir (le kit ATT-01
devient sans objet), plus de risque « URL tronquée au copier-coller ».
Côté code : ~une demi-journée, testable avant la migration.

### Levier 2 — Décommissionner l'ancien tenant à J+30 (~70-140 €/an)

Déjà prévu dans la recette (§ 7). Chaque mois de retard = un jeu de
licences en double. À caler dans l'agenda dès la bascule réussie :
licences synapserh résiliées, app d28a8309 et SWA yellow-field
supprimées.

### Levier 3 — Ajuster la licence Microsoft 365 (~70 €/an si applicable)

Un compte qui ne sert qu'à héberger les flux et SharePoint n'a pas
besoin de Business Standard (Office de bureau) : **Business Basic
suffit** pour Power Automate standard + SharePoint + Exchange en ligne.
Ne garder Standard que pour le(s) compte(s) qui utilisent Word/Excel
installés. À trancher au moment d'acheter les licences du nouveau
tenant — ne pas reproduire l'existant par réflexe.

### Levier 4 — Résilier les options e-mail OVH (variable)

Le MX des deux domaines pointe vers Microsoft : **toute boîte ou option
e-mail payante chez OVH est de l'argent perdu** (démontré le 18/08 :
une boîte OVH sur ces domaines ne reçoit rien). Et après le passage des
flux au connecteur Outlook, le SMTP OVH ne servira plus. Garder chez
OVH : l'hébergement web et les deux domaines, rien d'autre.

### Levier 5 — Vérifier l'offre de la Static Web App (0 ou ~96 €/an)

L'offre **Free** couvre nos besoins : fonctions managées, certificats,
2 domaines personnalisés, 100 Go/mois. Si la SWA actuelle (ou la
nouvelle) est en Standard sans raison, repasser en Free. Contrepartie
assumée : pas de SLA contractuel. → À vérifier dans le portail Azure
(Vue d'ensemble de la SWA → « Plan d'hébergement »). Pour la nouvelle
SWA de la migration : la créer en Free d'emblée.

### Levier 6 — CI GitHub (fait le 19/08)

Tests sur main uniquement, ni tests ni déploiement pour la
documentation : consommation divisée par 3-4, le forfait gratuit
redevient très confortable. Pas de dépense à engager.

## 3. Ce qu'il ne faut PAS couper

- **External ID (CIAM)** : gratuit et central — ne pas « optimiser ».
- **Le tenant Microsoft unique** : SharePoint est la base de données du
  portail ; pas d'alternative moins chère à iso-fonctionnel.
- **La vitrine OVH** : ~60-80 €/an pour l'indépendance vis-à-vis du
  portail (décision du 17/08) — le jeu en vaut la chandelle.
- **Les deux domaines** pendant la transition ; synapserh.fr pourra se
  discuter à terme (redirections, image), pas avant J+30.

## 4. Plan d'action proposé (intégré à la migration)

1. Maintenant (avant déblocage Microsoft) : convertir ACP-01 et ATT-01
   en écriture directe (levier 1, côté code) — testable immédiatement.
2. À l'achat des licences du nouveau tenant : Basic vs Standard par
   compte (levier 3) ; **ne pas acheter Power Automate Premium**.
3. À la création de la nouvelle SWA : offre Free (levier 5).
4. Reconstruction des flux : tout en connecteurs standard
   SharePoint + Outlook (leviers 1 et 4).
5. J+30 après bascule : décommissionnement ancien tenant (levier 2) et
   résiliation des options e-mail OVH (levier 4).
