import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { deleteLotAction } from "./actions";

export default async function HistoryPage() {
  const lots = db.select().from(schema.lots).orderBy(desc(schema.lots.createdAt)).all();

  const rows = lots.map((lot) => {
    const docs = db
      .select({ id: schema.documents.id, status: schema.documents.status })
      .from(schema.documents)
      .where(eq(schema.documents.lotId, lot.id))
      .all();
    const validated = db
      .select({ id: schema.glossaryTerms.id })
      .from(schema.glossaryTerms)
      .where(eq(schema.glossaryTerms.lotId, lot.id))
      .all();
    return {
      lot,
      docsCount: docs.length,
      docsDone: docs.filter((d) => d.status === "reconstructed").length,
      glossarySize: validated.length,
    };
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Historique des lots</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Tous les lots traduits. Tu peux réutiliser leur glossaire validé au moment de créer un
          nouveau lot depuis la page d'accueil.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border)] rounded-lg p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            Aucun lot pour l'instant. Retourne à la page d'accueil pour en créer un.
          </p>
          <a
            href="/"
            className="mt-4 inline-block text-sm rounded bg-[var(--color-accent)] px-4 py-2 text-black hover:opacity-90"
          >
            Créer un lot
          </a>
        </div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface)] text-[var(--color-muted)] text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Lot</th>
                <th className="text-left px-4 py-2">Créé le</th>
                <th className="text-left px-4 py-2">Statut</th>
                <th className="text-left px-4 py-2">Docs</th>
                <th className="text-left px-4 py-2">Glossaire</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lot, docsCount, docsDone, glossarySize }) => (
                <tr key={lot.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2">
                    <a
                      href={`/lots/${lot.id}`}
                      className="font-medium hover:text-[var(--color-accent)] hover:underline"
                    >
                      {lot.name}
                    </a>
                    <div className="text-[10px] text-[var(--color-muted)] font-mono truncate max-w-[280px]">
                      {lot.id}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(lot.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={lot.status} />
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {docsDone} / {docsCount}
                  </td>
                  <td className="px-4 py-2 text-xs">{glossarySize} termes</td>
                  <td className="px-4 py-2 text-right space-x-3">
                    <a
                      href={`/lots/${lot.id}`}
                      className="text-xs text-[var(--color-muted)] hover:text-white"
                    >
                      Ouvrir
                    </a>
                    {lot.status === "done" && (
                      <a
                        href={`/api/download/lot/${lot.id}`}
                        className="text-xs text-[var(--color-accent)] hover:opacity-80"
                      >
                        ZIP
                      </a>
                    )}
                    <form action={deleteLotAction} className="inline">
                      <input type="hidden" name="lotId" value={lot.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-400 hover:text-red-300"
                        aria-label="Supprimer le lot"
                      >
                        Suppr
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  return <span className={`text-xs ${map[status] ?? "text-neutral-400"}`}>{status}</span>;
}
