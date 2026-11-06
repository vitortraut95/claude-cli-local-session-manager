import { Search, X } from "lucide-react";
import { forwardRef } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";
import { Input } from "./Input";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  /** Shown at the right while empty (the key that focuses the field, e.g. "/"). */
  shortcut?: string;
};

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, shortcut },
  ref,
) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0 flex-[1_1_18rem] sm:max-w-md">
      <label className="sr-only" htmlFor="sessions-search">
        {t("searchBar.placeholder")}
      </label>
      <Input
        ref={ref}
        id="sessions-search"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder={t("searchBar.placeholder")}
        icon={<Search className="h-4 w-4" />}
        className="min-h-10"
        rightElement={
          value ? (
            <Button
              variant="unstyled"
              size="none"
              onClick={() => onChange("")}
              aria-label={t("searchBar.clearLabel")}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            shortcut && (
              <kbd
                title={t("sessions.search.shortcut")}
                className="rounded border border-gray-300 px-1.5 font-mono text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400"
              >
                {shortcut}
              </kbd>
            )
          )
        }
      />
    </div>
  );
});
