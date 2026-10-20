export type StepStatus = "pending" | "doing" | "done" | "error";
export type Step<K extends string = string> = {
  key: K;
  label: string;
  status: StepStatus;
  error?: string;
};

export function withStepStatus<K extends string>(
  steps: Step<K>[],
  key: K,
  status: StepStatus,
  error?: string,
): Step<K>[] {
  return steps.map((step) => (step.key === key ? { ...step, status, error } : step));
}

/** Marks whichever step was running as failed with `message`. */
export function withDoingStepFailed<K extends string>(
  steps: Step<K>[],
  message: string,
): Step<K>[] {
  return steps.map((step) =>
    step.status === "doing" ? { ...step, status: "error", error: message } : step,
  );
}
