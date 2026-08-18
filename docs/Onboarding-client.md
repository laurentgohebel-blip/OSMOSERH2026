# Onboarding client — procédure de référence

Du contrat signé au client autonome dans son espace. Écrite pour la cible
osmoserh (espace.osmoserh.fr, e-mails @osmoserh.fr en connecteur Outlook) ;
en attendant la bascule, remplacer les adresses par espace.synapserh.fr.

**Principe directeur : le client ne doit jamais attendre.** Son accès est
préparé AVANT sa première connexion (parcours A, nominal). La demande
d'accès depuis le portail reste un filet de sécurité (parcours B), pas la
porte d'entrée d'un client signé.

## Parcours A — client signé (pré-provisionnement, nominal)

Côté gestionnaire, dans l'ordre, dès la signature :

1. **Écran d'administration** (connexion au portail avec une adresse de
   `ADMIN_EMAILS`) → section **« Nouveau client — accès sans demande »**.
2. Saisir l'**adresse e-mail du client** — celle du contrat, exactement
   celle qu'il utilisera pour se connecter (voir vigilances).
3. Choisir « Nouveau client » et remplir la fiche : **code client** (court,
   stable — ex. DUPONT), **raison sociale**, **options souscrites**
   (embauche / acomptes / attestations / paie), et l'**identité employeur**
   (adresse, SIRET, représentant, fonction, lieu d'édition) : elle alimente
   les documents générés (contrats, attestations) — la remplir tout de
   suite évite des documents incomplets.
4. Cliquer **« Créer l'accès »**. C'est tout côté technique : fiche
   « Paramètres clients » + rattachement « Utilisateurs portail » sont
   écrits, effet immédiat.
5. **Reprise de l'effectif** (section dédiée de l'écran admin) : demander
   au client (ou à l'expert-comptable sortant) l'export de ses salariés —
   n'importe quel Excel/CSV, ou le modèle `Modele_import_salaries.xlsx`
   du portail. L'ouvrir dans Excel, sélectionner le tableau, **Ctrl+C,
   coller dans la section** : colonnes reconnues automatiquement, aperçu,
   puis import (doublons nom+prénom ignorés, compte-rendu affiché).
   → Le client découvre son espace **déjà peuplé de ses salariés**,
   démarches pré-remplies : c'est le moment « waouh » de l'onboarding.
6. **Envoyer l'e-mail de bienvenue** (modèle ci-dessous). Automatisation
   prévue : flux « Bienvenue portail » à la création d'un élément dans
   « Utilisateurs portail » (connecteur Outlook) — tant qu'il n'est pas
   reconstruit, envoi manuel depuis la boîte @osmoserh.fr.

Côté client, à sa première visite :

7. Sur espace.osmoserh.fr, **« Créer un compte »** (inscription External
   ID) avec l'adresse exacte de l'étape 2 → code de vérification reçu par
   e-mail → mot de passe choisi.
8. Connexion → l'espace s'ouvre **directement** sur son tableau de bord,
   son effectif déjà en place.

## Parcours B — demande spontanée (filet de sécurité)

Pour un compte non préparé (prospect, oubli, deuxième utilisateur d'un
client existant) :

1. Le visiteur crée son compte, se connecte → écran « Demande d'accès »
   (entreprise + nom requis) → référence `ACCES-…` + AR au demandeur +
   notification gestionnaire (flux « Demandes d'accès + AR »).
2. Le gestionnaire ouvre l'écran d'administration → la demande est en
   attente → **rattacher à un client existant** OU **créer le client**
   → un clic : tout est écrit, la demande passe en « Traitée ».
3. Le client recharge sa page : son espace s'ouvre. Envoyer l'e-mail de
   bienvenue s'il s'agit d'un nouveau client.

## Premiers pas du client (à accompagner au premier rendez-vous)

- **Vérifier l'effectif repris ensemble** (onglet Personnel) : la reprise
  a été faite à l'onboarding — contrôler les entrées/sorties récentes et
  compléter ce qui manque.
- Réaliser une **première démarche réelle** ensemble (une absence ou un
  acompte : rapides et parlantes).
- Montrer l'onglet **Documents** (dépôt et récupération) et le bouton
  **« Contacter mon gestionnaire »**.
- Rappeler le **cut-off paie** (rappel automatique le 25 du mois).

## Modèle d'e-mail de bienvenue

> **Objet : Votre espace client Osmose RH est prêt**
>
> Bonjour {Prénom},
>
> Votre espace client Osmose RH est ouvert : **https://espace.osmoserh.fr**
>
> Pour votre première connexion :
> 1. Cliquez sur « Créer un compte » et inscrivez-vous avec **cette
>    adresse e-mail ({email})** — c'est elle qui ouvre votre espace.
> 2. Saisissez le code de vérification reçu par e-mail et choisissez
>    votre mot de passe.
> 3. Vous arrivez directement sur le tableau de bord de {Raison sociale}.
>
> Vos salariés sont déjà dans votre espace (onglet Personnel) : vos
> démarches arrivent pré-remplies. Un premier réflexe : vérifiez cet
> effectif et signalez-nous tout écart.
>
> Un doute, une question ? Le bouton « Contacter mon gestionnaire » dans
> votre espace, ou simplement une réponse à cet e-mail.
>
> Bienvenue chez Osmose RH,
> {Prénom du gestionnaire} — Osmose RH · {téléphone}

## Vigilances

- **L'adresse fait tout** : le rattachement se joue sur l'égalité stricte
  (insensible à la casse) entre l'adresse du compte de connexion et celle
  d'« Utilisateurs portail ». Pas d'alias, pas de deuxième boîte. En cas
  de doute au moment du contrat, demander « l'adresse avec laquelle vous
  vous connecterez ».
- **Deuxième utilisateur d'un même client** : parcours A aussi — même
  section, « Client existant », rattachement en un clic.
- **Spam** : tant que SPF/DKIM d'osmoserh.fr ne sont pas finalisés (SPF à
  fusionner) et les flux pas repassés en connecteur Outlook, prévenir le
  client que l'e-mail de bienvenue/AR peut arriver en indésirables.
- **Désactivation** (départ d'un client) : passer `Actif` à faux dans
  « Paramètres clients » (coupe tout le client) ou retirer la ligne
  « Utilisateurs portail » (coupe un seul compte). Effet au plus tard
  60 s après (cache).
- Ne jamais « traiter » une demande d'accès à la main dans SharePoint :
  toujours passer par l'écran d'administration (c'est l'origine de
  l'incident du 18/08).

## À reconstruire lors de la migration (rappel)

- Flux « Demandes d'accès + AR » (parcours B) — connecteur Outlook.
- Flux « Bienvenue portail » (nouveau, parcours A étape 6) : déclencheur
  = création dans « Utilisateurs portail », envoi du modèle ci-dessus au
  client + copie gestionnaire.
