import AddBookForm from '@/components/admin/add-book-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewBookPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/catalog"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="font-label-md text-label-sm text-tertiary-fixed-dim uppercase tracking-[0.1em] mb-1">
            Administration
          </p>
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Add Program Book
          </h2>
        </div>
      </div>

      {/* Info Callout */}
      <div className="bg-primary/5 rounded-xl p-4 flex gap-3 items-start border border-primary/10">
        <span className="material-symbols-outlined text-primary shrink-0 mt-0.5 text-xl">
          info
        </span>
        <p className="font-body-md text-body-md text-on-surface-variant">
          This book will be automatically assigned to the next available slot in the reading sequence.
        </p>
      </div>

      <AddBookForm />
    </div>
  );
}