import 'dotenv/config';
import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

import { db } from '../db';
import {
  account,
  batchAdmins,
  batchMemberships,
  batches,
  books,
  catalogSlots,
  curriculumStepEditions,
  curriculumSteps,
  PACE_ADMIN_DUTIES,
  paceAdminAssignments,
  paceGroups,
  paceGroupMemberships,
  profiles,
  user,
  waitlist,
} from '../db/schema';
import { applications } from '../db/schema/applications';

type SeedUser = {
  email: string;
  name: string;
  password: string;
  role: 'super_admin' | 'batch_admin' | 'pace_admin' | 'member';
  firstName: string;
  fatherName: string;
  grandfatherName?: string | null;
  telegramUsername?: string;
  phone?: string;
};

const SEED_PASSWORD = 'Password123!';

const SEED_USERS: SeedUser[] = [
  {
    email: 'member@example.com',
    name: 'Alicia Member',
    password: 'Password123!',
    role: 'member',
    firstName: 'Alicia',
    fatherName: 'Johnson',
    grandfatherName: 'Lee',
    telegramUsername: '@alicia_member',
    phone: '+1-555-0101',
  },
  {
    email: 'admin@example.com',
    name: 'Jordan Admin',
    password: 'Password123!',
    role: 'super_admin',
    firstName: 'Jordan',
    fatherName: 'Miller',
    grandfatherName: 'Khan',
    telegramUsername: '@jordan_admin',
    phone: '+1-555-0102',
  },
  {
    email: 'batch-admin@example.com',
    name: 'Nora Batch Admin',
    password: 'Password123!',
    role: 'batch_admin',
    firstName: 'Nora',
    fatherName: 'Smith',
    grandfatherName: 'Patel',
    telegramUsername: '@nora_batch_admin',
    phone: '+1-555-0103',
  },
  {
    email: 'pace-admin@example.com',
    name: 'Pace Admin',
    password: SEED_PASSWORD,
    role: 'pace_admin',
    firstName: 'Pace',
    fatherName: 'Admin',
    telegramUsername: '@pace_admin',
    phone: '+1-555-0104',
  },
  {
    email: 'amina.y@example.com',
    name: 'Amina Yusuf',
    password: SEED_PASSWORD,
    role: 'member',
    firstName: 'Amina',
    fatherName: 'Yusuf',
  },
  {
    email: 'lensa.b@example.com',
    name: 'Lensa Bekele',
    password: SEED_PASSWORD,
    role: 'member',
    firstName: 'Lensa',
    fatherName: 'Bekele',
  },
  {
    email: 'sagal.a@example.com',
    name: 'Sagal Ahmed',
    password: SEED_PASSWORD,
    role: 'member',
    firstName: 'Sagal',
    fatherName: 'Ahmed',
  },
  {
    email: 'hanan.i@example.com',
    name: 'Hanan Ibrahim',
    password: SEED_PASSWORD,
    role: 'member',
    firstName: 'Hanan',
    fatherName: 'Ibrahim',
  },
  {
    email: 'nejat.s@example.com',
    name: 'Nejat Seid',
    password: SEED_PASSWORD,
    role: 'member',
    firstName: 'Nejat',
    fatherName: 'Seid',
  },
];

