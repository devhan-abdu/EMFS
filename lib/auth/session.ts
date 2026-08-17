import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/auth";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";

export type CurrentUser = {
  authUserId: string;
  email: string;
  profile: Profile;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.authUserId, session.user.id),
  });


  if (!profile) {
    throw new Error(
      `No profile found for authenticated user ${session.user.id}. Check the databaseHooks.user.create hook in lib/auth/auth.ts.`,
    );
  }

  return { authUserId: session.user.id, email: session.user.email, profile };
}
