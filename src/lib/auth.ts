import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export type CurrentUserContext = {
  userId: string;
  email: string;
  fullName: string | null;
  isStaff: boolean;
  workspaceId: string;
};

export async function requireUserContext(): Promise<CurrentUserContext> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_staff, default_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.default_workspace_id) {
    // Profile not provisioned yet — shouldn't happen given the auth trigger,
    // but fail loudly rather than silently using a fake workspace.
    throw new Error("Profile not provisioned");
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    isStaff: profile.is_staff,
    workspaceId: profile.default_workspace_id,
  };
}
