import { z } from "zod";
import { PACE_GROUP_PREFERENCES } from "@/db/schema/applications";

export const paceGroupPreferenceSchema = z.enum(PACE_GROUP_PREFERENCES);

export const createApplicationSchema = z.object({
  registrationName: z.string().min(1, "Registration name is required"),
  email: z.string().email("Invalid email address"),
  telegramUsername: z.string().min(1, "Telegram username is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  batchId: z.string().uuid("Invalid batch ID"),
  paceGroup: paceGroupPreferenceSchema,
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
