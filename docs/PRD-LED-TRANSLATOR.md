# PRD — LED Translator (FR → ZH, local)

**Version** : 1.0
**Date** : 2026-07-21
**Statut** : Validé 2026-07-21 — V1 livrée (Phases 1→4)
**Auteur** : Adil Bouamar + Claude Code

---

## 1. Contexte

Adil traite des appels d'offres LED (CPS, BPU, DPGF, notes techniques) rédigés en français et doit envoyer des demandes de cotation à des fournisseurs chinois (Unilumin en priorité, autres à terme). La traduction FR→ZH doit être irréprochable sur le vocabulaire technique LED (pixel pitch, cabinet, module, brightness/nits, refresh rate, séries Unilumin BNX/LST/UGN2/UIM3/URMIII/UMini, etc.).

Aujourd'hui : aucun outil dédié, traduction manuelle ou Google Translate → qualité insuffisante, terminologie incohérente entre documents d'un même lot.

Cet outil est un **standalone de test**, complémentaire au CRM Go. **Pas d'intégration CRM Go dans cette V1**. Selon les résultats du test, l'outil pourra être intégré au CRM Go plus tard.

---

## 2. Objectif V1

Fournir un outil local qui, à partir de plusieurs documents FR (PDF texte, Word, Excel), produit les mêmes documents traduits en chinois, avec fidélité stricte de mise en page et cohérence terminologique verrouillée par un glossaire LED validé.

**Critère de succès** : Adil peut envoyer un lot d'appel d'offres traduit à Unilumin sans retouche manuelle sur la terminologie technique.

---

## 3. Utilisateurs

- **Adil (single user local)** : upload, validation glossaire, téléchargement. Pas d'auth, pas de multi-user.

---

## 4. Périmètre V1 (MVP)

### Fonctionnalités incluses

1. **Upload multi-fichiers** : drag & drop, formats acceptés `.docx`, `.xlsx`, `.pdf` (texte natif uniquement).
2. **Extraction glossaire par lot** : Claude Sonnet 4.6 analyse les documents uploadés, extrait les termes techniques LED récurrents, propose une traduction ZH.
3. **Glossaire LED de base préchargé** (SQLite seed) : ~150 termes standards FR/ZH validés (pixel pitch, cabinet, module, nits, refresh rate, viewing angle, calibration, grey level, brightness, contrast ratio, IP rating, séries Unilumin, etc.).
4. **UI de validation glossaire** : table éditable FR/ZH, Adil valide ou corrige chaque terme candidat avant traduction. Termes du glossaire de base pré-validés.
5. **Traduction segment par segment** via Claude Sonnet 4.6 avec system prompt injectant le glossaire validé comme contrainte stricte (le modèle DOIT utiliser la traduction ZH validée pour chaque terme du glossaire, sans variation).
6. **Reconstruction in-place** :
   - `.docx` : remplacement texte dans chaque `<w:t>` en préservant runs, styles, tableaux, images, headers/footers.
   - `.xlsx` : remplacement `cell.value` en préservant formules, formats numériques, styles, images.
   - `.pdf` (entrant) : extraction du texte, traduction, sortie en `.docx` traduit (Adil convertit en PDF sous Word Mac au besoin — décision D7 Option B).
7. **Téléchargement** : bouton par document + bouton "Télécharger tout" (ZIP du lot).
8. **Historique lots** (SQLite persistant) : liste des lots passés (nom, date, nb docs, statut), réouvrir un lot pour réutiliser son glossaire validé sur un nouveau lot.

### Hors périmètre V1

- OCR (PDF scannés) → à ajouter si besoin réel.
- Authentification, multi-user, partage.
- Intégration CRM Go (base Supabase `nfpndtqvlizibbfxlglj`, RPC, RLS).
- Monitoring coût tokens Claude (à ajouter en V1.1 si nécessaire).
- Traduction bilingue côte à côte (mode "revue").
- Traduction inverse ZH→FR.
- Autres langues (EN, AR, ES).
- Export bilingue mémoire de traduction (TMX).
- Fournisseurs autres qu'Unilumin dans le glossaire de base (extensible manuellement).

---

## 5. Architecture technique

### Stack

- **Front + back** : Next.js 16 (App Router, RSC, Server Actions), TypeScript, Tailwind v4, shadcn/ui.
- **Base locale** : SQLite via `better-sqlite3` + Drizzle ORM.
- **LLM** : `@anthropic-ai/sdk`, modèle `claude-sonnet-4-6` (aligné CRM Go).
- **Parsers documents** :
  - `.docx` : `docx` (write) + parsing XML direct via `jszip` + `fast-xml-parser` pour préserver runs.
  - `.xlsx` : `exceljs`.
  - `.pdf` (extraction) : `pdf-parse` ou `pdfjs-dist`.
