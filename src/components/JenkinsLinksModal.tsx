import { ExternalLink, GitBranch, GitPullRequest, Home, Tag } from "lucide-react";
import type { ReactNode } from "react";
import jenkinsIcon from "../assets/jenkins.svg";
import { useLanguage } from "../hooks/useLanguage";
import type { JenkinsLink } from "../utils/jenkins";
import { Modal } from "./Modal";

type JenkinsLinksModalProps = {
  project: string;
  links: JenkinsLink[];
  onClose: () => void;
};

/**
 * Every Jenkins link that could apply to this session (project index, the current branch, the
 * branch it was created from, the same ticket under each common branch prefix, PR and tag views —
 * see `getJenkinsLinks`), as plain new-tab links. None are checked for existence, so the modal
 * deliberately stays open after a click: if one turns out to be a 404, the next candidate is right
 * there.
 */
export function JenkinsLinksModal({ project, links, onClose }: JenkinsLinksModalProps) {
  const { t } = useLanguage();
  const current = links.filter((l) => l.kind === "branch" && l.role === "current");
  const origin = links.filter((l) => l.kind === "branch" && l.role === "origin");
  const variants = links.filter((l) => l.kind === "branch" && l.role === "variant");
  const views = links.filter((l) => l.kind !== "branch");

  const labelFor = (link: JenkinsLink): string => {
    switch (link.kind) {
      case "project":
        return t("jenkinsLinksModal.project", { project });
      case "branch":
        return link.branch;
      case "pullRequests":
        return t("jenkinsLinksModal.pullRequests");
      case "tags":
        return t("jenkinsLinksModal.tags");
    }
  };

  const iconFor = (link: JenkinsLink): ReactNode => {
    const className = "h-4 w-4 shrink-0";
    switch (link.kind) {
      case "project":
        return <Home className={className} />;
      case "branch":
        return <GitBranch className={className} />;
      case "pullRequests":
        return <GitPullRequest className={className} />;
      case "tags":
        return <Tag className={className} />;
    }
  };

  const renderLinks = (items: JenkinsLink[]) => (
    <ul className="flex flex-col gap-1">
      {items.map((link) => (
        <li key={link.url}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span className="text-gray-400 dark:text-gray-500">{iconFor(link)}</span>
            <span className="min-w-0 flex-1">
              <span className={link.kind === "branch" ? "font-mono" : "font-medium"}>
                {labelFor(link)}
              </span>
              <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
                {link.url}
              </span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100" />
          </a>
        </li>
      ))}
    </ul>
  );

  const section = (title: string, items: JenkinsLink[]) =>
    items.length > 0 && (
      <section className="mt-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        {renderLinks(items)}
      </section>
    );

  return (
    <Modal
      open
      title={t("jenkinsLinksModal.title")}
      onClose={onClose}
      onCancel={onClose}
      cancelLabel={t("jenkinsLinksModal.close")}
      size="md"
      icon={<img src={jenkinsIcon} alt="" className="h-5 w-5" />}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("jenkinsLinksModal.intro")}</p>
      {section(t("jenkinsLinksModal.section.currentBranch"), current)}
      {section(t("jenkinsLinksModal.section.originBranch"), origin)}
      {section(t("jenkinsLinksModal.section.variants"), variants)}
      {section(t("jenkinsLinksModal.section.views"), views)}
    </Modal>
  );
}
