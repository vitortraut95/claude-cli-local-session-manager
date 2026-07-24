import { Search, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1">
        <Input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by title, project, or ID..."
          icon={<Search className="h-4 w-4" />}
          rightElement={
            value && (
              <Button
                variant="unstyled"
                size="none"
                onClick={() => onChange("")}
                aria-label="Clear search"
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </Button>
            )
          }
        />
      </div>
    </div>
  );
}
