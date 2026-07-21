"use client";

import { useState, useTransition } from "react";
import {
  updateTermAction,
  addManualTermAction,
  removeTermAction,
  rejectExtractedAction,
} from "./actions";

type Term = {
  id: string;
  termFr: string;
  termZh: string;
  source: string;
  validated: boolean;
  notes: string | null;
};

export function GlossaryEditor({
  lotId,
  terms,
}: {
  lotId: string;
  terms: Term[];
}) {
  const baseTerms = terms.filter((t) => t.source === "base");
  const extractedTerms = terms.filter((t) => t.source === "extracted");
  const userTerms = terms.filter((t) => t.source === "user");

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-semibold">
            Termes extraits du lot ({extractedTerms.length})
          </h3>
          {extractedTerms.length > 0 && (
            <form action={rejectExtractedAction}>
              <input type="hidden" name="lotId" value={lotId} />
              <button
                type="submit"
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                Supprimer tous les extraits non validés
              </button>
            </form>
          )}
        </div>
        <TermTable lotId={lotId} rows={extractedTerms} editable canValidate />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">
          Termes ajoutés manuellement ({userTerms.length})
        </h3>
        <TermTable lotId={lotId} rows={userTerms} editable canValidate={false} />
        <AddManualTermForm lotId={lotId} />
      </div>

      <details className="border border-[var(--color-border)] rounded-md">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Glossaire de base LED ({baseTerms.length}) — pré-validé, éditable
        </summary>
        <div className="p-4 border-t border-[var(--color-border)]">
          <TermTable lotId={lotId} rows={baseTerms} editable={false} canValidate={false} />
        </div>
      </details>
    </div>
  );
}

function TermTable({
  lotId,
  rows,
  editable,
  canValidate,
}: {
  lotId: string;
  rows: Term[];
  editable: boolean;
  canValidate: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)] italic">Aucun terme dans cette section.</p>
    );
  }
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface)] text-[var(--color-muted)] text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2 w-1/3">Terme FR</th>
            <th className="text-left px-4 py-2 w-1/3">Traduction ZH</th>
            <th className="text-left px-4 py-2">Statut</th>
            {editable && <th className="text-right px-4 py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TermRow
              key={row.id}
              lotId={lotId}
              row={row}
              editable={editable}
              canValidate={canValidate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TermRow({
  lotId,
  row,
  editable,
  canValidate,
}: {
  lotId: string;
  row: Term;
  editable: boolean;
  canValidate: boolean;
}) {
  const [zh, setZh] = useState(row.termZh);
  const [validated, setValidated] = useState(row.validated);
  const [pending, startTransition] = useTransition();

  const persist = (nextValidated: boolean) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("termId", row.id);
      fd.set("lotId", lotId);
      fd.set("termZh", zh);
      fd.set("validated", nextValidated ? "1" : "0");
      await updateTermAction(fd);
      setValidated(nextValidated);
    });
  };

  const remove = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("termId", row.id);
      fd.set("lotId", lotId);
      await removeTermAction(fd);
    });
  };

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-4 py-2 align-top">{row.termFr}</td>
      <td className="px-4 py-2">
        {editable ? (
          <input
            value={zh}
            onChange={(e) => setZh(e.target.value)}
            onBlur={() => persist(validated)}
            className="w-full bg-transparent border border-[var(--color-border)] rounded px-2 py-1"
          />
        ) : (
          <span>{row.termZh}</span>
        )}
      </td>
      <td className="px-4 py-2 align-top">
        {validated ? (
          <span className="text-emerald-400 text-xs">✓ validé</span>
        ) : (
          <span className="text-amber-400 text-xs">en attente</span>
        )}
        {row.notes && (
          <div className="text-[10px] text-[var(--color-muted)] mt-1">{row.notes}</div>
        )}
      </td>
      {editable && (
        <td className="px-4 py-2 text-right align-top space-x-3">
          {canValidate && (
            <button
              type="button"
              onClick={() => persist(!validated)}
              disabled={pending}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              {validated ? "dévalider" : "valider"}
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-xs text-red-400 hover:text-red-300"
          >
            suppr
          </button>
        </td>
      )}
    </tr>
  );
}

function AddManualTermForm({ lotId }: { lotId: string }) {
  return (
    <form action={addManualTermAction} className="mt-4 flex gap-2 items-end">
      <input type="hidden" name="lotId" value={lotId} />
      <div className="flex-1">
        <label className="block text-xs text-[var(--color-muted)] mb-1">Terme FR</label>
        <input
          name="termFr"
          required
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-sm"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs text-[var(--color-muted)] mb-1">Traduction ZH</label>
        <input
          name="termZh"
          required
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-sm"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1 text-sm hover:bg-neutral-800"
      >
        Ajouter
      </button>
    </form>
  );
}
