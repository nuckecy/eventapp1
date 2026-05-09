"use client";

// Scripture admin editor — list + add + edit + soft-disable + delete.

import { Plus, Trash2, Power, Edit3, Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/cem/toast";
import {
  createScriptureAction,
  deleteScriptureAction,
  updateScriptureAction,
} from "@/lib/cem/scripture-actions";

type Row = {
  id: string;
  reference: string;
  default_translation: string;
  theme: string | null;
  active: boolean;
  created_at: string | null;
};

const THEMES = ["faith", "grace", "spirit", "hope", "love", "peace", "joy"];

export function ScripturesClient({
  rows,
  availableTranslations,
}: {
  rows: Row[];
  availableTranslations: Array<{ id: string; name: string }>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Partial<Row>>({});
  const [adding, setAdding] = useState(false);
  const [newRef, setNewRef] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [newTranslation, setNewTranslation] = useState(
    availableTranslations[0]?.id ?? "KJV",
  );
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Group by theme for visual organisation.
  const byTheme = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.theme ?? "(no theme)";
    if (!byTheme.has(k)) byTheme.set(k, []);
    byTheme.get(k)!.push(r);
  }
  const themeKeys = Array.from(byTheme.keys()).sort();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newRef.trim()) return;
    setBusyId("__new__");
    const r = await createScriptureAction({
      reference: newRef.trim(),
      theme: newTheme.trim() || null,
      default_translation: newTranslation,
      active: true,
    });
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", "Scripture added.");
    setNewRef("");
    setNewTheme("");
    setAdding(false);
    startTransition(() => router.refresh());
  }

  async function handleToggle(row: Row) {
    setBusyId(row.id);
    const r = await updateScriptureAction({
      id: row.id,
      active: !row.active,
    });
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", row.active ? "Disabled." : "Enabled.");
    startTransition(() => router.refresh());
  }

  async function handleDelete(row: Row) {
    if (
      !window.confirm(
        `Delete "${row.reference}"? This removes it from the rotation permanently. To temporarily hide, use the disable button instead.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    const r = await deleteScriptureAction(row.id);
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", "Deleted.");
    startTransition(() => router.refresh());
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditPatch({
      reference: row.reference,
      theme: row.theme,
      default_translation: row.default_translation,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPatch({});
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusyId(editingId);
    const r = await updateScriptureAction({
      id: editingId,
      reference: editPatch.reference,
      theme: editPatch.theme ?? null,
      default_translation: editPatch.default_translation,
    });
    setBusyId(null);
    if (!r.ok) {
      toast.show("error", humanError(r.error));
      return;
    }
    toast.show("success", "Updated.");
    cancelEdit();
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium leading-tight">
            Daily Scripture
          </h1>
          <p className="mt-1 max-w-[600px] text-[13px] text-cal-text-secondary">
            Curate the references shown on the login page. The verse text is
            fetched from the active provider in real time, so only the
            reference is stored here. Disable verses to temporarily hide them
            from the rotation; delete to remove permanently.
          </p>
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add scripture
          </button>
        ) : null}
      </header>

      {availableTranslations.length === 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-[color:var(--cal-status-pending-border,#fde68a)] bg-[color:var(--cal-status-pending-bg,#fffbeb)] px-4 py-3 text-[13px] text-[color:var(--cal-status-pending-text,#854d0e)]"
        >
          No scripture provider is currently configured. Set{" "}
          <code className="rounded bg-cal-bg-muted px-1 text-[12px]">
            BIBLE_API_KEY
          </code>{" "}
          (for modern translations) or rely on the bundled bible-api.com
          provider for KJV / WEB / ASV. The login page will show a fallback
          verse until at least one translation is available.
        </div>
      ) : null}

      {adding ? (
        <section className="mb-8 rounded-lg border border-cal-border bg-cal-card-bg p-5">
          <h2 className="font-display text-[16px] font-medium">
            New scripture
          </h2>
          <form onSubmit={handleAdd} className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="block text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
                Reference
              </span>
              <input
                type="text"
                value={newRef}
                onChange={(e) => setNewRef(e.target.value)}
                placeholder="John 3:16  (or Romans 8:38-39)"
                maxLength={64}
                required
                className="mt-1 block w-full rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text placeholder:text-cal-text-muted focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
                Theme
              </span>
              <input
                type="text"
                list="theme-list"
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                maxLength={32}
                placeholder="faith"
                className="mt-1 block w-full rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
              />
              <datalist id="theme-list">
                {THEMES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
                Default translation
              </span>
              <select
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-cal-border bg-cal-bg px-3 py-2 text-[13px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
              >
                {availableTranslations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} — {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2 sm:col-span-3">
              <button
                type="submit"
                disabled={busyId === "__new__"}
                className="inline-flex h-9 items-center rounded-lg bg-cal-brand px-4 text-[13px] font-medium text-cal-bg transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busyId === "__new__" ? "Adding…" : "Add to rotation"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewRef("");
                  setNewTheme("");
                }}
                className="inline-flex h-9 items-center rounded-lg border border-cal-border bg-transparent px-4 text-[13px] font-medium text-cal-text transition-colors hover:bg-cal-bg-muted"
              >
                Cancel
              </button>
              <span className="ml-auto text-[11px] text-cal-text-muted">
                We verify the reference resolves before saving.
              </span>
            </div>
          </form>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-cal-text-secondary">
          Current rotation ({rows.filter((r) => r.active).length} active /{" "}
          {rows.length} total)
        </h2>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-cal-border bg-cal-card-bg px-6 py-12 text-center text-[13px] text-cal-text-muted">
            No scriptures curated yet. The login page will use a fallback
            verse until you add some.
          </div>
        ) : (
          <div className="space-y-6">
            {themeKeys.map((theme) => (
              <div key={theme}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-cal-text-secondary">
                  {theme}
                </h3>
                <ul className="overflow-hidden rounded-lg border border-cal-border bg-cal-card-bg">
                  {byTheme.get(theme)!.map((row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <li
                        key={row.id}
                        className={`flex flex-wrap items-center gap-3 border-b border-cal-border px-5 py-2.5 last:border-b-0 ${
                          row.active ? "" : "opacity-60"
                        }`}
                      >
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editPatch.reference ?? ""}
                              onChange={(e) =>
                                setEditPatch((p) => ({
                                  ...p,
                                  reference: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-0 rounded-lg border border-cal-border bg-cal-bg px-2.5 py-1.5 text-[13px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
                            />
                            <input
                              type="text"
                              value={editPatch.theme ?? ""}
                              onChange={(e) =>
                                setEditPatch((p) => ({
                                  ...p,
                                  theme: e.target.value || null,
                                }))
                              }
                              placeholder="theme"
                              maxLength={32}
                              list="theme-list"
                              className="w-[120px] rounded-lg border border-cal-border bg-cal-bg px-2.5 py-1.5 text-[12px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
                            />
                            <select
                              value={editPatch.default_translation ?? "KJV"}
                              onChange={(e) =>
                                setEditPatch((p) => ({
                                  ...p,
                                  default_translation: e.target.value,
                                }))
                              }
                              className="rounded-lg border border-cal-border bg-cal-bg px-2 py-1.5 text-[12px] text-cal-text focus:border-cal-accent focus:outline-none focus:ring-2 focus:ring-cal-accent/15"
                            >
                              {availableTranslations.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.id}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={busyId === row.id}
                              title="Save"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              title="Cancel"
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-[13px] text-cal-text">
                                {row.reference}
                              </div>
                              <div className="text-[11px] text-cal-text-muted">
                                Default: {row.default_translation}
                                {row.active ? "" : " · disabled"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                title="Edit"
                                aria-label="Edit"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                              >
                                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggle(row)}
                                disabled={busyId === row.id}
                                title={row.active ? "Disable" : "Enable"}
                                aria-label={row.active ? "Disable" : "Enable"}
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-cal-text"
                              >
                                <Power className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                disabled={busyId === row.id}
                                title="Delete"
                                aria-label="Delete"
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-cal-text-muted transition-colors hover:bg-cal-bg-muted hover:text-[color:var(--cal-status-deleted-text)]"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function humanError(err: string): string {
  switch (err) {
    case "unauthorized":
      return "Your session expired.";
    case "forbidden":
      return "Super admin only.";
    case "reference_could_not_resolve":
      return "Reference couldn't be found in the chosen translation. Check spelling.";
    default:
      // Surface Zod messages as-is — they're already friendly.
      return err.length > 0 && err.length < 120 ? err : "Couldn't save. Try again.";
  }
}
