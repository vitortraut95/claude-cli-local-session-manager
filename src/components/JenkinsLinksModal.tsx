import { ExternalLink, Eye, GitBranch, GitPullRequest, Home, Tag } from "lucide-react";
import type { ReactNode } from "react";
import jenkinsIcon from "../assets/jenkins.svg";
import { useLanguage } from "../hooks/useLanguage";
import type { EnvPreviewGroup, JenkinsLink } from "../utils/jenkins";
import { Modal } from "./Modal";

type JenkinsLinksModalProps = {
  project: string;
  links: JenkinsLink[];
  envPreviews: EnvPreviewGroup[];
  onClose: () => void;
};

/**
 * Every Jenkins link that could apply to this session (project index, the current branch, the
 * branch it was created from, the same ticket under each common branch prefix, PR and tag views —
 * see `getJenkinsLinks`), as plain new-tab links. None are checked for existence, so the modal
 * deliberately stays open after a click: if one turns out to be a 404, the next candidate is right
 * there.
 */
export function JenkinsLinksModal({
  project,
  links,
  envPreviews,
  onClose,
}: JenkinsLinksModalProps) {
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
    <ul className="flex flex-col">
      {items.map((link) => (
        <li key={link.url}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
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
      <section className="mt-3 first:mt-0">
        <h3 className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {title}
        </h3>
        {renderLinks(items)}
      </section>
    );

  return (
    <Modal
      open
      title={t("jenkinsLinksModal.title")}
      // No footer — just the header's X (no onCancel/onConfirm), to keep the modal short.
      onClose={onClose}
      size="lg"
      icon={<img src={jenkinsIcon} alt="" className="h-5 w-5" />}
    >
      {envPreviews.map((group) => (
        <EnvPreviewLinks key={group.branch} group={group} />
      ))}
      {section(t("jenkinsLinksModal.section.currentBranch"), current)}
      {section(t("jenkinsLinksModal.section.originBranch"), origin)}
      {section(t("jenkinsLinksModal.section.variants"), variants)}
      {section(t("jenkinsLinksModal.section.views"), views)}
    </Modal>
  );
}

/** One `env/*` branch's preview sites as a single line of locale links ("BR · MX · AR ..."), each
 *  opening its full preview URL in a new tab — everything visible at once, no picker. */
function EnvPreviewLinks({ group }: { group: EnvPreviewGroup }) {
  const { t } = useLanguage();
  return (
    <p className="mt-3 first:mt-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span>{t("jenkinsLinksModal.section.envPreviews", { branch: group.branch })}</span>
      {group.previews.map((preview) => (
        <a
          key={preview.url}
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          title={preview.url}
          className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {preview.label}
        </a>
      ))}
    </p>
  );
}
