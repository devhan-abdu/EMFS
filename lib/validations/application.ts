import { z } from "zod";
import { PACE_GROUP_PREFERENCES } from "@/db/schema/applications";

export const paceGroupPreferenceSchema = z
  .enum(PACE_GROUP_PREFERENCES)
  .optional();

const ethiopianPhoneRegex = /^(?:\+251|0)[79]\d{8}$/;

export const createApplicationSchema = z.object({
  batchId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name is required"),
  fatherName: z.string().trim().min(1, "Father name is required"),
  grandfatherName: z.string().trim().optional(),
  email: z.string().email("Please provide a valid email"),
  telegramUsername: z.string().trim().min(1, "Telegram username is required"),
  phoneNumber: z.string().trim().min(1, "Phone number is required"),
  paceGroup: z.enum(PACE_GROUP_PREFERENCES).optional(),
});


export type FormState = {
  values?: Partial<z.infer<typeof createApplicationSchema>>;
  errors?: Partial<
    Record<keyof z.infer<typeof createApplicationSchema>, string[]>
  > | null;
  formError?: string | null;
  success: boolean;
};

export const reviewApplicationSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
