import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

import type { Step } from "../utils/steps";

export function StepList<K extends string>({ steps }: { steps: Step<K>[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-2">
          {step.status === "pending" && (
            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
          )}
          {step.status === "doing" && (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-gray-500 dark:text-gray-400" />
          )}
          {step.status === "done" && (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
          )}
          {step.status === "error" && (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />
          )}
          <div>
            <p
              className={`text-sm ${
                step.status === "pending"
                  ? "text-gray-400 dark:text-gray-500"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {step.label}
            </p>
            {step.status === "error" && step.error && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{step.error}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
