export type AdminRole = "super_admin" | "batch_admin" | "pace_admin" | "member";

export const roleLabels: Record<AdminRole, string> = {
  super_admin: "Super admin",
  batch_admin: "Batch admin",
  pace_admin: "Pace group admin",
  member: "Member",
};

export const roleBlurbs: Record<AdminRole, string> = {
  super_admin:
    "Full access: catalog, batches, people and every role assignment.",
  batch_admin: "Runs one batch: applications, pace groups and book selection.",
  pace_admin:
    "Guides one pace group: daily targets, attendance and reflections.",
  member: "Reads along: daily pages, reflections and her own progress.",
};

export const rolePermissions: {
  area: string;
  access: Record<AdminRole, boolean>;
}[] = [
  {
    area: "Book catalog & editions",
    access: {
      super_admin: true,
      batch_admin: false,
      pace_admin: false,
      member: false,
    },
  },
  {
    area: "Create & open batches",
    access: {
      super_admin: true,
      batch_admin: false,
      pace_admin: false,
      member: false,
    },
  },
  {
    area: "Review applications",
    access: {
      super_admin: true,
      batch_admin: true,
      pace_admin: false,
      member: false,
    },
  },
  {
    area: "Assign pace groups",
    access: {
      super_admin: true,
      batch_admin: true,
      pace_admin: false,
      member: false,
    },
  },
  {
    area: "Approve daily page target",
    access: {
      super_admin: true,
      batch_admin: true,
      pace_admin: true,
      member: false,
    },
  },
  {
    area: "Mark attendance",
    access: {
      super_admin: true,
      batch_admin: true,
      pace_admin: true,
      member: false,
    },
  },
  {
    area: "Read reflections",
    access: {
      super_admin: true,
      batch_admin: true,
      pace_admin: true,
      member: false,
    },
  },
  {
    area: "Write reflections",
    access: {
      super_admin: false,
      batch_admin: false,
      pace_admin: true,
      member: true,
    },
  },
  {
    area: "Assign roles",
    access: {
      super_admin: true,
      batch_admin: false,
      pace_admin: false,
      member: false,
    },
  },
];
