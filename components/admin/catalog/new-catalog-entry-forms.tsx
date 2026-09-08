"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { AddBookForm } from "@/components/admin/catalog/add-book-form";
import {
  AddEditionForm,
  type CatalogBookOption,
} from "@/components/admin/catalog/add-edition-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type { CatalogBookOption };

type Mode = "book" | "edition";

type NewCatalogEntryFormsProps = {
  books: CatalogBookOption[];
};

export function NewCatalogEntryForms({ books }: NewCatalogEntryFormsProps) {
  const searchParams = useSearchParams();
  const initialMode: Mode =
    searchParams.get("mode") === "edition" ? "edition" : "book";

  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <Tabs
      value={mode}
      onValueChange={(value) => setMode(value as Mode)}
      className="space-y-8"
    >
      <TabsList className="bg-surface-container">
        <TabsTrigger value="book" className="p-4 border-none rounded-full ">
          Program book
        </TabsTrigger>
        <TabsTrigger value="edition" className="p-4 border-none rounded-full ">
          Language edition
        </TabsTrigger>
      </TabsList>

      <TabsContent value="book">
        <AddBookForm />
      </TabsContent>
      <TabsContent value="edition">
        <AddEditionForm books={books} />
      </TabsContent>
    </Tabs>
  );
}

export default NewCatalogEntryForms;
