import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
};

export function Tooltip({ content, children }: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <RadixTooltip.Root delayDuration={0} disableHoverableContent>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg max-w-xl border border-stone-700"
        >
          {content}
          <RadixTooltip.Arrow className="fill-stone-700" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
