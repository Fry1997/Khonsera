import { createClient } from "@/lib/supabase/server";
import { AppScreen } from "@/components/ui/page-shell";
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
    <AppScreen eyebrow="People" title="People">
      <ContactsScreen initial={contacts} />
    </AppScreen>
  );
}
