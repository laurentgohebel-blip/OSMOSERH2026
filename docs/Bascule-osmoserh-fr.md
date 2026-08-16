# Bascule de domaine → osmoserh.fr

> ⚠️ **Partiellement remplacé.** Depuis la décision de migrer vers un tenant
> neuf, l'état réel est dans **`Synthese-migration-2026-08-16.md`**.
> L'étape 6 (domaine dans le tenant Synapse) ne doit PAS être faite ; les
> étapes DNS/SWA/External ID restent valables mais visent la NOUVELLE
> Static Web App du tenant `osmoserh83`.

Décisions : portail sur **espace.osmoserh.fr**, e-mails en **@osmoserh.fr**,
ancien domaine synapserh.fr maintenu en parallèle pendant la transition.

Côté code : fait (commit `66b21b3c`) — mentions légales, données de démo,
commentaires. L'authentification (`window.location.origin`) et les liens du
portail sont agnostiques au domaine : aucun autre changement nécessaire.

## Ordre des opérations (important)

### 1. DNS — zone osmoserh.fr chez OVH
Ajouter dans la zone DNS de osmoserh.fr :

| Type | Nom | Cible |
|---|---|---|
| CNAME | `espace` | `ashy-pebble-0206b8703.azurestaticapps.net.` |

(La cible est le nom par défaut de la Static Web App du portail.)

### 2. Azure — Static Web App
portal.azure.com → la Static Web App du portail → **Domaines personnalisés**
→ Ajouter → `espace.osmoserh.fr` → validation par CNAME (déjà posé à l'étape 1)
→ le certificat TLS est émis automatiquement (quelques minutes).
**Ne pas supprimer** espace.synapserh.fr : les deux domaines cohabitent.

### 3. Entra External ID — URI de redirection
entra.microsoft.com → tenant External ID (osmoserh.onmicrosoft.com) →
Inscriptions d'applications → **Portail Osmose RH** (`09b5b72f-45e9-44cc-bd35-4472cf480c16`)
→ Authentification → plateforme **SPA** → ajouter :
`https://espace.osmoserh.fr`
(Garder les URI existantes. Sans cette étape, la connexion échoue sur le
nouveau domaine avec une erreur « redirect URI mismatch ».)

### 4. Tests du portail sur le nouveau domaine
- https://espace.osmoserh.fr → page de connexion → **se connecter** (compte réel)
- https://espace.osmoserh.fr/?demo → la démo s'ouvre
- https://espace.osmoserh.fr/decouvrir.html → vidéo lisible
- Envoyer une démarche de test → l'AR arrive.

### 5. OVH — site vitrine et redirection
- Hébergement → **Multisite** : rattacher `osmoserh.fr` (et `www.osmoserh.fr`)
  au dossier du site, SSL activé.
- Téléverser le nouvel `index.html` (livré le 3 août — liens vers
  espace.osmoserh.fr). **À faire seulement après l'étape 2**, sinon la
  vidéo et les boutons pointent vers un domaine pas encore actif.
- Redirection **301** de `synapserh.fr` et `www.synapserh.fr` vers
  `https://osmoserh.fr` (OVH → domaine synapserh.fr → Redirection).
  ⚠️ Ne PAS rediriger `espace.synapserh.fr` : il doit continuer de servir
  le portail pendant la transition.

### 6. Microsoft 365 — e-mails @osmoserh.fr
- Admin M365 → Paramètres → Domaines → **ajouter osmoserh.fr**
  (enregistrements MX, SPF, DKIM à poser dans la zone OVH — l'assistant les
  fournit).
- Créer/aliasser : `contact@osmoserh.fr`, `lgohebel@osmoserh.fr`
  (alias sur les boîtes existantes = le plus simple ; l'envoi ET la
  réception continuent de fonctionner sur les anciennes adresses).

### 7. Power Automate — flux
Pour chaque flux (AR embauche, acompte, attestation, absences, visite,
mutuelle, fin de contrat, messages gestionnaire, alertes échéances, alertes
de panne) :
- Liens vers le portail dans les corps d'e-mails : `espace.synapserh.fr`
  → `espace.osmoserh.fr`.
- Expéditeur / destinataires : passer sur les adresses @osmoserh.fr quand
  les boîtes/alias existent (étape 6).
- Adresse d'alerte de panne (`lgohebel@synapserh.fr`) → `lgohebel@osmoserh.fr`.

### 8. Fin de transition (dans quelques mois, quand plus personne n'utilise l'ancien domaine)
- Retirer espace.synapserh.fr des domaines de la Static Web App et des URI
  de redirection External ID.
- Les mentions légales sont déjà au nouveau domaine.
