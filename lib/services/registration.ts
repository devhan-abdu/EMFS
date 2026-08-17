import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import type { SignUpInput } from "@/lib/validations/auth";

export async function registerMember(input: SignUpInput) {

  const result = await auth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: `${input.firstName} ${input.fatherName}`, 
    },
    headers: await headers(),
  });


  await db
    .update(profiles)
    .set({
      firstName: input.firstName,
      fatherName: input.fatherName,
      grandfatherName: input.grandfatherName,
    })
    .where(eq(profiles.authUserId, result.user.id));

  return result;
}
