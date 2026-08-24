# Lecture automatique des pièces (OCR)

Le portail lit les documents photographiés et **pré-remplit** les
formulaires. Rien n'est écrit sans validation : les champs reconnus sont
proposés, l'utilisateur corrige avant d'envoyer.

## Ce que ça change pour vos clients

| Où | Pièce | Champs pré-remplis |
|---|---|---|
| Déclarer une absence | photo de l'arrêt de travail | dates de début et de fin, motif |
| Onboarding salarié | RIB | IBAN, BIC |
| Onboarding salarié | carte Vitale | n° de sécurité sociale |
| Onboarding salarié | pièce d'identité | nom de naissance, date de naissance, sexe, commune de naissance |

Le champ « photographier ou joindre » utilise l'appareil photo du
téléphone (`capture="environment"`) : sur un chantier, le patron
photographie l'arrêt reçu par SMS et la déclaration est presque finie.

**Un champ déjà saisi n'est jamais écrasé.** Une bannière verte annonce
ce qui a été lu et invite à vérifier.

## Mise en service

Sans configuration, **la fonctionnalité est simplement absente** : les
dépôts fonctionnent comme avant, aucun appel réseau, aucun coût. Pour
l'activer :

1. Créer une ressource **Azure AI Document Intelligence** (portail Azure,
   région France Central de préférence — les documents restent en
   Europe).
2. Relever l'**endpoint** et une **clé** dans « Clés et point de
   terminaison ».
3. Poser deux variables dans la Static Web App (Configuration →
   Variables d'environnement) :

   | Variable | Valeur |
   |---|---|
   | `OCR_ENDPOINT` | `https://<votre-ressource>.cognitiveservices.azure.com` |
   | `OCR_CLE` | la clé de la ressource |

   Facultatif : `OCR_MODELE` remplace le modèle de lecture de texte
   (défaut `prebuilt-read`). Les pièces d'identité utilisent toujours
   `prebuilt-idDocument`, qui rend des champs structurés.

4. Recharger le portail — rien d'autre à faire, aucun redéploiement.

### Coût

Facturation à la page analysée. `prebuilt-read` est le modèle le moins
cher ; `prebuilt-idDocument` (pièces d'identité) est un peu plus élevé.
Un niveau gratuit existe pour les premières pages de chaque mois.
Vérifiez la grille en vigueur avant d'ouvrir à tous les clients — les
volumes d'une TPE restent très faibles (quelques pièces par embauche).

## Garde-fous en place

- **Le dépôt prime sur l'analyse.** Le fichier est enregistré d'abord ;
  si l'analyse échoue, le dépôt reste un succès et le formulaire indique
  simplement que les champs n'ont pas pu être lus.
- **Aucune exception ne remonte** : service en panne, document illisible,
  type inconnu, fichier vide ou trop volumineux (> 4 Mo) donnent un motif
  consultable, jamais une erreur à l'écran.
- **Prudence assumée** : un champ douteux n'est pas proposé. Le BIC n'est
  retenu que s'il figure à côté du mot « BIC » ou « SWIFT » ; les dates
  de plus d'un an sont écartées d'un arrêt de travail (dates de naissance
  imprimées sur le document).
- **Rien n'est stocké par le module d'analyse** : il lit le contenu déjà
  téléversé et rend des champs. Le fichier vit dans la GED du client,
  l'extraction dure le temps de la réponse HTTP.

## Détail technique

- Module : `api/src/ocr.js` (`configuree()`, `analyser()`, extracteurs).
- Branchement : `POST /api/depot?analyser=arret|rib|vitale|identite`
  — la réponse gagne un objet `extraction: { champs }` ou
  `extraction: { champs: null, motif }`. Sans le paramètre, la réponse
  est strictement celle d'avant.
- Doctrine des routes respectée : aucune route nouvelle.
- Banc de vérification : `simu-ocr.js` (30 contrôles — extraction,
  garde-fous, dégradation, branchement du dépôt).
