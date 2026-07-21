import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { uploadLotAction } from "./actions";

export default async function HomePage() {
  const pastLots = db
    .select({ id: schema.lots.id, name: schema.lots.name, createdAt: schema.lots.createdAt })
    .from(schema.lots)
    .orderBy(desc(schema.lots.createdAt))
    .limit(20)
    .all();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Nouveau lot de traduction</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Dépose des documents FR (PDF texte, Word, Excel). L'outil extrait les termes techniques
          LED, tu valides le glossaire à l'étape suivante, puis la traduction est appliquée.
        </p>
      </section>

      <form action={uploadLotAction} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nom du lot
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Ex : Appel d'offres CPS Casablanca — Écran salle plénière"
            className="w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>

        <div>
          <label htmlFor="sourceLotId" className="block text-sm font-medium mb-2">
            Importer le glossaire d'un lot passé (optionnel)
          </label>
          <select
            id="sourceLotId"
            name="sourceLotId"
            className="w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="">— Aucun (démarrer avec le glossaire de base seulement)</option>
            {pastLots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {new Date(l.createdAt).toLocaleDateString("fr-FR")}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Les termes validés (extraits + manuels) du lot sélectionné seront copiés dans le
            nouveau lot avec le statut « validé ».
          </p>
        </div>

        <div>
          <label htmlFor="files" className="block text-sm font-medium mb-2">
            Documents (.docx, .xlsx, .pdf) — multi-sélection
          </label>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            required
            accept=".docx,.xlsx,.pdf"
            className="block w-full text-sm text-[var(--color-muted)] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[var(--color-surface)] file:text-[var(--color-fg)] hover:file:bg-neutral-800 file:cursor-pointer border border-dashed border-[var(--color-border)] rounded-lg p-6"
          />
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            PDF texte natif uniquement (pas de scan). Les PDF ressortiront en .docx traduit (à
            convertir en PDF sous Word Mac au besoin).
          </p>
        </div>

        <button
          type="submit"
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Créer le lot et extraire le glossaire
        </button>
      </form>
    </div>
  );
}
