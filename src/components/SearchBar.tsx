import { Search, X } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";
import { Input } from "./Input";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useLanguage();
  return (
    <div className="flex-1 sm:basis-80">
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchBar.placeholder")}
        icon={<Search className="h-4 w-4" />}
        rightElement={
          value && (
            <Button
              variant="unstyled"
              size="none"
              onClick={() => onChange("")}
              aria-label={t("searchBar.clearLabel")}
              className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            >
              <X className="h-4 w-4" />
            </Button>
          )
        }
      />
    </div>
  );
}
