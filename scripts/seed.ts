import "dotenv/config";
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { db } from "../db";
import {
  account,
  applications,
  batchAdmins,
  batchMemberships,
  batches,
  books,
  paceGroups,
  paceGroupMemberships,
  profiles,
  tasks,
  user,
  waitlist,
} from "../db/schema";

type SeedUser = {
  email: string;
  name: string;
  password: string;
  role: "super_admin" | "batch_admin" | "member";
  firstName: string;
  fatherName: string;
  grandfatherName?: string | null;
  telegramUsername?: string;
  phone?: string;
};

const SEED_PASSWORD = "Password123!";

const SEED_USERS: SeedUser[] = [
  {
    email: "member@example.com",
    name: "Alicia Member",
    password: "Password123!",
    role: "member",
    firstName: "Alicia",
    fatherName: "Johnson",
    grandfatherName: "Lee",
    telegramUsername: "@alicia_member",
    phone: "+1-555-0101",
  },
  {
    email: "admin@example.com",
    name: "Jordan Admin",
    password: "Password123!",
    role: "super_admin",
    firstName: "Jordan",
    fatherName: "Miller",
    grandfatherName: "Khan",
    telegramUsername: "@jordan_admin",
    phone: "+1-555-0102",
  },
  {
    email: "staff@example.com",
    name: "Nora Staff",
    password: "Password123!",
    role: "batch_admin",
    firstName: "Nora",
    fatherName: "Smith",
    grandfatherName: "Patel",
    telegramUsername: "@nora_staff",
    phone: "+1-555-0103",
  },
  {
    email: "amina.y@example.com",
    name: "Amina Yusuf",
    password: SEED_PASSWORD,
    role: "member",
    firstName: "Amina",
    fatherName: "Yusuf",
  },
  {
    email: "lensa.b@example.com",
    name: "Lensa Bekele",
    password: SEED_PASSWORD,
    role: "member",
    firstName: "Lensa",
    fatherName: "Bekele",
  },
  {
    email: "sagal.a@example.com",
    name: "Sagal Ahmed",
    password: SEED_PASSWORD,
    role: "member",
    firstName: "Sagal",
    fatherName: "Ahmed",
  },
  {
    email: "hanan.i@example.com",
    name: "Hanan Ibrahim",
    password: SEED_PASSWORD,
    role: "member",
    firstName: "Hanan",
    fatherName: "Ibrahim",
  },
  {
    email: "nejat.s@example.com",
    name: "Nejat Seid",
    password: SEED_PASSWORD,
    role: "member",
    firstName: "Nejat",
    fatherName: "Seid",
  },
];

async function ensureUserAndProfile(seedUser: SeedUser) {
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, seedUser.email),
  });

  if (existingUser) {
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.authUserId, existingUser.id),
    });

    if (!existingProfile) {
      const profileId = randomUUID();
      await db.insert(profiles).values({
        id: profileId,
        authUserId: existingUser.id,
        firstName: seedUser.firstName,
        fatherName: seedUser.fatherName,
        grandfatherName: seedUser.grandfatherName ?? null,
        role: seedUser.role,
        telegramUsername: seedUser.telegramUsername ?? null,
        phone: seedUser.phone ?? null,
      });
    }

    return { authUserId: existingUser.id };
  }

  const authUserId = randomUUID();
  const passwordHash = await hashPassword(seedUser.password);

  await db.insert(user).values({
    id: authUserId,
    name: seedUser.name,
    email: seedUser.email,
    emailVerified: true,
    image: null,
  });

  await db.insert(account).values({
    id: randomUUID(),
    accountId: authUserId,
    providerId: "credential",
    userId: authUserId,
    password: passwordHash,
  });

  const profileId = randomUUID();
  await db.insert(profiles).values({
    id: profileId,
    authUserId: authUserId,
    firstName: seedUser.firstName,
    fatherName: seedUser.fatherName,
    grandfatherName: seedUser.grandfatherName ?? null,
    role: seedUser.role,
    telegramUsername: seedUser.telegramUsername ?? null,
    phone: seedUser.phone ?? null,
  });

  return { authUserId };
}

async function getProfileByEmail(email: string) {
  const authUser = await db.query.user.findFirst({
    where: eq(user.email, email),
  });

  if (!authUser) {
    throw new Error(`Missing auth user for ${email}`);
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.authUserId, authUser.id),
  });

  if (!profile) {
    throw new Error(`Missing profile for ${email}`);
  }

  return profile;
}

