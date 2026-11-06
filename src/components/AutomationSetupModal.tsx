import { CheckCircle2, Circle, CircleDot, Loader2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import * as boardWatcherApi from "../services/boardWatcherApi";
import type { AutomationSetupStatus } from "../services/boardWatcherApi";
import { resolveApiErrorMessage } from "../utils/apiClient";
import { SETUP_STEPS, setupStepsDone, type SetupStepKey } from "../utils/automationSetup";
import {
  BoardStep,
  BitbucketStep,
  ClaudeStep,
  ExtrasStep,
  FinishStep,
  JiraStep,
} from "./AutomationSetupSteps";
import { BetaBadge } from "./BetaBadge";
import { Modal } from "./Modal";

const STEP_LABELS: Record<SetupStepKey, TranslationKey> = {
  claude: "automationSetup.step.claude",
  jira: "automationSetup.step.jira",
  board: "automationSetup.step.board",
  bitbucket: "automationSetup.step.bitbucket",
  extras: "automationSetup.step.extras",
  finish: "automationSetup.step.finish",
};

/**
 * The guided setup of the board automations: a checklist on the left that fills in as each step
 * is checked and saved (like New task's progress), the current step's form on the right. Opens on
 * the first step not done yet; any step can be revisited and keeps what was typed in it.
 */
export function AutomationSetupModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<AutomationSetupStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState<SetupStepKey | null>(null);
  const [skipped, setSkipped] = useState<Set<SetupStepKey>>(new Set());
  // Steps opened so far stay mounted (hidden), so switching tabs keeps what was typed.
  const [opened, setOpened] = useState<Set<SetupStepKey>>(new Set());
  const [resets, setResets] = useState<Partial<Record<SetupStepKey, number>>>({});

  /** Moves to another step; the one left stays mounted unless `reset` drops it. */
  const goTo = (step: SetupStepKey, reset: SetupStepKey[] = []) => {
    setOpened((prev) => {
      const next = new Set(prev);
      if (current) next.add(current);
      for (const dropped of reset) next.delete(dropped);
      return next;
    });
    if (reset.length) {
      setResets((prev) => {
        const next = { ...prev };
        for (const dropped of reset) next[dropped] = (next[dropped] ?? 0) + 1;
        return next;
      });
    }
    setCurrent(step);
  };

  const reload = useCallback(async () => {
    try {
      const next = await boardWatcherApi.fetchSetupStatus();
      setStatus(next);
      setLoadError(null);
      return next;
    } catch (err) {
      setLoadError(resolveApiErrorMessage(err, t, "automationSetup.loadError"));
      return null;
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void boardWatcherApi
      .fetchSetupStatus()
      .then((first) => {
        if (cancelled) return;
        setStatus(first);
        const done = setupStepsDone(first);
        setCurrent(SETUP_STEPS.find((step) => !done[step]) ?? "finish");
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(resolveApiErrorMessage(err, t, "automationSetup.loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const done = useMemo(() => (status ? setupStepsDone(status) : null), [status]);
  const doneCount = done ? SETUP_STEPS.filter((s) => done[s] || skipped.has(s)).length : 0;

  /** After a step saves: fresh status, then the next step not done. */
  const advance = async (from: SetupStepKey) => {
    const next = await reload();
    if (!next) return;
    const nowDone = setupStepsDone(next);
    const after = SETUP_STEPS.slice(SETUP_STEPS.indexOf(from) + 1);
    // The steps after it read what was just saved: they open fresh.
    goTo(after.find((step) => !nowDone[step] && !skipped.has(step)) ?? after[0] ?? from, after);
  };

  const skip = (step: SetupStepKey) => {
    setSkipped((prev) => new Set(prev).add(step));
    const after = SETUP_STEPS.slice(SETUP_STEPS.indexOf(step) + 1);
    goTo(after[0] ?? step);
  };

  const back = (step: SetupStepKey) => {
    const index = SETUP_STEPS.indexOf(step);
    if (index > 0) goTo(SETUP_STEPS[index - 1] ?? step);
  };

  const stepProps = (step: SetupStepKey) => ({
    status: status!,
    onDone: () => advance(step),
    onBack: SETUP_STEPS.indexOf(step) > 0 ? () => back(step) : undefined,
  });

  return (
    <Modal
      open
      title={t("automationSetup.title")}
      onClose={onClose}
      size="xl"
      icon={<Wand2 className="h-5 w-5 text-violet-500 dark:text-violet-400" />}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("automationSetup.intro")}</p>
        <BetaBadge className="mt-0.5" />
      </div>

      {loadError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      {!status && !loadError && (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("automationSetup.loading")}
        </p>
      )}

      {status && done && current && (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {t("automationSetup.progress", { done: doneCount, total: SETUP_STEPS.length })}
              </span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={SETUP_STEPS.length}
              aria-valuenow={doneCount}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${(doneCount / SETUP_STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start">
            <nav
              aria-label={t("automationSetup.title")}
              className="rounded-lg md:sticky md:top-0 md:w-56 md:shrink-0 border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50"
            >
              <ol className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
                {SETUP_STEPS.map((step, index) => {
                  const isCurrent = step === current;
                  const isDone = done[step];
                  return (
                    <li key={step} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => goTo(step)}
                        aria-current={isCurrent ? "step" : undefined}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
                          isCurrent
                            ? "bg-white font-medium text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                            : "text-gray-600 hover:bg-white/70 dark:text-gray-400 dark:hover:bg-gray-900/60"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                        ) : isCurrent ? (
                          <CircleDot className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                        )}
                        <span className="whitespace-nowrap">
                          {index + 1}. {t(STEP_LABELS[step])}
                        </span>
                        {step === "extras" && !isDone && (
                          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                            {t("automationSetup.optional")}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <section className="min-w-0 flex-1 md:min-h-[28rem]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {SETUP_STEPS.indexOf(current) + 1}. {t(STEP_LABELS[current])}
              </h3>
              {SETUP_STEPS.filter((step) => step === current || opened.has(step)).map((step) => (
                <div key={`${step}-${resets[step] ?? 0}`} className="mt-2" hidden={step !== current}>
                  {step === "claude" && (
                    <ClaudeStep {...stepProps("claude")} onRecheck={() => void reload()} />
                  )}
                  {step === "jira" && <JiraStep {...stepProps("jira")} />}
                  {step === "board" && <BoardStep {...stepProps("board")} />}
                  {step === "bitbucket" && <BitbucketStep {...stepProps("bitbucket")} />}
                  {step === "extras" && (
                    <ExtrasStep {...stepProps("extras")} onSkip={() => skip("extras")} />
                  )}
                  {step === "finish" && (
                    <FinishStep {...stepProps("finish")} allDone={done} onClose={onClose} />
                  )}
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </Modal>
  );
}
