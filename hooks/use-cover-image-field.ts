"use client";

import { useRef, useState } from "react";

export function useCoverImageField() {
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyExternalCoverUrl(url: string | null) {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setCoverPreview(url);
    setCoverUrl(url ?? "");
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setCoverUrl("");

    const reader = new FileReader();
    reader.onload = (loadEvent) =>
      setCoverPreview(loadEvent.target?.result as string);
    reader.readAsDataURL(file);
  }

  function clearCover() {
    setCoverPreview(null);
    setCoverUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  return {
    coverPreview,
    coverUrl,
    fileInputRef,
    applyExternalCoverUrl,
    handleFileChange,
    clearCover,
    triggerFileInput,
  };
}