function formatDateForDb(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

async function ensureBatch(
  name: string,
  config: {
    maxMembers: number;
    paceGroupCount: number;
    registrationOpen: boolean;
    autoApprove: boolean;
    startDate: Date | null;
    readingDaysPerWeek: number;
    createdBy: string;
  },
) {
  const existing = await db
    .select()
    .from(batches)
    .where(eq(batches.name, name));

  if (existing.length > 0) {
    return existing[0];
  }

  const [created] = await db
    .insert(batches)
    .values({
      name,
      maxMembers: config.maxMembers,
      paceGroupCount: config.paceGroupCount,
      registrationOpen: config.registrationOpen,
      autoApprove: config.autoApprove,
      startDate: formatDateForDb(config.startDate),
      readingDaysPerWeek: config.readingDaysPerWeek,
      createdBy: config.createdBy,
    })
    .returning();

  return created;
}

async function ensureBatchAdmin(profileId: string, batchId: string) {
  const exists = await db
    .select()
    .from(batchAdmins)
    .where(eq(batchAdmins.profileId, profileId));

  const alreadyAssigned = exists.some(
    (assignment) => assignment.batchId === batchId,
  );
  if (!alreadyAssigned) {
    await db.insert(batchAdmins).values({
      profileId,
      batchId,
    });
  }
}

async function ensurePaceGroup(batchId: string, name: string, size: number) {
  const existing = await db
    .select()
    .from(paceGroups)
    .where(eq(paceGroups.batchId, batchId));

  const found = existing.find((group) => group.name === name);
  if (found) {
    return found;
  }

  const paceGroupId = randomUUID();
  await db.insert(paceGroups).values({
    id: paceGroupId,
    batchId,
    name,
    size,
  });

  return {
    id: paceGroupId,
    batchId,
    name,
    size,
  } as typeof paceGroups.$inferSelect;
}

async function ensureApplication(
  email: string,
  batchId: string,
  paceGroup: "5" | "10" | "20" | "40",
) {
  const profile = await getProfileByEmail(email);
  const existing = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, profile.id));

  if (existing.some((application) => application.batchId === batchId)) {
    return;
  }

  await db.insert(applications).values({
    userId: profile.id,
    batchId,
    registrationName: profile.firstName,
    email,
    telegramUsername: profile.telegramUsername ?? `@${email.split("@")[0]}`,
    phoneNumber: profile.phone ?? "+1-555-0199",
    paceGroup,
  });
}

