export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Nouveau lot de traduction</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          Dépose des documents FR (PDF texte, Word, Excel). L'outil extrait les termes techniques
          LED, tu valides le glossaire, puis la traduction est appliquée.
        </p>
      </section>

      <section
        className="border border-dashed border-[var(--color-border)] rounded-lg p-12 text-center"
        aria-label="Zone de dépôt"
      >
        <p className="text-sm text-[var(--color-muted)]">
          Zone de dépôt (Phase 2) — l'upload multi-fichiers arrive à la prochaine phase.
        </p>
      </section>

      <section className="text-xs text-[var(--color-muted)] border-t border-[var(--color-border)] pt-4">
        Phase 1 — Foundation OK. Prochaine étape : parsers docx/xlsx/pdf et extraction glossaire.
      </section>
    </div>
  );
}
