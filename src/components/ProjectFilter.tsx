import { Folder } from "lucide-react";
import { Select } from "./Select";

type ProjectFilterProps = {
  projects: string[];
  value: string;
  onChange: (value: string) => void;
};

export function ProjectFilter({ projects, value, onChange }: ProjectFilterProps) {
  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Filter by project"
      icon={<Folder className="h-4 w-4" />}
      className="sm:w-56"
    >
      <option value="">All projects</option>
      {projects.map((project) => (
        <option key={project} value={project}>
          {project}
        </option>
      ))}
    </Select>
  );
}
