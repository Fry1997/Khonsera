"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNote, updateNote, deleteNote, type NoteVM, type NoteKind } from "@/lib/actions/notes";

// Prep + outcome notes on a commitment (Phase 3). Prep is what you write before
// (agenda, who, what to bring); outcome is what you record after. For work, an
// outcome note can be made org-reviewable — personal notes never can (enforced in
// RLS + the action; the checkbox just surfaces the choice).
export function NotesPanel({
  stopId,
  itineraryId,
  isWork,
  notes,
}: {
  stopId: string;
  itineraryId: string;
  isWork: boolean;
  notes: NoteVM[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<NoteKind>("prep");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [share, setShare] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setKind("prep"); setTitle(""); setBody(""); setShare(false); setAdding(false); setError(null);
  }

  function save() {
    if (!title.trim() && !body.trim()) { setError("Write something first."); return; }
    setPending(true);
    void createNote({
      itineraryId,
      stopId,
      kind,
      title: title || null,
      body: body || null,
      visibility: isWork && kind === "outcome" && share ? "org_reviewable" : "private",
    }).then((res) => {
      setPending(false);
      if (!res.ok) { setError(res.error ?? "Couldn't save."); return; }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    setPending(true);
    void deleteNote(id, itineraryId).then(() => { setPending(false); router.refresh(); });
  }

  return (
    <div className="cc-notes">
      <button type="button" className="cc-notes-toggle" onClick={() => setOpen((v) => !v)}>
        {notes.length > 0 ? `Notes · ${notes.length}` : "Add a note"}
      </button>

      {open ? (
        <div className="cc-notes-body">
          {notes.map((n) => (
            <div key={n.id} className="cc-note">
              <div className="cc-note-head">
                <span className="cc-note-kind" data-kind={n.kind}>{n.kind === "prep" ? "Prep" : "Outcome"}</span>
                {n.visibility === "org_reviewable" ? <span className="cc-note-shared">Shared with work</span> : null}
                <button type="button" className="cc-note-del" onClick={() => remove(n.id)} disabled={pending} aria-label="Delete note">×</button>
              </div>
              {n.title ? <div className="cc-note-title">{n.title}</div> : null}
              {n.body ? <div className="cc-note-text">{n.body}</div> : null}
            </div>
          ))}

          {adding ? (
            <div className="cc-note-form">
              <div className="cc-kind-row">
                <button type="button" className="cc-kind-chip" data-active={kind === "prep" ? "" : undefined} onClick={() => setKind("prep")}>Prep</button>
                <button type="button" className="cc-kind-chip" data-active={kind === "outcome" ? "" : undefined} onClick={() => setKind("outcome")}>Outcome</button>
              </div>
              <input className="field" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
              <textarea className="field" value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "prep" ? "Agenda, who you're seeing, what to bring…" : "What happened, decisions, follow-ups…"} style={{ minHeight: 72, resize: "vertical" }} />
              {isWork && kind === "outcome" ? (
                <label className="cc-note-share">
                  <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
                  Make this outcome reviewable by the workspace
                </label>
              ) : null}
              {error ? <p className="cc-sheet-error">{error}</p> : null}
              <div className="cc-note-actions">
                <button type="button" className="cc-btn cc-btn-ghost" onClick={reset} disabled={pending}>Cancel</button>
                <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save note"}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="cc-btn cc-btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>
              + Note
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
