import { and, eq, isNotNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db/client";
import { GlossaryEditor } from "./GlossaryEditor";
import { startTranslationAction } from "./actions";

type PageProps = { params: Promise<{ lotId: string }> };

export default async function LotPage({ params }: PageProps) {
  const { lotId } = await params;

  const lot = db.select().from(schema.lots).where(eq(schema.lots.id, lotId)).all()[0];
  if (!lot) notFound();

  const documents = db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.lotId, lotId))
    .all();

  const terms = db
    .select()
    .from(schema.glossaryTerms)
    .where(
      or(
        eq(schema.glossaryTerms.lotId, lotId),
        eq(schema.glossaryTerms.source, "base"),
      ),
    )
    .all();

  const translatedCount = documents.reduce((acc, d) => {
    const rows = db
      .select({ id: schema.translations.id })
      .from(schema.translations)
      .where(
        and(
          eq(schema.translations.documentId, d.id),
          isNotNull(schema.translations.textZh),
        ),
      )
      .all();
    return acc + rows.length;
  }, 0);

  const totalSegments = documents.reduce((acc, d) => {
    const rows = db
      .select({ id: schema.translations.id })
      .from(schema.translations)
      .where(eq(schema.translations.documentId, d.id))
      .all();
    return acc + rows.length;
  }, 0);

  const readyForDownload = documents.some((d) => d.status === "reconstructed");
  const isTranslating = lot.status === "translating";
  const isDone = lot.status === "done";
  const isError = lot.status === "error";

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{lot.name}</h2>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Statut : <StatusPill status={lot.status} /> — créé le{" "}
              {new Date(lot.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <a href="/" className="text-sm text-[var(--color-muted)] hover:text-white">
            ← Nouveau lot
          </a>
        </div>
        {isError && lot.error && (
          <p className="mt-3 text-sm text-red-400 border border-red-800 rounded p-3 bg-red-950/30">
            Erreur : {lot.error}
          </p>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Documents ({documents.length})</h3>
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between border border-[var(--color-border)] rounded-md px-4 py-3 bg-[var(--color-surface)]"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{d.filename}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {(d.size / 1024).toFixed(1)} Ko — {d.status}
                  {d.error && <span className="text-red-400 ml-2">— {d.error}</span>}
                </div>
              </div>
              {d.status === "reconstructed" && (
                <a
                  href={`/api/download/${d.id}`}
                  className="ml-3 text-xs rounded bg-[var(--color-accent)] px-3 py-1.5 text-black hover:opacity-90"
                >
                  Télécharger
                </a>
              )}
            </li>
          ))}
        </ul>
        {readyForDownload && (
          <a
            href={`/api/download/lot/${lot.id}`}
            className="mt-4 inline-block text-sm rounded border border-[var(--color-border)] px-4 py-2 hover:bg-[var(--color-surface)]"
          >
            Télécharger tout le lot (ZIP)
          </a>
        )}
      </section>

      {(isTranslating || isDone) && (
        <section className="border border-[var(--color-border)] rounded-md p-4 bg-[var(--color-surface)]">
          <div className="text-sm">
            Segments traduits : <strong>{translatedCount}</strong> / {totalSegments}
          </div>
          {isTranslating && (
            <p className="mt-2 text-xs text-amber-400">
              Traduction en cours... Cette page ne se met pas à jour toute seule. Rafraîchis
              manuellement dans quelques minutes.
            </p>
          )}
        </section>
      )}

      {!isDone && !isTranslating && (
        <section className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Glossaire</h3>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Édite / valide les termes extraits, ajoute des termes manuels. Seuls les termes
              validés (et le glossaire de base) seront injectés dans la traduction.
            </p>
          </div>
          <GlossaryEditor lotId={lot.id} terms={terms} />

          <form action={startTranslationAction} className="pt-6 border-t border-[var(--color-border)]">
            <input type="hidden" name="lotId" value={lot.id} />
            <button
              type="submit"
              className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
            >
              Lancer la traduction
            </button>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              La traduction peut prendre plusieurs minutes selon la taille du lot. La page se
              rechargera automatiquement à la fin.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "text-neutral-400",
    glossary_pending: "text-amber-400",
    translating: "text-blue-400",
    done: "text-emerald-400",
    error: "text-red-400",
  };
  return <span className={map[status] ?? "text-neutral-400"}>{status}</span>;
}
