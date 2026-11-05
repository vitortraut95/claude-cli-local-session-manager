import { ExternalLink, FolderKanban, GitPullRequest, Hammer } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { subjectKind, subjectLinks, type SubjectKind } from "../utils/boardWatcher";

const ICONS: Record<SubjectKind, typeof GitPullRequest> = {
  pr: GitPullRequest,
  task: FolderKanban,
  build: Hammer,
};

const TONES: Record<SubjectKind, string> = {
  pr: "text-violet-300 bg-violet-500/10 ring-violet-400/20",
  task: "text-cyan-300 bg-cyan-500/10 ring-cyan-400/20",
  build: "text-fuchsia-300 bg-fuchsia-500/10 ring-fuchsia-400/20",
};

/** What a Board line is about, at a glance: a PR, a ticket or a build. */
export function SubjectIcon({ subject }: { subject: string }) {
  const kind = subjectKind(subject);
  const Icon = ICONS[kind];
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${TONES[kind]}`}
      aria-hidden="true"
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** "Open PR" / "Open ticket" buttons for a subject. */
export function SubjectLinks({
  subject,
  bases,
}: {
  subject: string;
  bases: { jira: string | null; bitbucket: string | null } | undefined;
}) {
  const { t } = useLanguage();
  const links = subjectLinks(subject, bases);
  if (links.length === 0) return null;
  return (
    <span className="flex shrink-0 gap-1">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-inset ring-violet-400/25 hover:bg-violet-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
        >
          {link.kind === "pr" ? t("board.link.pr") : t("board.link.issue")}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ))}
    </span>
  );
}
