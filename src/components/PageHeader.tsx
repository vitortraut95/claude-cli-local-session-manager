import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons on the right (wrapping under the title on narrow screens). */
  actions?: ReactNode;
  /** Extra content under the title row (filters, for instance). */
  children?: ReactNode;
};

/** The top of every page: the page's one h1, a line about it, and its actions. */
export function PageHeader({ title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-gray-200 bg-white px-4 pt-5 pb-4 sm:px-7 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <h1 className="flex flex-wrap items-center gap-2 text-[22px] leading-tight font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
