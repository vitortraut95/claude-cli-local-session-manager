import { useLanguage } from "../hooks/useLanguage";

/** Running (filled green, with a halo) or stopped (hollow gray); red is kept for errors only. */
export function LiveDot({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const label = active ? t("sessions.live.running") : t("sessions.live.stopped");
  return (
    <span
      role="img"
      aria-label={label}
      title={
        active ? t("sessionCard.status.activeTooltip") : t("sessionCard.status.inactiveTooltip")
      }
      className={`h-2 w-2 shrink-0 rounded-full ${
        active
          ? "bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.2)] dark:bg-emerald-400"
          : "border-[1.5px] border-gray-400 dark:border-gray-500"
      }`}
    />
  );
}