async function main() {
  console.log("Seeding starter data for local EMFS development database...");

  await Promise.all(
    SEED_USERS.map((userSeed) => ensureUserAndProfile(userSeed)),
  );
  const customerProfile = await getProfileByEmail("member@example.com");
  const ownerProfile = await getProfileByEmail("admin@example.com");
  const staffProfile = await getProfileByEmail("staff@example.com");

  const batchOne = await ensureBatch("Batch 04 — Winter Circle", {
    maxMembers: 60,
    paceGroupCount: 3,
    registrationOpen: true,
    autoApprove: false,
    startDate: new Date("2026-09-14"),
    readingDaysPerWeek: 5,
    createdBy: ownerProfile.id,
  });

  const batchTwo = await ensureBatch("Batch 03 — Autumn Circle", {
    maxMembers: 45,
    paceGroupCount: 3,
    registrationOpen: false,
    autoApprove: false,
    startDate: new Date("2026-06-02"),
    readingDaysPerWeek: 5,
    createdBy: ownerProfile.id,
  });

  await ensureBatch("Batch 02 — Summer Circle", {
    maxMembers: 40,
    paceGroupCount: 2,
    registrationOpen: false,
    autoApprove: false,
    startDate: new Date("2026-02-10"),
    readingDaysPerWeek: 4,
    createdBy: ownerProfile.id,
  });

  await ensureBatch("Batch 05 — Spring Circle", {
    maxMembers: 60,
    paceGroupCount: 3,
    registrationOpen: false,
    autoApprove: false,
    startDate: null,
    readingDaysPerWeek: 5,
    createdBy: ownerProfile.id,
  });

  await ensureBatchAdmin(ownerProfile.id, batchOne.id);
  await ensureBatchAdmin(staffProfile.id, batchOne.id);

  const paceGroupOne = await ensurePaceGroup(batchOne.id, "Nur", 20);
  await ensurePaceGroup(batchOne.id, "Sakina", 20);
  await ensurePaceGroup(batchOne.id, "Rahma", 20);
  await ensurePaceGroup(batchTwo.id, "Nur", 16);
  await ensurePaceGroup(batchTwo.id, "Sakina", 15);
  await ensurePaceGroup(batchTwo.id, "Rahma", 14);

  const existingMemberships = await db.select().from(batchMemberships);
  const hasActiveMembership = existingMemberships.some(
    (membership) =>
      membership.profileId === customerProfile.id &&
      membership.batchId === batchOne.id,
  );

  if (!hasActiveMembership) {
    await db.insert(batchMemberships).values({
      profileId: customerProfile.id,
      batchId: batchOne.id,
      status: "active",
      startDate: new Date("2026-01-10T00:00:00.000Z"),
      endDate: null,
    });
  }

  const existingWaitlist = await db
    .select()
    .from(waitlist)
    .where(eq(waitlist.batchId, batchTwo.id));

  if (existingWaitlist.length === 0) {
    await db.insert(waitlist).values({
      batchId: batchTwo.id,
      userId: staffProfile.id,
      queuePosition: 1,
      joinedAt: new Date("2026-05-10T00:00:00.000Z"),
    });

    const staffMembershipExists = existingMemberships.some(
      (membership) =>
        membership.profileId === staffProfile.id &&
        membership.batchId === batchTwo.id,
    );

    if (!staffMembershipExists) {
      await db.insert(batchMemberships).values({
        profileId: staffProfile.id,
        batchId: batchTwo.id,
        status: "waitlisted",
        startDate: new Date("2026-05-10T00:00:00.000Z"),
        endDate: null,
      });
    }
  }

  const existingApplications = await db.select().from(applications);
  const hasApplication = existingApplications.some(
    (application) =>
      application.userId === customerProfile.id &&
      application.batchId === batchOne.id,
  );

  if (!hasApplication) {
    await db.insert(applications).values({
      userId: customerProfile.id,
      batchId: batchOne.id,
      registrationName: customerProfile.firstName,
      email: "member@example.com",
      telegramUsername: customerProfile.telegramUsername ?? "@alicia_member",
      phoneNumber: customerProfile.phone ?? "+1-555-0101",
      paceGroup: "10",
    });
  }

  await ensureApplication("amina.y@example.com", batchOne.id, "10");
  await ensureApplication("lensa.b@example.com", batchOne.id, "10");
  await ensureApplication("sagal.a@example.com", batchOne.id, "20");
  await ensureApplication("hanan.i@example.com", batchOne.id, "20");
  await ensureApplication("nejat.s@example.com", batchTwo.id, "10");

  const existingBooks = await db.select().from(books);
  const catalogList = [
    {
      title: "Reclaim Your Heart",
      author: "Yasmin Mogahed",
      language: "en",
      sequenceOrder: 1,
      taskCount: 8,
    },
    {
      title: "The Sealed Nectar",
      author: "Safiur Rahman Mubarakpuri",
      language: "en",
      sequenceOrder: 2,
      taskCount: 14,
    },
    {
      title: "Purification of the Heart",
      author: "Hamza Yusuf",
      language: "en",
      sequenceOrder: 3,
      taskCount: 10,
    },
    {
      title: "Don't Be Sad",
      author: "Aaidh ibn Abdullah al-Qarni",
      language: "en",
      sequenceOrder: 4,
      taskCount: 12,
    },
    {
      title: "Reclaim Your Heart",
      author: "Yasmin Mogahed",
      language: "am",
      sequenceOrder: 1,
      taskCount: 8,
    },
    {
      title: "Purification of the Heart",
      author: "Hamza Yusuf",
      language: "om",
      sequenceOrder: 3,
      taskCount: 10,
    },
  ];

  for (const bookSeed of catalogList) {
    const bookExists = existingBooks.some(
      (book) =>
        book.title === bookSeed.title && book.language === bookSeed.language,
    );

    if (!bookExists) {
      const bookId = randomUUID();
      const [createdBook] = await db
        .insert(books)
        .values({
          title: bookSeed.title,
          language: bookSeed.language,
          author: bookSeed.author,
          sequenceOrder: bookSeed.sequenceOrder,
        })
        .returning();

      await db.insert(tasks).values(
        Array.from({ length: bookSeed.taskCount }, (_, index) => ({
          bookId: createdBook.id,
          dayNumber: index + 1,
          content:
            index === 0 ?
              `Read the opening chapter of ${bookSeed.title}.`
            : `Read and reflect on day ${index + 1} of ${bookSeed.title}.`,
        })),
      );
    }
  }

  const seededBooks = await db.select().from(books);
  const pairedEditions = [
    { title: "Reclaim Your Heart", translatedLanguage: "am" },
    { title: "Purification of the Heart", translatedLanguage: "om" },
  ];

  for (const pairing of pairedEditions) {
    const englishEdition = seededBooks.find(
      (book) => book.title === pairing.title && book.language === "en",
    );
    const translatedEdition = seededBooks.find(
      (book) =>
        book.title === pairing.title &&
        book.language === pairing.translatedLanguage,
    );

    if (englishEdition && translatedEdition) {
      await db
        .update(books)
        .set({ pairedBookId: englishEdition.id })
        .where(eq(books.id, translatedEdition.id));
    }
  }

  const paceGroupMembershipsList = await db.select().from(paceGroupMemberships);
  const hasMemberPaceAssignment = paceGroupMembershipsList.some(
    (entry) =>
      entry.profileId === customerProfile.id &&
      entry.paceGroupId === paceGroupOne.id,
  );

  if (!hasMemberPaceAssignment) {
    await db.insert(paceGroupMemberships).values({
      profileId: customerProfile.id,
      paceGroupId: paceGroupOne.id,
      status: "active",
      startDate: new Date("2026-01-12T00:00:00.000Z"),
    });
  }

  const usersInSeed = SEED_USERS.map((userSeed) => userSeed.email);
  const existingAuthUsers = await db
    .select({ email: user.email, id: user.id })
    .from(user)
    .where(inArray(user.email, usersInSeed));

  console.log("Seed complete.");
  console.log(
    JSON.stringify(
      {
        accounts: existingAuthUsers.map((entry) => ({
          email: entry.email,
          password: "Password123!",
        })),
        batches: [batchOne.name, batchTwo.name],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exitCode = 1;
});
