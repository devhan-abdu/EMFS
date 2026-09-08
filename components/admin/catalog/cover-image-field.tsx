"use client";

import { X } from "lucide-react";

import { BookCoverThumb } from "@/components/catalog/book-cover-thumb";

type CoverImageFieldProps = {
  coverPreview: string | null;
  coverError?: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onTriggerUpload: () => void;
  description?: string;
  /** Used for the letter fallback when no preview is available. */
  title?: string;
  seed?: string;
};

export function CoverImageField({
  coverPreview,
  coverError,
  fileInputRef,
  onFileChange,
  onClear,
  onTriggerUpload,
  description = "Pulled in automatically from Google Books, or upload your own.",
  title = "Cover",
  seed,
}: CoverImageFieldProps) {
  return (
    <>
      <input
        type="file"
        name="cover"
        ref={fileInputRef}
        onChange={onFileChange}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
      />

      {coverPreview ?
        <div className="relative mx-auto w-full max-w-[200px]">
          <BookCoverThumb
            coverUrl={coverPreview}
            title={title}
            seed={seed ?? title}
            alt="Cover preview"
            className="aspect-[2/3] h-auto w-full max-w-[200px] rounded-xl"
            sizes="200px"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-foreground/70 p-2 text-background transition-colors hover:bg-foreground/85"
            aria-label="Remove cover"
          >
            <X className="size-4" />
          </button>
          <button
            type="button"
            onClick={onTriggerUpload}
            className="mt-2 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Click to change image
          </button>
        </div>
      : <button
          type="button"
          onClick={onTriggerUpload}
          className="mx-auto flex aspect-[2/3] w-full max-w-[200px] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-surface-container text-muted-foreground transition-colors hover:border-primary hover:bg-surface-container/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-surface-container-highest">
            <span className="material-symbols-outlined text-lg">
              add_photo_alternate
            </span>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-inherit">Upload image</p>
            <p className="mt-2 text-xs text-muted-foreground">
              JPEG, PNG up to 5MB
            </p>
          </div>
        </button>
      }

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {description}
      </p>

      {coverError && (
        <p className="mt-2 text-center text-xs text-destructive">{coverError}</p>
      )}
    </>
  );
}
