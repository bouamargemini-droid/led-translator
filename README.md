# LED Translator

Outil local de traduction FR → ZH d'appels d'offres LED (CPS, BPU, DPGF, notes techniques).

- **Entrée** : PDF (texte natif), Word (`.docx`), Excel (`.xlsx`)
- **Sortie** : `.docx` et `.xlsx` traduits en chinois (fidélité stricte)
- **Moteur** : Claude Sonnet 4.6 avec glossaire LED verrouillé
- **Stack** : Next.js 16 + SQLite + Docker Compose
- **Local uniquement** : docker compose up sur ton Mac, port 3210

## Setup

1. Cloner le repo
   ```bash
   git clone https://github.com/bouamargemini-droid/led-translator.git
   cd led-translator
   ```

2. Créer `.env` local depuis le template
   ```bash
   cp .env.example .env
   ```
   Remplir `ANTHROPIC_API_KEY` avec ta clé Anthropic.

3. Lancer
   ```bash
   docker compose up --build
   ```

4. Ouvrir http://localhost:3210

## Structure

- `src/app/` — pages Next.js (upload, glossaire, historique)
- `src/lib/anthropic.ts` — wrapper Claude Sonnet 4.6
- `src/lib/db/` — schéma SQLite Drizzle + migrations
- `src/lib/parsers/` — docx / xlsx / pdf (Phase 2)
- `src/lib/translate/` — segmentation + injection glossaire (Phase 3)
- `src/lib/glossary/` — extraction + seed LED (Phase 2)
- `data/` — SQLite + uploads (persisté, gitignoré)
- `docs/PRD-LED-TRANSLATOR.md` — PRD complet

## PRD

Voir [`docs/PRD-LED-TRANSLATOR.md`](docs/PRD-LED-TRANSLATOR.md).

## Statut

- Phase 1 — Foundation ✅
- Phase 2 — Ingestion + extraction glossaire ⏳
- Phase 3 — Validation glossaire + traduction + reconstruction ⏳
- Phase 4 — Historique + polish ⏳
