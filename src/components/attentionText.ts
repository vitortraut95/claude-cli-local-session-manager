import type { TranslationKey } from "../i18n/translations";
import type { AttentionReason } from "../utils/sessionGroups";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Why a session is in "needs you", in a line. */
export function attentionText(reason: AttentionReason, t: Translate): string {
  switch (reason.kind) {
    case "missingDirectory":
      return t("sessions.reason.missingDirectory");
    case "waitingUser":
      return t("taskSidebar.reason.waitingUser");
    case "launchError":
      return t("taskSidebar.reason.launchError", { message: reason.message });
    case "testFailed":
      return t("taskSidebar.reason.testFailed", { message: reason.message });
    case "reviewFailed":
      return t("taskSidebar.reason.reviewFailed", { message: reason.message });
  }
}
