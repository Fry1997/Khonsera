import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

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
  isAdmin: boolean;
  workspaceId: string;
};

export const requireUserContext = cache(
  async (): Promise<CurrentUserContext> => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, is_staff, is_admin, default_workspace_id")
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
      isAdmin: profile.is_admin,
      workspaceId: profile.default_workspace_id,
    };
  },
);
