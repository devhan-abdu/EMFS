export const PROGRAM_BOOK_CATEGORY_PRESETS = [
  { value: "spiritual", label: "Spiritual growth" },
  { value: "seerah", label: "Seerah" },
  { value: "wellbeing", label: "Wellbeing" },
  { value: "knowledge", label: "Knowledge & study" },
  { value: "other", label: "Other…" },
] as const;

/** Program books are English; Google Books autofill is English-only. */
export const PROGRAM_BOOK_LANGUAGES = [
  { value: "en", label: "English" },
] as const;

/** Paired editions are Amharic only. */
export const EDITION_LANGUAGES = [
  { value: "am", label: "Amharic" },
] as const;

export const CATALOG_LANGUAGES = [
  ...PROGRAM_BOOK_LANGUAGES,
  ...EDITION_LANGUAGES,
] as const;
