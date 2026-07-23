import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
};

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="z-50 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {content}
          <RadixTooltip.Arrow className="fill-gray-900" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
