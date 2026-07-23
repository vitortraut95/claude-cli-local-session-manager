import { ChevronDown, Folder } from "lucide-react";

type ProjectFilterProps = {
  projects: string[];
  value: string;
  onChange: (value: string) => void;
};

export function ProjectFilter({ projects, value, onChange }: ProjectFilterProps) {
  return (
    <div className="relative">
      <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Filter by project"
        className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 sm:w-56 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-gray-600 dark:focus:ring-gray-100/10"
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project} value={project}>
            {project}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
    </div>
  );
}
