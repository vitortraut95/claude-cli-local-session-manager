import { Folder } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Select } from "./Select";

type ProjectFilterProps = {
  projects: string[];
  /** Display text per project (e.g. "git/hg-led-mainsite" for project "hg-led-mainsite") — the
   *  option's `value` (and thus the actual filter match) always stays the plain project name;
   *  this only changes what's shown. Falls back to the bare project name when a project has no
   *  entry (see `resolveProjectParentSegment` for when that happens). */
  projectLabels: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
};

export function ProjectFilter({ projects, projectLabels, value, onChange }: ProjectFilterProps) {
  const { t } = useLanguage();
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={t("projectFilter.ariaLabel")}
      icon={<Folder className="h-4 w-4" />}
      className="sm:w-56"
    >
      <option value="">{t("projectFilter.allProjects")}</option>
      {projects.map((project) => (
        <option key={project} value={project}>
          {projectLabels[project] ?? project}
        </option>
      ))}
    </Select>
  );
}
