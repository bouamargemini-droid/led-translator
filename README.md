# LED Translator

Outil local de traduction FR → ZH d'appels d'offres écrans LED (CPS, BPU, DPGF, notes techniques).

- **Entrée** : PDF texte natif, Word (`.docx`), Excel (`.xlsx`)
- **Sortie** : `.docx` et `.xlsx` traduits (fidélité stricte). Les PDF entrants ressortent en `.docx` (conversion Word Mac au besoin).
- **Moteur** : Claude Sonnet 4.6 (API Anthropic) avec glossaire LED verrouillé
- **Stack** : Next.js 16 + SQLite + Docker Compose
- **Local uniquement** : `docker compose up` sur ton Mac, port `3210`

## Setup

1. Cloner
   ```bash
   git clone https://github.com/bouamargemini-droid/led-translator.git
   cd led-translator
   ```

2. Créer `.env` local
   ```bash
   cp .env.example .env
   ```
   Renseigne `ANTHROPIC_API_KEY` (clé Anthropic, console.anthropic.com).

3. Lancer
   ```bash
   docker compose up --build
   ```

4. Ouvrir http://localhost:3210

## Workflow

1. **Créer un lot** (`/`)
   - Donne un nom (ex : "Appel d'offres CPS Casablanca")
   - Optionnel : importe le glossaire d'un lot passé pour cumuler la mémoire terminologique
   - Upload multi-fichiers (docx / xlsx / pdf)

2. **Valider le glossaire** (`/lots/<id>`)
   - Section **Termes extraits** : Claude a proposé une liste de termes techniques du lot. Édite la traduction ZH si besoin, clique "valider" (uniquement les termes validés seront utilisés en traduction).
   - Section **Termes manuels** : ajoute des termes propres à ton contexte (nom du client, technologies spécifiques).
   - Section **Glossaire de base LED** (collapsible) : ~180 termes pré-validés éditables.

3. **Lancer la traduction**
   - Bouton "Lancer la traduction". Traduction Claude batch 10 segments × concurrence 3.
   - Temps typique : 1-5 min pour un lot de 2-3 docs.
   - Pas de barre de progression temps réel — rafraîchis la page.

4. **Télécharger**
   - Par doc individuel ou ZIP complet du lot.

5. **Historique** (`/history`)
   - Retrouve les lots passés, réutilise leur glossaire au prochain lot, supprime les tests.

## Structure

```
src/
├── app/
│   ├── page.tsx              # Formulaire nouveau lot
│   ├── history/              # Historique lots
│   ├── lots/[lotId]/         # Détail lot + validation glossaire
│   ├── actions.ts            # Server Action uploadLot
│   └── api/download/         # Routes téléchargement docs et ZIP
├── lib/
│   ├── anthropic.ts          # Wrapper Claude Sonnet 4.6
│   ├── db/                   # SQLite better-sqlite3 + Drizzle + init
│   ├── glossary/             # Seed LED + extraction candidats + base
│   ├── lots/                 # Orchestration upload
│   ├── parsers/              # docx / xlsx / pdf
│   ├── translate/            # Prompt + batch + pipeline
│   └── reconstruct/          # docx / xlsx / pdf-to-docx
data/                         # SQLite + uploads + outputs (persisté, gitignoré)
docs/PRD-LED-TRANSLATOR.md    # PRD complet
```

## Troubleshooting

**Le container ne démarre pas (`ANTHROPIC_API_KEY missing`)**
Vérifie que `.env` existe à la racine et contient bien `ANTHROPIC_API_KEY=sk-ant-...`. Redémarre avec `docker compose down && docker compose up --build`.

**Erreur `SQLITE_BUSY` ou fichier `data/led-translator.db` corrompu**
Le container tourne peut-être encore. `docker compose down`, puis relance. En dernier recours, supprime `data/led-translator.db*` (perte de l'historique).

**Rate limit Anthropic (429)**
Le wrapper `anthropic.ts` a un retry exponential backoff (3 tentatives). Si tu sature ton quota, attends 1 min ou passe sur une clé avec plafond plus haut.

**Traduction reste sur "translating"**
La Server Action `startTranslationAction` bloque le rendu jusqu'à la fin. Si le container est UP et que ça dure plus de 15 min, regarde `docker compose logs -f app` — il y a probablement une erreur Claude non capturée. Un `docker compose restart app` réinitialise l'état, le lot repassera à `glossary_pending` mais les segments déjà traduits sont conservés (idempotence).

**DOCX de sortie ouvre mal dans Word**
Fais un test avec un DOCX simple d'abord. Le remplacement in-place préserve les styles paragraphe mais casse le formatage intra-paragraphe (bold sur un mot au milieu d'une phrase). Pour les gabarits Unilumin complexes, ouvre le DOCX de sortie et vérifie visuellement.

**PDF entrant : segmentation étrange (mots collés, sauts de ligne aléatoires)**
`pdf-parse` extrait le texte tel qu'il est encodé dans le PDF (souvent pas dans l'ordre visuel). Si un PDF pose problème, ouvre-le dans Word Mac (Word convertit automatiquement PDF → DOCX), puis uploade le DOCX obtenu.

## Checklist qualité avant envoi au fournisseur

- [ ] Passer en revue les termes extraits, corriger les traductions ZH douteuses avant "Lancer traduction"
- [ ] Ouvrir chaque doc traduit et lire les 2-3 premières pages
- [ ] Vérifier que les nombres, unités (mm, W, nits) et références produit sont **inchangés**
- [ ] Vérifier qu'aucun terme du glossaire n'a été traduit autrement que la valeur imposée
- [ ] Pour les BPU/DPGF Excel : vérifier que les cellules numériques et formules sont intactes
- [ ] Pour les DOCX complexes avec tableaux imbriqués : test visuel de la mise en page
- [ ] Convertir les DOCX (issus de PDF) en PDF via Word Mac avant envoi si le fournisseur attend du PDF

## PRD

Voir [`docs/PRD-LED-TRANSLATOR.md`](docs/PRD-LED-TRANSLATOR.md) — décisions verrouillées, périmètre, phasage, risques.

## Statut

- Phase 1 — Foundation ✅
- Phase 2 — Ingestion + extraction glossaire ✅
- Phase 3 — Validation glossaire + traduction + reconstruction ✅
- Phase 4 — Historique + polish ✅

## Roadmap V1.x (hors V1)

- OCR pour PDF scannés (Claude vision ou Tesseract)
- Barre de progression temps réel (SSE ou polling)
- Monitoring coût tokens Claude par lot
- Traduction bilingue côte à côte (mode "revue interne")
- Intégration CRM Go (base Supabase, RLS, RPC)
- Autres langues (EN, AR, ES)
- Autres fournisseurs (glossaires additionnels)