async function ensureUserAndProfile(seedUser: SeedUser) {
  const isSuperAdmin = seedUser.role === 'super_admin';
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
        isSuperAdmin,
        telegramUsername: seedUser.telegramUsername ?? null,
        phone: seedUser.phone ?? null,
      });
    } else {
      await db
        .update(profiles)
        .set({
          role: seedUser.role,
          isSuperAdmin,
        })
        .where(eq(profiles.id, existingProfile.id));
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
    providerId: 'credential',
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
    isSuperAdmin,
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

async function ensurePaceAdmin(
  profileId: string,
  paceGroupId: string,
  assignedBy: string,
) {
  const existingAssignments = await db
    .select({ duty: paceAdminAssignments.duty })
    .from(paceAdminAssignments)
    .where(
      and(
        eq(paceAdminAssignments.profileId, profileId),
        eq(paceAdminAssignments.paceGroupId, paceGroupId),
      ),
    );
  const existingDuties = new Set(
    existingAssignments.map((assignment) => assignment.duty),
  );
  const missingDuties = PACE_ADMIN_DUTIES.filter(
    (duty) => !existingDuties.has(duty),
  );

  if (missingDuties.length > 0) {
    await db.insert(paceAdminAssignments).values(
      missingDuties.map((duty) => ({
        profileId,
        paceGroupId,
        duty,
        assignedBy,
      })),
    );
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
  const [initialSlot] = await db
    .select({ id: catalogSlots.id })
    .from(catalogSlots)
    .where(eq(catalogSlots.sequenceOrder, 1))
    .limit(1);

  if (!initialSlot) {
    throw new Error('Seed catalog slot 1 before creating pace groups.');
  }

  const [initialBook] = await db
    .select({ id: books.id })
    .from(books)
    .where(
      and(eq(books.catalogSlotId, initialSlot.id), eq(books.language, 'en')),
    )
    .limit(1);

  if (!initialBook) {
    throw new Error(
      'Seed an English book for catalog slot 1 before creating pace groups.',
    );
  }

  await db.insert(paceGroups).values({
    id: paceGroupId,
    batchId,
    name,
    size,
    activeCatalogSlotId: initialSlot.id,
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
  paceGroup: '5' | '10' | '20' | '40',
) {
  const profile = await getProfileByEmail(email);
  const existing = await db
    .select()
    .from(applications)
    .where(eq(applications.profileId, profile.id));

  if (existing.some((application) => application.batchId === batchId)) {
    return;
  }

  const applicationValues: typeof applications.$inferInsert = {
    profileId: profile.id,
    batchId,
    firstName: profile.firstName ?? email.split('@')[0],
    fatherName: profile.fatherName ?? 'Unknown',
    grandfatherName: profile.grandfatherName ?? null,
    email,
    telegramUsername: profile.telegramUsername ?? `@${email.split('@')[0]}`,
    phoneNumber: profile.phone ?? '+251911000000',
    paceGroup,
  };

  await db.insert(applications).values(applicationValues);
}

async function main() {
  console.log('Seeding starter data for local EMFS development database...');

  await Promise.all(
    SEED_USERS.map((userSeed) => ensureUserAndProfile(userSeed)),
  );
  const customerProfile = await getProfileByEmail('member@example.com');
  const ownerProfile = await getProfileByEmail('admin@example.com');
  const batchAdminProfile = await getProfileByEmail('batch-admin@example.com');
  const paceAdminProfile = await getProfileByEmail('pace-admin@example.com');

  const batchOne = await ensureBatch('Batch 04 — Winter Circle', {
    maxMembers: 60,
    paceGroupCount: 3,
    registrationOpen: true,
    autoApprove: false,
    startDate: new Date('2026-09-14'),
    readingDaysPerWeek: 5,
    createdBy: ownerProfile.id,
  });

  const batchTwo = await ensureBatch('Batch 03 — Autumn Circle', {
    maxMembers: 45,
    paceGroupCount: 3,
    registrationOpen: false,
    autoApprove: false,
    startDate: new Date('2026-06-02'),
    readingDaysPerWeek: 5,
    createdBy: ownerProfile.id,
  });

  await ensureBatch('Batch 02 — Summer Circle', {
    maxMembers: 40,
    paceGroupCount: 2,
    registrationOpen: false,
    autoApprove: false,
    startDate: new Date('2026-02-10'),
    readingDaysPerWeek: 4,
    createdBy: ownerProfile.id,
  });

  await ensureBatch('Batch 05 — Spring Circle', {
    maxMembers: 60,
    paceGroupCount: 3,
    registrationOpen: false,
    autoApprove: false,
    startDate: null,
    readingDaysPerWeek: 5,
    createdBy: ownerProfile.id,
  });

  await ensureBatchAdmin(batchAdminProfile.id, batchOne.id);

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
      status: 'active',
      startDate: new Date('2026-01-10T00:00:00.000Z'),
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
      userId: customerProfile.id,
      queuePosition: 1,
      joinedAt: new Date('2026-05-10T00:00:00.000Z'),
    });

    const customerMembershipExists = existingMemberships.some(
      (membership) =>
        membership.profileId === customerProfile.id &&
        membership.batchId === batchTwo.id,
    );

    if (!customerMembershipExists) {
      await db.insert(batchMemberships).values({
        profileId: customerProfile.id,
        batchId: batchTwo.id,
        status: 'waitlisted',
        startDate: new Date('2026-05-10T00:00:00.000Z'),
        endDate: null,
      });
    }
  }

  const existingApplications = await db.select().from(applications);
  const hasApplication = existingApplications.some(
    (application) =>
      application.profileId === customerProfile.id &&
      application.batchId === batchOne.id,
  );

  if (!hasApplication) {
    const applicationValues: typeof applications.$inferInsert = {
      profileId: customerProfile.id,
      batchId: batchOne.id,
      firstName: customerProfile.firstName ?? 'Alicia',
      fatherName: customerProfile.fatherName ?? 'Member',
      grandfatherName: customerProfile.grandfatherName ?? null,
      email: 'member@example.com',
      telegramUsername: customerProfile.telegramUsername ?? '@alicia_member',
      phoneNumber: customerProfile.phone ?? '+1-555-0101',
      paceGroup: '10',
    };

    await db.insert(applications).values(applicationValues);
  }

  await ensureApplication('amina.y@example.com', batchOne.id, '10');
  await ensureApplication('lensa.b@example.com', batchOne.id, '10');
  await ensureApplication('sagal.a@example.com', batchOne.id, '20');
  await ensureApplication('hanan.i@example.com', batchOne.id, '20');
  await ensureApplication('nejat.s@example.com', batchTwo.id, '10');

  const existingBooks = await db.select().from(books);
  const catalogList = [
    {
      title: 'Reclaim Your Heart',
      author: 'Yasmin Mogahed',
      language: 'en',
      sequenceOrder: 1,
      taskCount: 8,
    },
    {
      title: 'The Sealed Nectar',
      author: 'Safiur Rahman Mubarakpuri',
      language: 'en',
      sequenceOrder: 2,
      taskCount: 14,
    },
    {
      title: 'Purification of the Heart',
      author: 'Hamza Yusuf',
      language: 'en',
      sequenceOrder: 3,
      taskCount: 10,
    },
    {
      title: "Don't Be Sad",
      author: 'Aaidh ibn Abdullah al-Qarni',
      language: 'en',
      sequenceOrder: 4,
      taskCount: 12,
    },
    {
      title: 'Reclaim Your Heart',
      author: 'Yasmin Mogahed',
      language: 'am',
      sequenceOrder: 1,
      taskCount: 8,
    },
    {
      title: 'Purification of the Heart',
      author: 'Hamza Yusuf',
      language: 'om',
      sequenceOrder: 3,
      taskCount: 10,
    },
  ];

  const slotMap = new Map<number, string>();
  for (const order of Array.from(
    new Set(catalogList.map((book) => book.sequenceOrder)),
  )) {
    const existingSlot = await db.query.catalogSlots.findFirst({
      where: eq(catalogSlots.sequenceOrder, order),
    });

    if (existingSlot) {
      slotMap.set(order, existingSlot.id);
      continue;
    }

    const [createdSlot] = await db
      .insert(catalogSlots)
      .values({ sequenceOrder: order })
      .returning();

    slotMap.set(order, createdSlot.id);
  }

  for (const bookSeed of catalogList) {
    const bookExists = existingBooks.some(
      (book) =>
        book.title === bookSeed.title && book.language === bookSeed.language,
    );

    if (!bookExists) {
      const slotId = slotMap.get(bookSeed.sequenceOrder);
      if (!slotId) continue;

      await db.insert(books).values({
        title: bookSeed.title,
        language: bookSeed.language,
        author: bookSeed.author,
        catalogSlotId: slotId,
      });
    }
  }

  const seededBooks = await db.select().from(books);
  const paceGroupOne = await ensurePaceGroup(batchOne.id, 'Nur', 20);
  await ensurePaceGroup(batchOne.id, 'Sakina', 20);
  await ensurePaceGroup(batchOne.id, 'Rahma', 20);
  await ensurePaceAdmin(paceAdminProfile.id, paceGroupOne.id, ownerProfile.id);
  await ensurePaceGroup(batchTwo.id, 'Nur', 16);
  await ensurePaceGroup(batchTwo.id, 'Sakina', 15);
  await ensurePaceGroup(batchTwo.id, 'Rahma', 14);

  for (const bookSeed of catalogList.filter((book) => book.language === 'en')) {
    const slot = await db
      .select({ id: catalogSlots.id })
      .from(catalogSlots)
      .where(eq(catalogSlots.sequenceOrder, bookSeed.sequenceOrder))
      .limit(1);

    const slotId = slot[0]?.id;
    if (!slotId) continue;

    const slotSteps = await db
      .select({ paceSize: curriculumSteps.paceSize })
      .from(curriculumSteps)
      .where(eq(curriculumSteps.catalogSlotId, slotId));
    const existingPaceSizes = new Set(slotSteps.map((step) => step.paceSize));
    const totalPages = bookSeed.taskCount * 5;

    const englishBook = await db.query.books.findFirst({
      where: and(eq(books.catalogSlotId, slotId), eq(books.language, 'en')),
    });

    for (const paceSize of [5, 10, 20, 40]) {
      if (existingPaceSizes.has(paceSize)) continue;

      const stepCount = Math.ceil(totalPages / paceSize);
      const createdSteps = await db
        .insert(curriculumSteps)
        .values(
          Array.from({ length: stepCount }, (_, index) => ({
            catalogSlotId: slotId,
            paceSize,
            stepNumber: index + 1,
          })),
        )
        .returning();

      if (englishBook) {
        await db.insert(curriculumStepEditions).values(
          createdSteps.map((step, index) => ({
            curriculumStepId: step.id,
            catalogSlotId: slotId,
            bookId: englishBook.id,
            startPage: index * paceSize + 1,
            endPage: Math.min((index + 1) * paceSize, totalPages),
            caption: `Read and reflect on day ${index + 1} of ${bookSeed.title}.`,
          })),
        );
      }
    }
  }

  const pairedEditions = [
    { title: 'Reclaim Your Heart', translatedLanguage: 'am' },
    { title: 'Purification of the Heart', translatedLanguage: 'om' },
  ];

  for (const pairing of pairedEditions) {
    const englishEdition = seededBooks.find(
      (book) => book.title === pairing.title && book.language === 'en',
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
      batchId: batchOne.id,
      paceGroupId: paceGroupOne.id,
      status: 'active',
      startDate: new Date('2026-01-12T00:00:00.000Z'),
    });
  }

  const usersInSeed = SEED_USERS.map((userSeed) => userSeed.email);
  const existingAuthUsers = await db
    .select({ email: user.email, id: user.id })
    .from(user)
    .where(inArray(user.email, usersInSeed));

  console.log('Seed complete.');
  console.log(
    JSON.stringify(
      {
        accounts: existingAuthUsers.map((entry) => ({
          email: entry.email,
          password: 'Password123!',
        })),
        batches: [batchOne.name, batchTwo.name],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Seed script failed:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
