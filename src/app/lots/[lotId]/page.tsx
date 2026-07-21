import { db, schema } from "@/lib/db/client";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

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

  const candidates = db
    .select()
    .from(schema.glossaryTerms)
    .where(
      and(eq(schema.glossaryTerms.lotId, lotId), eq(schema.glossaryTerms.source, "extracted")),
    )
    .all();

  const parsedDocs = documents.filter((d) => d.status === "parsed" || d.status === "translated");
  const errorDocs = documents.filter((d) => d.status === "error");

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{lot.name}</h2>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              Statut : {lot.status} — créé le {new Date(lot.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <a href="/" className="text-sm text-[var(--color-muted)] hover:text-white">
            ← Nouveau lot
          </a>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Documents ingérés ({parsedDocs.length})</h3>
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between border border-[var(--color-border)] rounded-md px-4 py-3 bg-[var(--color-surface)]"
            >
              <span className="text-sm truncate">{d.filename}</span>
              <span className="text-xs text-[var(--color-muted)]">
                {(d.size / 1024).toFixed(1)} Ko — {d.status}
              </span>
            </li>
          ))}
        </ul>
        {errorDocs.length > 0 && (
          <p className="mt-3 text-xs text-red-400">
            {errorDocs.length} document(s) en erreur — cf. logs serveur.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">
          Termes candidats extraits ({candidates.length})
        </h3>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          Ces termes seront édités et validés dans l'UI dédiée en Phase 3. Pour l'instant,
          affichage brut.
        </p>
        {candidates.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Aucun candidat (soit tout est déjà dans le glossaire de base, soit l'extraction a
            échoué).
          </p>
        ) : (
          <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface)] text-[var(--color-muted)] text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Terme FR</th>
                  <th className="text-left px-4 py-2">Traduction ZH proposée</th>
                  <th className="text-left px-4 py-2">Raison</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-2">{c.termFr}</td>
                    <td className="px-4 py-2">{c.termZh}</td>
                    <td className="px-4 py-2 text-xs text-[var(--color-muted)]">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] pt-4">
        Phase 3 (à venir) : validation interactive du glossaire + traduction Claude + reconstruction
        docx/xlsx.
      </section>
    </div>
  );
}
