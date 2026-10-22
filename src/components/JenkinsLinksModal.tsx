import { ExternalLink, Eye, GitBranch, GitPullRequest, Home, Tag } from "lucide-react";
import type { ReactNode } from "react";
import jenkinsIcon from "../assets/jenkins.svg";
import { useLanguage } from "../hooks/useLanguage";
import type { EnvPreviewGroup, JenkinsLink, JenkinsRepoGroup } from "../utils/jenkins";
import { Modal } from "./Modal";

type JenkinsLinksModalProps = {
  /** The session's repo first, then the task's other repos. */
  groups: JenkinsRepoGroup[];
  onClose: () => void;
};

/**
 * Every Jenkins link that could apply to this session (and its task's other repos), as new-tab
 * links. None are checked for existence, so the modal stays open after a click in case one is a
 * 404.
 */
export function JenkinsLinksModal({ groups, onClose }: JenkinsLinksModalProps) {
  const { t } = useLanguage();
  const multiRepo = groups.length > 1;

  return (
    <Modal
      open
      title={t("jenkinsLinksModal.title")}
      onClose={onClose}
      size="lg"
      icon={<img src={jenkinsIcon} alt="" className="h-5 w-5" />}
    >
      {groups.map((group) =>
        multiRepo ? (
          <section
            key={group.project}
            className="mt-4 border-t border-gray-200 pt-3 first:mt-0 first:border-t-0 first:pt-0 dark:border-gray-800"
          >
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {group.project}
            </h2>
            <RepoLinks group={group} />
          </section>
        ) : (
          <RepoLinks key={group.project} group={group} />
        ),
      )}
    </Modal>
  );
}

/** One repo's env previews and Jenkins links (current branch, origin branch, project views). */
function RepoLinks({ group }: { group: JenkinsRepoGroup }) {
  const { t } = useLanguage();
  const { project, links, envPreviews } = group;
  const current = links.filter((l) => l.kind === "branch" && l.role === "current");
  const origin = links.filter((l) => l.kind === "branch" && l.role === "origin");
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
    <>
      {envPreviews.map((preview) => (
        <EnvPreviewLinks key={preview.branch} group={preview} />
      ))}
      {section(t("jenkinsLinksModal.section.currentBranch"), current)}
      {section(t("jenkinsLinksModal.section.originBranch"), origin)}
      {section(t("jenkinsLinksModal.section.views"), views)}
    </>
  );
}

/** One `env/*` branch's preview sites as a single line of locale links ("BR · MX · AR ..."). */
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
