import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { ContactsScreen } from "@/components/contacts/contacts-screen";
import type { ContactVM } from "@/components/concierge";

// Contacts (handover §4.8) — people Khonsera can reach (running-late notes, ETAs).
// Mode-scoped; personal contacts stay in personal scope at the data layer (RLS).
export default async function ContactsPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("contacts")
    .select("id, name, email, phone, role")
    .eq("workspace_id", ctx.workspaceId)
    .eq("mode", ctx.activeMode)
    .order("name", { ascending: true });

  const contacts: ContactVM[] = (data ?? []).map((c) => {
    const phone = c.phone as string | null;
    const email = c.email as string | null;
    return {
      id: c.id as string,
      name: c.name as string,
      channel: phone ? "phone" : email ? "email" : undefined,
      detail: phone ?? email ?? (c.role as string | null) ?? undefined,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <header>
        <span className="eyebrow" style={{ color: "var(--gold-2)" }}>
          {ctx.activeMode === "work" ? "Work" : "Personal"} · People
        </span>
        <h1 className="h1" style={{ marginTop: 6 }}>
          Contacts
        </h1>
        <p className="small" style={{ marginTop: 8, maxWidth: "56ch" }}>
          The people tied to your days. When you&apos;re running late, Khonsera can
          let them know.
        </p>
      </header>

      <ContactsScreen initial={contacts} />
    </div>
  );
}
