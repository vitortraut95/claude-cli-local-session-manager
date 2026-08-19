import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";

type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("pagination.previousLabel")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {t("pagination.pageInfo", { page, pageCount })}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label={t("pagination.nextLabel")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
