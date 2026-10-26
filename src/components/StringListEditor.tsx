import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Button } from "./Button";
import { Input } from "./Input";

/** Ordered list of unique strings: add, reorder, remove. */
export function StringListEditor({
  value,
  onChange,
  placeholder,
  firstItemHint,
  mono = false,
}: {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  firstItemHint?: string;
  mono?: boolean;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState("");
  const add = () => {
    const item = draft.trim();
    if (!item) return;
    if (!value.includes(item)) onChange([...value, item]);
    setDraft("");
  };
  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {value.map((item, index) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 dark:border-gray-800"
          >
            <span
              className={`min-w-0 flex-1 break-all text-sm text-gray-900 dark:text-gray-100 ${mono ? "font-mono" : ""}`}
            >
              {item}
              {index === 0 && firstItemHint && (
                <span className="ml-2 text-xs text-gray-400">({firstItemHint})</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={t("settings.list.moveUp")}
              icon={<ArrowUp className="h-3.5 w-3.5" />}
            />
            <Button
              variant="ghost"
              size="icon"
              disabled={index === value.length - 1}
              onClick={() => move(index, 1)}
              aria-label={t("settings.list.moveDown")}
              icon={<ArrowDown className="h-3.5 w-3.5" />}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={t("settings.list.remove")}
              icon={<X className="h-3.5 w-3.5" />}
            />
          </li>
        ))}
        {value.length === 0 && (
          <li className="rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {t("settings.preview.emptyList")}
          </li>
        )}
      </ul>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
            placeholder={placeholder}
            className={mono ? "font-mono" : ""}
          />
        </div>
        <Button
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
          icon={<Plus className="h-4 w-4" />}
        >
          {t("settings.list.add")}
        </Button>
      </div>
    </div>
  );
}
