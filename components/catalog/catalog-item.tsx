/**
 * Catalog Item Component
 *
 * Renders a single table row or card representing one book edition.
 * Displays: slot, cover image, title, language, author, paired editions badge.
 *
 * Client Component (used within CatalogList):
 * - Receives a single CatalogBookItem
 * - Renders table row or card (responsive)
 * - Shows cover thumbnail with fallback
 * - Shows paired edition context via PairedEditionBadge
 * - Optional: action buttons (future: edit, delete)
 *
 * Props:
 * - item: CatalogBookItem
 * - slotBooks?: CatalogBookItem[] (other editions in the same slot)
 */

export function CatalogItem() {
  // TODO: Implement catalog item
  // - Render table row with cells:
  //   - Slot number
  //   - Cover image thumbnail
  //   - Title
  //   - Language badge
  //   - Author (optional)
  //   - PairedEditionBadge
  //   - Action buttons (disabled for MVP)
  // - Responsive: hide/show columns based on screen size

  return <div>{/* Catalog item placeholder */}</div>;
}
