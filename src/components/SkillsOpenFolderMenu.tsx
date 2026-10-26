import { ChevronDown, FolderOpen, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as skillsHubApi from "../services/skillsHubApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";

/** "Open skills in the file manager" — a small menu offering the hub clone or the machine's own
 *  `~/.claude/skills` (where the links live). Both paths are resolved server-side. */
export function SkillsOpenFolderMenu({
  hubPath,
  userSkillsDir,
}: {
  hubPath: string;
  userSkillsDir: string;
}) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openFolder = async (target: "hub" | "userSkills") => {
    setOpen(false);
    setBusy(true);
    try {
      await skillsHubApi.openSkillsFolder(target);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "skillsHub.manage.openFolderError"), "error");
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { target: "hub" as const, label: t("skillsHub.manage.openHub"), path: hubPath },
    {
      target: "userSkills" as const,
      label: t("skillsHub.manage.openUserSkills"),
      path: userSkillsDir,
    },
  ];

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={
          busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" />
          )
        }
      >
        {t("skillsHub.manage.openFolder")}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {options.map((option) => (
            <button
              key={option.target}
              type="button"
              role="menuitem"
              onClick={() => void openFolder(option.target)}
              className="block w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <span className="block text-sm text-gray-900 dark:text-gray-100">{option.label}</span>
              <span className="block break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                {option.path}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
