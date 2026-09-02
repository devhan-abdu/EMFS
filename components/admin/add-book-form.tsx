"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createBookAction,
  type CreateBookActionResult,
} from "@/actions/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const initialState: CreateBookActionResult = {
  ok: false,
  errors: [],
};

async function submitBookAction(
  _: CreateBookActionResult,
  formData: FormData,
): Promise<CreateBookActionResult> {
  return createBookAction(formData);
}

export default function AddBookForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    submitBookAction,
    initialState,
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) {
      router.push("/catalog");
    }
  }, [router, state.ok]);

  if (state.ok) return null;

  // Map errors array to fieldErrors object for display
  const fieldErrorsMap: Record<string, string[]> = {};
  if (state.errors && Array.isArray(state.errors)) {
    for (const error of state.errors) {
      if (!fieldErrorsMap[error.field]) {
        fieldErrorsMap[error.field] = [];
      }
      fieldErrorsMap[error.field].push(error.message);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) =>
        setCoverPreview(event.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setCoverPreview(null);
    }
  };

  const clearCover = () => {
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <form action={formAction} className="flex flex-col gap-8 pb-28 md:pb-0">
      {state.errors && state.errors.length > 0 && !state.ok && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4"
        >
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h4 className="font-semibold text-destructive text-sm">
              Failed to create book
            </h4>
            {state.errors[0] && (
              <p className="text-sm text-destructive/80">
                {state.errors[0].message}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="title"
          className="text-sm font-semibold text-foreground"
        >
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          placeholder="Enter book title"
          className="h-12 rounded-xl border-border bg-surface-2 px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-invalid={!!fieldErrorsMap.title}
          aria-describedby={fieldErrorsMap.title ? "title-error" : undefined}
        />
        {fieldErrorsMap.title && (
          <p id="title-error" className="mt-2 text-xs text-destructive">
            {fieldErrorsMap.title[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="language"
          className="text-sm font-semibold text-foreground"
        >
          Language <span className="text-destructive">*</span>
        </Label>
        <Select name="language">
          <SelectTrigger className="h-12 w-full rounded-xl border-border bg-surface-2 px-4 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">Arabic</SelectItem>
            <SelectItem value="am">Amharic</SelectItem>
            <SelectItem value="so">Somali</SelectItem>
            <SelectItem value="sw">Swahili</SelectItem>
          </SelectContent>
        </Select>
        {fieldErrorsMap.language && (
          <p className="text-xs text-destructive mt-2">
            {fieldErrorsMap.language[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="author"
          className="text-sm font-semibold text-foreground"
        >
          Author{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (Optional)
          </span>
        </Label>
        <Input
          id="author"
          name="author"
          placeholder="Enter author name"
          className="h-12 rounded-xl border-outline-variant bg-surface-container-lowest px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-invalid={!!fieldErrorsMap.author}
          aria-describedby={fieldErrorsMap.author ? "author-error" : undefined}
        />
        {fieldErrorsMap.author && (
          <p id="author-error" className="text-xs text-destructive mt-2">
            {fieldErrorsMap.author[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-semibold text-foreground">
          Cover Image
        </Label>
        <input
          ref={fileInputRef}
          id="cover"
          name="cover"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          aria-invalid={!!fieldErrorsMap.cover}
          aria-describedby={fieldErrorsMap.cover ? "cover-error" : undefined}
        />
        {coverPreview ? (
          <div className="relative w-full max-w-[200px] mx-auto">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container">
              <Image
                src={coverPreview}
                alt="Cover preview"
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={clearCover}
                className="absolute top-2 right-2 p-2 rounded-full bg-foreground/70 hover:bg-foreground/85 text-background transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Click to change image
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={triggerFileInput}
            className="mx-auto flex aspect-[2/3] w-full max-w-[200px] flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-secondary hover:bg-surface-container hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-highest">
              <span className="material-symbols-outlined text-2xl">
                add_photo_alternate
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-inherit">
                Upload Image
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                JPEG, PNG up to 5MB
              </p>
            </div>
          </button>
        )}
        {fieldErrorsMap.cover && (
          <p
            id="cover-error"
            className="text-xs text-destructive mt-2 text-center"
          >
            {fieldErrorsMap.cover[0]}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-4 border-t border-border bg-background/95 p-4 backdrop-blur md:relative md:mt-4 md:border-t-0 md:bg-transparent md:p-0">
        <Link
          href="/catalog"
          className="inline-flex h-[52px] flex-1 items-center justify-center rounded-lg border border-border bg-surface-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-container md:flex-initial"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={isPending}
          className="relative h-[52px] flex-[2] overflow-hidden rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:flex-1"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-2">Creating...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px] mr-2">
                add
              </span>
              Create Book
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
