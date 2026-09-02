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
    <form action={formAction} className="flex flex-col gap-6 pb-28 md:pb-0">
      {state.errors && state.errors.length > 0 && !state.ok && (
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
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
          className="h-13 rounded-xl border-border bg-surface-2 px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          aria-invalid={!!fieldErrorsMap.title}
          aria-describedby={fieldErrorsMap.title ? "title-error" : undefined}
        />
        {fieldErrorsMap.title && (
          <p id="title-error" className="mt-1 text-xs text-destructive">
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
          <SelectTrigger className="h-13 rounded-xl border-border bg-surface-2 px-4 text-base text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20">
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
          <p className="text-xs text-destructive mt-1">
            {fieldErrorsMap.language[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="author"
          className="font-label-md text-label-md text-on-surface"
        >
          Author{" "}
          <span className="text-outline text-label-sm font-normal">
            (Optional)
          </span>
        </Label>
        <Input
          id="author"
          name="author"
          placeholder="Enter author name"
          className="h-[52px] bg-surface-container-lowest border-outline-variant rounded-xl px-4 font-body-lg text-body-lg text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          aria-invalid={!!fieldErrorsMap.author}
          aria-describedby={fieldErrorsMap.author ? "author-error" : undefined}
        />
        {fieldErrorsMap.author && (
          <p id="author-error" className="text-xs text-destructive mt-1">
            {fieldErrorsMap.author[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-label-md text-label-md text-on-surface">
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
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container">
              <Image
                src={coverPreview}
                alt="Cover preview"
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={clearCover}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
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
            className="w-full aspect-[2/3] max-w-[200px] mx-auto bg-surface-container border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center gap-3 text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">
                add_photo_alternate
              </span>
            </div>
            <div className="text-center">
              <p className="font-label-md text-label-md text-inherit">
                Upload Image
              </p>
              <p className="font-label-sm text-label-sm text-outline mt-1">
                JPEG, PNG up to 5MB
              </p>
            </div>
          </button>
        )}
        {fieldErrorsMap.cover && (
          <p
            id="cover-error"
            className="text-xs text-destructive mt-1 text-center"
          >
            {fieldErrorsMap.cover[0]}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 bg-surface/90 backdrop-blur-md border-t border-outline-variant pb-safe z-40 flex gap-3 md:relative md:bg-transparent md:border-t-0 md:p-0 md:mt-4">
        <Link
          href="/catalog"
          className="flex-1 h-[52px] bg-surface-container text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container-high transition-colors md:flex-initial inline-flex items-center justify-center"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-[2] h-[52px] bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:bg-primary/90 transition-colors relative overflow-hidden md:flex-1"
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
