import { ExternalLink, Rocket, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useToast } from "../hooks/useToast";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type { HomologCandidate } from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

/** "Point to homolog": a ticket's PR branches, each deployable to homolog through a Jenkins
 *  Replay after the user confirms (homolog is shared: it replaces what's there). */
export function HomologPanel() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [key, setKey] = useState("");
  const [candidates, setCandidates] = useState<HomologCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<HomologCandidate | null>(null);
  const [pointing, setPointing] = useState(false);
  const [started, setStarted] = useState<(HomologCandidate & { buildUrl: string })[]>([]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const ticket = key.trim().toUpperCase();
    if (!ticket) return;
    setSearching(true);
    try {
      setCandidates(await boardWatcherApi.fetchHomologCandidates(ticket));
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.homolog.searchError"), "error");
    } finally {
      setSearching(false);
    }
  };

  const point = async () => {
    if (!confirming) return;
    setPointing(true);
    try {
      const { buildUrl } = await boardWatcherApi.pointToHomolog(confirming.repo, confirming.branch);
      setStarted((list) => [{ ...confirming, buildUrl }, ...list]);
      showToast(t("board.homolog.started"), "success");
      setConfirming(null);
    } catch (err) {
      showToast(resolveApiErrorMessage(err, t, "board.homolog.pointError"), "error");
    } finally {
      setPointing(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t("board.homolog.title")}
      </h3>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void search(e)}>
        <label className="sr-only" htmlFor="homolog-key">
          {t("board.homolog.keyLabel")}
        </label>
        <input
          id="homolog-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t("board.homolog.keyPlaceholder")}
          className="w-40 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={searching || !key.trim()}
          icon={<Search className="h-3.5 w-3.5" />}
        >
          {searching ? t("board.homolog.searching") : t("board.homolog.search")}
        </Button>
      </form>
      {candidates?.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("board.homolog.none")}</p>
      )}
      {candidates && candidates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {candidates.map((c) => (
            <li
              key={`${c.repo} ${c.branch}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
            >
              <span className="break-all font-mono text-xs text-gray-900 dark:text-gray-100">
                {c.repo} · {c.branch}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(c)}
                icon={<Rocket className="h-3.5 w-3.5" />}
              >
                {t("board.homolog.point")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {started.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
          {started.map((s) => (
            <li key={s.buildUrl}>
              {t("board.homolog.building", { repo: s.repo, branch: s.branch })}{" "}
              <a
                href={s.buildUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
              >
                {t("board.decision.openJenkins")}
                <ExternalLink aria-hidden className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={t("board.homolog.confirmTitle")}
        message={t("board.homolog.confirmMessage", {
          repo: confirming?.repo ?? "",
          branch: confirming?.branch ?? "",
        })}
        confirmLabel={t("board.homolog.confirm")}
        isLoading={pointing}
        onConfirm={() => void point()}
        onCancel={() => setConfirming(null)}
      />
    </section>
  );
}
