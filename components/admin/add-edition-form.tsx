"use client";

import { useActionState, useState, useRef } from "react";
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
import { AlertCircle, Loader2, X } from "lucide-react";
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

  if (state.ok) {
    router.push("/catalog");
    return null;
  }

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
    <form action={formAction} className="flex flex-col gap-6">
      {state.errors && state.errors.length > 0 && !state.ok && (
        <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20 flex items-start gap-3">
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
          htmlFor="bookId"
          className="font-label-md text-label-md text-on-surface flex items-center gap-1"
        >
          Select Curriculum Slot <span className="text-error">*</span>
        </Label>
        <div className="relative group">
          <Select name="bookId">
            <SelectTrigger className="w-full h-[52px] bg-surface-container-lowest font-body-md text-body-md text-on-surface rounded-xl px-4 appearance-none outline-none focus:bg-surface-bright transition-colors shadow-sm cursor-pointer border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20">
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
            <span className="material-symbols-outlined text-[20px]">
              expand_more
            </span>
          </div>
        </div>
        {fieldErrorsMap.bookId && (
          <p className="text-xs text-destructive mt-1">
            {fieldErrorsMap.bookId[0]}
          </p>
        )}
        {books.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            No books available. Please create a program book first.
          </p>
        )}
        <div className="bg-primary/5 rounded-lg p-3 flex gap-3 mt-1 items-start">
          <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
            info
          </span>
          <p className="font-label-sm text-label-sm text-primary">
            This edition will be paired with the selected slot and share its
            reading position for all enrolled students.
          </p>
        </div>
      </div>

      <div className="h-px bg-surface-variant w-full my-2" />

      <div className="flex flex-col gap-6">
        <h3 className="font-headline-md text-headline-md text-primary">
          Edition Details
        </h3>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="title"
            className="font-label-md text-label-md text-on-surface flex items-center gap-1"
          >
            Title <span className="text-error">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g. Kitab al-'Ilm (Arabic Edition)"
            className="w-full h-[52px] bg-surface-container-lowest font-body-md text-body-md text-on-surface rounded-xl px-4 outline-none focus:bg-surface-bright transition-colors shadow-sm border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 placeholder:text-outline"
            aria-invalid={!!fieldErrorsMap.title}
            aria-describedby={fieldErrorsMap.title ? "title-error" : undefined}
          />
          {fieldErrorsMap.title && (
            <p id="title-error" className="text-xs text-destructive mt-1">
              {fieldErrorsMap.title[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="language"
            className="font-label-md text-label-md text-on-surface flex items-center gap-1"
          >
            Language <span className="text-error">*</span>
          </Label>
          <div className="relative">
            <Select name="language">
              <SelectTrigger className="w-full h-[52px] bg-surface-container-lowest font-body-md text-body-md text-on-surface rounded-xl px-4 appearance-none outline-none focus:bg-surface-bright transition-colors shadow-sm cursor-pointer border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20">
                <SelectValue placeholder="Select language..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="arabic">Arabic</SelectItem>
                <SelectItem value="urdu">Urdu</SelectItem>
                <SelectItem value="turkish">Turkish</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="bosnian">Bosnian</SelectItem>
              </SelectContent>
            </Select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-primary">
              <span className="material-symbols-outlined text-[20px]">
                language
              </span>
            </div>
          </div>
          {fieldErrorsMap.language && (
            <p className="text-xs text-destructive mt-1">
              {fieldErrorsMap.language[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="type"
            className="font-label-md text-label-md text-on-surface flex items-center gap-1"
          >
            Book Type{" "}
            <span className="text-outline-variant font-normal text-xs ml-1">
              (Optional)
            </span>
          </Label>
          <div className="relative">
            <Select name="type">
              <SelectTrigger className="w-full h-[52px] bg-surface-container-lowest font-body-md text-body-md text-on-surface rounded-xl px-4 appearance-none outline-none focus:bg-surface-bright transition-colors shadow-sm cursor-pointer border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="textbook">Textbook</SelectItem>
                <SelectItem value="workbook">Workbook</SelectItem>
                <SelectItem value="reference">Reference</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-primary">
              <span className="material-symbols-outlined text-[20px]">
                category
              </span>
            </div>
          </div>
          {fieldErrorsMap.type && (
            <p className="text-xs text-destructive mt-1">
              {fieldErrorsMap.type[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="author"
            className="font-label-md text-label-md text-on-surface"
          >
            Author / Translator{" "}
            <span className="text-outline-variant font-normal text-xs ml-1">
              (Optional)
            </span>
          </Label>
          <Input
            id="author"
            name="author"
            placeholder="Leave blank to inherit from slot"
            className="w-full h-[52px] bg-surface-container-lowest font-body-md text-body-md text-on-surface rounded-xl px-4 outline-none focus:bg-surface-bright transition-colors shadow-sm border border-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 placeholder:text-outline"
            aria-invalid={!!fieldErrorsMap.author}
            aria-describedby={
              fieldErrorsMap.author ? "author-error" : undefined
            }
          />
          {fieldErrorsMap.author && (
            <p id="author-error" className="text-xs text-destructive mt-1">
              {fieldErrorsMap.author[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <span className="font-label-md text-label-md text-on-surface">
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
              className="flex flex-col items-center justify-center w-full h-40 bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant hover:bg-surface-container-low hover:border-secondary transition-colors cursor-pointer group relative overflow-hidden"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center z-10">
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-secondary/20 transition-colors">
                  <span className="material-symbols-outlined text-secondary">
                    add_photo_alternate
                  </span>
                </div>
                <p className="font-label-md text-label-md text-on-surface mb-1 group-hover:text-secondary transition-colors">
                  Tap to upload cover image
                </p>
                <p className="font-label-sm text-label-sm text-outline">
                  JPG, PNG or WEBP (Ratio 2:3)
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
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest border-t border-surface-variant pb-safe z-40 md:relative md:bg-transparent md:border-t-0 md:pb-0 md:mt-4">
        <div className="flex gap-4 p-4 md:p-0">
          <Link
            href="/catalog"
            className="flex-1 h-[52px] bg-surface-container rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-highest transition-colors shadow-sm inline-flex items-center justify-center"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={isPending || books.length === 0}
            className="flex-1 h-[52px] bg-primary rounded-xl font-label-md text-label-md text-on-primary hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">
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
