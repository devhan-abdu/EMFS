export {
  createBookWithCover,
  updateBookWithCover,
  addPairedEditionWithCover,
  cleanupOrphanedUpload,
  type CreateBookWithCoverResult,
  type UpdateBookResult,
  type AddPairedEditionResult,
} from "@/lib/services/catalog/create-book";

export type {
  AddPairedEditionWithCoverInput,
  CreateBookWithCoverInput,
  UpdateBookWithCoverInput,
} from "@/lib/validations/catalog";

export {
  deleteBook,
  type DeleteBookResult,
} from "@/lib/services/catalog/delete-book";

export {
  getCatalog,
  type CatalogBookItem,
  type CatalogSlotGroup,
  type PaginatedCatalogResult,
} from "@/lib/services/catalog/get-catalog";

export {
  searchGoogleBooks,
  type GoogleBookSearchResult,
} from "@/lib/services/catalog/google-books";

export {
  reorderBooks,
  reorderCatalogSlots,
} from "@/lib/services/catalog/reorder-catalog";

export { uploadCoverImage } from "@/lib/services/catalog/upload-cover-image";

export {
  uploadToCloudinary,
  deleteFromCloudinary,
  isCloudinaryUrl,
} from "@/lib/services/catalog/cloudinary";
