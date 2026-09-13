import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import type { SignUpInput } from "@/lib/validations/auth";

export async function registerMember(input: SignUpInput) {
  const result = await auth.api.signUpEmail({
    body: {
      email: input.email,
      password: input.password,
      name: input.email,
    },
    headers: await headers(),
  });

  return result;
}