- **PDF sortant** : Gotenberg (Docker) → conversion `.docx` traduit → `.pdf`. Même stack que CRM Go, Adil connaît.
- **Runtime** : Docker Compose (`app` Next.js + `gotenberg` service).
- **Port local** : `http://localhost:3210` (pour ne pas collisionner avec CRM Go 3000).

### Structure Docker Compose

```
led-translator/
├── docker-compose.yml       # app + gotenberg
├── Dockerfile               # Next.js 16 standalone
├── .env.example             # ANTHROPIC_API_KEY, GOTENBERG_URL
├── data/                    # SQLite + uploads + outputs (volume)
├── docs/PRD-LED-TRANSLATOR.md
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Upload + lot en cours
│   │   ├── glossary/page.tsx        # Validation glossaire du lot actif
│   │   ├── history/page.tsx         # Historique lots
│   │   └── api/                     # Server Actions préférées
│   ├── lib/
│   │   ├── anthropic.ts             # Wrapper Claude
│   │   ├── db/                      # Drizzle schema + client
│   │   ├── parsers/                 # docx.ts, xlsx.ts, pdf.ts
│   │   ├── translate/               # segmentation, prompt, injection glossaire
│   │   ├── glossary/                # extraction candidats + seed LED
│   │   └── gotenberg.ts             # client convert docx→pdf
│   └── components/                  # shadcn/ui + Dropzone + GlossaryTable
└── package.json
```

### Schéma SQLite (Drizzle)

```ts
lots            // id, name, created_at, status (draft|glossary_pending|translating|done|error)
documents       // id, lot_id, filename, mime, size, path_in, path_out, status, error
glossary_terms  // id, term_fr, term_zh, source (base|extracted|user), validated, notes
lot_glossary    // lot_id, term_id (many-to-many, snapshot du glossaire validé au moment de la traduction)
translations    // id, document_id, segment_index, text_fr, text_zh, tokens_in, tokens_out
```

### Flux applicatif

```
1. Upload docs → Server Action crée lot + persiste fichiers dans data/uploads/<lot_id>/
2. Parse chaque doc → extrait segments (paragraphes/cellules) → stocke segments FR
3. Extraction glossaire :
   - Concatène échantillons de tous les docs
   - Prompt Claude "extract LED technical terms + suggest ZH"
   - Merge avec glossaire de base (base pré-validé, extraits à valider)
4. UI validation glossaire :
   - Table FR/ZH avec statut validé/en attente
   - Adil édite/valide/supprime
   - Bouton "Lancer la traduction"
5. Traduction :
   - Snapshot glossaire validé dans lot_glossary
   - Pour chaque segment : appel Claude avec system prompt = glossaire injecté
   - Persiste text_zh dans translations
6. Reconstruction :
   - docx : rouvrir original, remplacer chaque w:t par sa traduction
   - xlsx : rouvrir original, remplacer chaque cell.value texte
   - pdf : générer docx traduit puis appel Gotenberg /forms/libreoffice/convert
7. Téléchargement : /api/download/<document_id> ou /api/download/lot/<lot_id> (ZIP)
```

### Prompt système traduction (extrait)

```
Tu es un traducteur technique spécialisé dans les écrans LED grand format.
Tu traduis du français vers le chinois simplifié (zh-CN).
Tu DOIS respecter à la lettre le glossaire suivant, sans aucune variation :

[GLOSSAIRE_INJECTÉ]
- pixel pitch → 像素间距
- cabinet → 箱体
- module → 模组
- ...

Contraintes :
- Ne traduis JAMAIS un terme du glossaire autrement que la valeur ZH imposée.
- Préserve les nombres, unités (mm, W, kg, nits, Hz), références produit (BNX2.5, UMini0.9), URL, emails.
- Style : professionnel, technique, adapté à un devis fournisseur chinois.
- Réponds UNIQUEMENT avec la traduction, sans commentaire.
```

---

## 6. Décisions verrouillées

| # | Décision | Justification |
|---|----------|---------------|
| D1 | Moteur : Claude Sonnet 4.6 (cloud API) | Qualité FR→ZH technique très supérieure à Qwen local. App reste locale, seul le texte transite via API. |
| D2 | Fidélité stricte in-place (pas de bilingue V1) | Livrable envoyable directement au fournisseur. Bilingue déportable en V1.x si besoin. |
| D3 | Glossaire LED préchargé + extraction auto par lot | Meilleur ratio qualité/effort. Glossaire de base ~150 termes seed + enrichissement automatique. |
| D4 | Stack Next.js 16 + Docker Compose | Cohérent stack CRM Go, facilite intégration future. |
| D5 | PDF texte natif uniquement | Simplifie V1. OCR ajoutable si cas réel apparaît. |
| D6 | Historique persistant SQLite | Réutilisation glossaires validés cross-lots = gain qualité cumulatif. |
| D7 | Gotenberg pour docx→pdf | Même stack que CRM Go, Adil connaît, robuste. LibreOffice headless écarté (plus lourd à empaqueter). |
| D8 | Repo dédié `bouamargemini-droid/led-translator` (privé) | Standalone, séparé de CRM Go, permet pivot ou abandon sans impact. |
| D9 | Port local `3210` | Évite collision CRM Go (3000). |
| D10 | Pas d'auth | Single user local, machine perso. |

