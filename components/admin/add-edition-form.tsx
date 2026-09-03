"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addPairedEditionAction,
  type AddPairedEditionActionResult,
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
import { AlertCircle, Loader2, PlusCircle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const initialState: AddPairedEditionActionResult = {
  ok: false,
  errors: [],
};

async function submitEditionAction(
  _: AddPairedEditionActionResult,
  formData: FormData,
): Promise<AddPairedEditionActionResult> {
  return addPairedEditionAction(formData);
}

interface BookOption {
  id: string;
  label: string;
}

interface AddEditionFormProps {
  books: BookOption[];
}

export default function AddEditionForm({ books }: AddEditionFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    submitEditionAction,
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
        <div className="flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-destructive text-sm">
              Failed to add edition
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
          htmlFor="pairedBookId"
          className="text-sm font-semibold text-foreground"
        >
          Select Curriculum Slot <span className="text-destructive">*</span>
        </Label>
        <div className="relative group">
          <Select name="pairedBookId">
            <SelectTrigger className="h-[52px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm text-foreground shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <SelectValue placeholder="Choose a book slot..." />
            </SelectTrigger>
            <SelectContent>
              {books.map((book) => (
                <SelectItem key={book.id} value={book.id}>
                  {book.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-primary">
            <span className="material-symbols-outlined text-xl">
              expand_more
            </span>
          </div>
        </div>
        {fieldErrorsMap.pairedBookId && (
          <p className="text-xs text-destructive mt-2">
            {fieldErrorsMap.pairedBookId[0]}
          </p>
        )}
        {books.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            No books available. Please create a program book first.
          </p>
        )}
        <div className="bg-primary/5 rounded-lg p-4 flex gap-4 mt-2 items-start">
          <span className="material-symbols-outlined text-primary text-xl mt-0.5">
            info
          </span>
          <p className="text-sm text-primary">
            This edition will be paired with the selected slot and share its
            reading position for all enrolled students.
          </p>
        </div>
      </div>

      <div className="my-2 h-px w-full bg-border" />

      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-semibold text-foreground">
          Edition Details
        </h3>

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
            placeholder="e.g. Kitab al-'Ilm (Arabic Edition)"
            className="h-[52px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={!!fieldErrorsMap.title}
            aria-describedby={fieldErrorsMap.title ? "title-error" : undefined}
          />
          {fieldErrorsMap.title && (
            <p id="title-error" className="text-xs text-destructive mt-2">
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
          <div className="relative">
            <Select name="language">
              <SelectTrigger className="h-[52px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm text-foreground shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                <SelectValue placeholder="Select language..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="ur">Urdu</SelectItem>
                <SelectItem value="tr">Turkish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="bs">Bosnian</SelectItem>
              </SelectContent>
            </Select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-primary">
              <span className="material-symbols-outlined text-xl">
                language
              </span>
            </div>
          </div>
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
            Author / Translator{" "}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              (Optional)
            </span>
          </Label>
          <Input
            id="author"
            name="author"
            placeholder="Leave blank to inherit from slot"
            className="h-[52px] w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={!!fieldErrorsMap.author}
            aria-describedby={
              fieldErrorsMap.author ? "author-error" : undefined
            }
          />
          {fieldErrorsMap.author && (
            <p id="author-error" className="text-xs text-destructive mt-2">
              {fieldErrorsMap.author[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <span className="text-sm font-semibold text-foreground">
            Cover Image
          </span>
          <input
            ref={fileInputRef}
            id="cover"
            name="cover"
            type="file"
            accept="image/jpeg, image/png, image/webp"
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
              className="group relative flex h-40 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest transition-colors hover:border-secondary hover:bg-surface-container"
            >
              <div className="flex flex-col items-center justify-center pt-6 pb-6 px-4 text-center z-10">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                  <span className="material-symbols-outlined text-secondary">
                    add_photo_alternate
                  </span>
                </div>
                <p className="mb-2 text-sm font-medium text-foreground transition-colors group-hover:text-secondary">
                  Tap to upload cover image
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WEBP (Ratio 2:3)
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
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur md:relative md:mt-6 md:border-t-0 md:bg-transparent md:p-0">
        <div className="flex gap-4">
          <Link
            href="/catalog"
            className="flex-1 inline-flex h-[52px] items-center justify-center rounded-xl border border-border bg-surface-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-surface-container"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={isPending || books.length === 0}
            className="flex-1 inline-flex h-[52px] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">
                  add_circle
                </span>
                Add Edition
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}