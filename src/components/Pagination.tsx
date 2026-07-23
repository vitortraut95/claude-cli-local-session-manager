import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="inline-flex items-center justify-center rounded-md border border-gray-300 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className="inline-flex items-center justify-center rounded-md border border-gray-300 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
