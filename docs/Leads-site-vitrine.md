# Leads du site vitrine — formulaires branchés

Chaîne : formulaire (osmoserh.fr) → `POST /api/lead` (anonyme, pot de miel,
CORS restreint aux origines du site) → liste SharePoint **« Leads site »** →
flux Power Automate « élément créé » (connecteurs standard, pas de Premium,
aucune URL secrète dans les pages publiques).

Formulaires branchés : `index.html` (accès prioritaire) et `contact.html`
(contact). Repli si l'API est injoignable : message avec l'e-mail direct,
le bouton se réactive, aucune fausse page « merci ».

## 1. Liste SharePoint à créer — site RH, nom exact : `Leads site`

⚠️ Libellés de colonnes SANS accent (le nom interne est figé à la création).
La liste est résolue par son nom d'affichage exact, accent et casse compris
(comme les autres listes lues par `annuaire.js`).

| Colonne | Type | Note |
|---|---|---|
| Title | (déjà là) | « NOM Prénom » — posé par l'API |
| Prenom | Texte | |
| Nom | Texte | |
| Email | Texte | |
| Entreprise | Texte | |
| Effectif | Texte | tranche choisie (formulaire accès prioritaire) |
| Sujet | Texte | formulaire contact |
| Message | Texte multiligne (brut) | formulaire contact |
| Formulaire | Texte | `acces-prioritaire` ou `contact` |
| PageOrigine | Texte | chemin de la page d'envoi |
| Statut | Choix : `Nouveau`, `Contacté`, `Clos` — défaut `Nouveau` | |

## 2. Flux Power Automate « Leads site + notification »

1. Déclencheur **SharePoint — Lorsqu'un élément est créé** : site RH,
   liste `Leads site`.
2. **Office 365 Outlook — Envoyer un e-mail (V2)** à `lgohebel@osmoserh.fr` :
   objet `Nouveau lead site — {Formulaire} — {Title}`, corps avec Prenom,
   Nom, Email, Entreprise, Effectif, Sujet, Message, PageOrigine.
3. *(Optionnel)* AR au prospect : e-mail à la valeur de la colonne `Email` —
   ⚠️ SEULEMENT après la fusion des deux enregistrements SPF de
   osmoserh.fr (voir synthèse du 16/08), sinon l'AR part en spam.

## 3. Notes techniques

- `api/src/functions/lead.js` : validation (prénom/nom ≥ 2, e-mail),
  pot de miel `website` (réponse OK sans écriture), longueurs bornées,
  préflight OPTIONS géré, origines autorisées : osmoserh.fr, www,
  et synapserh.fr pendant la transition.
- L'API utilise le même accès Graph que le reste (`GRAPH_*`, `RH_SITE_ID`) :
  la liste doit exister dans le site RH du tenant que vise la SWA déployée.
- Anti-spam supplémentaire si besoin un jour : compteur d'envois par IP,
  ou champ temporel (rejet des soumissions < 3 s après chargement).