---

## 7. Phasage (~4 jours)

### Phase 1 — Foundation (0.5j)
- Init Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui
- `docker-compose.yml` : services `app` + `gotenberg`
- Drizzle + SQLite + migration initiale (5 tables)
- Wrapper `lib/anthropic.ts` (client Sonnet 4.6, retry, log tokens)
- Route `/` avec dropzone shadcn
- `.env.example` + README quickstart

**Livrable** : `docker compose up` → `localhost:3210` upload possible, sauvegarde en base.

### Phase 2 — Ingestion + extraction glossaire (1j)
- Parsers `docx`/`xlsx`/`pdf` → segments FR
- Seed glossaire LED de base (~150 termes FR/ZH validés manuellement dans une migration)
- Extraction candidats via Claude (prompt dédié, retour JSON strict)
- Persistance `glossary_terms` avec `source=extracted, validated=false`

**Livrable** : upload → lot créé → segments extraits → candidats glossaire proposés.

### Phase 3 — Validation glossaire + traduction + reconstruction (2j)
- Page `/glossary/[lotId]` : table shadcn éditable (FR readonly, ZH éditable, statut, notes)
- Bouton "Lancer traduction" → snapshot `lot_glossary`
- Boucle traduction segments avec injection glossaire (parallélisation 5 segments/batch)
- Reconstruction :
  - `docx` : XML manipulation `<w:t>` (test critique sur préservation runs)
  - `xlsx` : `exceljs` cellules texte
  - `pdf` : docx traduit → Gotenberg `/forms/libreoffice/convert` → PDF
- Route `/api/download/[docId]` + `/api/download/lot/[lotId]` (JSZip)

**Livrable** : lot complet traduit et téléchargeable en un clic.

### Phase 4 — Historique + polish (0.5j)
- Page `/history` : liste lots (nom, date, nb docs, statut)
- Bouton "Réutiliser glossaire" → clone termes validés d'un lot passé dans le nouveau
- README complet (setup, `.env`, troubleshooting)
- Bouton "Nouveau lot" clairement visible

**Livrable** : outil utilisable sur plusieurs appels d'offres successifs.

---

## 8. Risques et parades

| Risque | Impact | Parade |
|--------|--------|--------|
| Fidélité DOCX cassée (runs éclatés) | Élevé | Test dès Phase 3 sur 3 CPS réels avant de finaliser. Fallback : replacement par paragraph si run trop fragmenté. |
| Coût Claude élevé sur gros CPS | Moyen | Chunking segments + batch prompt. Log tokens/lot. Alerter dans V1.1 si >20$/lot. |
| Gotenberg convert altère mise en page | Moyen | Tester tôt (Phase 1). Alternative : renvoyer le DOCX traduit seulement, laisser Adil convertir sous Word Mac. |
| Glossaire de base incorrect | Élevé | Adil valide la seed avant Phase 3 (revue collaborative en Phase 2). |
| Rate limit Anthropic sur gros lot | Faible | Retry exponential backoff dans wrapper. |
| Fuite doc confidentiel côté API | Résiduel | Anthropic ne stocke pas les prompts API par défaut. À valider par Adil (SLA). |

---

## 9. Ops externes (Adil)

Avant démarrage Phase 1 :
- [ ] Valider le PRD
- [ ] Fournir clé API Anthropic (`ANTHROPIC_API_KEY`) à ajouter dans `.env` local (fichier ignoré par git)
- [ ] Confirmer emplacement `data/` (volume Docker Compose)

Avant démarrage Phase 3 :
- [ ] Fournir 2-3 CPS/BPU réels FR (anonymisés ou non) pour tester la fidélité DOCX
- [ ] Revue de la seed glossaire LED (~150 termes) proposée en Phase 2

---

## 10. Actions demandées maintenant

1. Valider ou amender ce PRD (décisions §6, phasage §7, hors périmètre §4).
2. Confirmer la clé API Anthropic disponible.
3. Trancher : Gotenberg dans le docker-compose (défaut) OU renvoyer seulement le DOCX traduit et laisser Adil convertir en PDF sous Word Mac (plus simple, zéro dépendance) ?

Une fois validé, on démarre Phase 1.
