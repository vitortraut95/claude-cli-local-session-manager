import { Folder } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { Select } from "./Select";

type ProjectFilterProps = {
  projects: string[];
  value: string;
  onChange: (value: string) => void;
};

export function ProjectFilter({ projects, value, onChange }: ProjectFilterProps) {
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
          {project}
        </option>
      ))}
    </Select>
  );
}
