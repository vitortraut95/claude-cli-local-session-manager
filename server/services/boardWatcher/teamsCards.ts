/**
 * Teams messages for the board watcher, posted to a Workflows "Send webhook alerts to a chat"
 * URL as Adaptive Cards 1.2 (newer versions are rejected by the Flow bot). Text is in pt-BR, the
 * user's language; decision reasons are translated here.
 */

export type CardSection = { heading: string; items: string[] };

type CardElement = Record<string, unknown>;

const MAX_ITEMS_PER_SECTION = 15;

const REASONS_PT: [RegExp, string][] = [
  [/^description scored (\d)\/5/, "nota $1/5"],
  [/no description/, "sem descrição"],
  [/short description/, "descrição curta"],
  [
    /no steps, acceptance criteria or Given\/When\/Then/,
    "sem passos, critérios de aceite ou Dado/Quando/Então",
  ],
  [/no expected result/, "sem resultado esperado"],
  [/no page or URL/, "sem página ou URL"],
  [/no screenshot or Figma/, "sem print ou Figma"],
  [/visual change without Figma/, "mudança visual sem Figma"],
  [/the user developed it/, "você é o dev"],
  [/no test plan in the comments/, "sem plano de teste nos comentários"],
  [/already tested since the last plan/, "já testada depois do último plano"],
  [/outside business hours/, "fora do horário comercial"],
  [/(\d+) tests already claimed/, "já há $1 testes em andamento"],
  [/test plan in comment \S+/, "tem plano de teste"],
  [/no ticket in the PR title or branch/, "sem LED no título ou na branch do PR"],
  [/ticket (.+) isn't in Code Review yet/, "$1 ainda não está em Code Review"],
];

export function reasonPtBr(reason: string): string {
  return REASONS_PT.reduce((text, [pattern, pt]) => text.replace(pattern, pt), reason);
}

function text(value: string, extra: CardElement = {}): CardElement {
  return { type: "TextBlock", text: value, wrap: true, ...extra };
}

function card(body: CardElement[], actions: CardElement[] = []): CardElement {
  return { type: "AdaptiveCard", version: "1.2", body, actions };
}

export function buildDigestCard(options: {
  title: string;
  subtitle?: string;
  sections: CardSection[];
  link?: { title: string; url: string };
  /** More buttons after `link`. */
  extraLinks?: { title: string; url: string }[];
  /** A one-line summary under the title (e.g. the counts). */
  headline?: string;
  /** Items shown per section (default 15); the rest become "… and N more" plus `moreHint`. */
  maxItemsPerSection?: number;
  moreHint?: string;
}): CardElement {
  const body: CardElement[] = [text(options.title, { weight: "Bolder", size: "Medium" })];
  if (options.headline) body.push(text(options.headline, { spacing: "Small" }));
  if (options.subtitle) body.push(text(options.subtitle, { isSubtle: true, spacing: "None" }));
  const maxItems = options.maxItemsPerSection ?? MAX_ITEMS_PER_SECTION;
  for (const section of options.sections) {
    if (section.items.length === 0) continue;
    const shown = section.items.slice(0, maxItems);
    const hidden = section.items.length - shown.length;
    body.push({
      type: "Container",
      separator: true,
      spacing: "Medium",
      items: [
        text(`${section.heading} (${section.items.length})`, { weight: "Bolder" }),
        ...shown.map((item) => text(`• ${item}`, { spacing: "Small" })),
        ...(hidden > 0
          ? [
              text(`… e mais ${hidden}${options.moreHint ? ` ${options.moreHint}` : ""}`, {
                isSubtle: true,
              }),
            ]
          : []),
      ],
    });
  }
  const actions = [...(options.link ? [options.link] : []), ...(options.extraLinks ?? [])].map(
    (link) => ({ type: "Action.OpenUrl", title: link.title, url: link.url }),
  );
  return card(body, actions);
}

export function buildUrgentCard(options: {
  title: string;
  text: string;
  link?: { title: string; url: string };
}): CardElement {
  return card(
    [
      text(`⚠️ ${options.title}`, { weight: "Bolder", size: "Medium", color: "Attention" }),
      text(options.text),
    ],
    options.link
      ? [{ type: "Action.OpenUrl", title: options.link.title, url: options.link.url }]
      : [],
  );
}

export async function postTeamsCard(webhookUrl: string, content: CardElement): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "message",
      attachments: [
        { contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Teams webhook answered ${response.status}.`);
}

/** 🔴 needs the user now · 🟡 good to know · 🔵 summary. */
export type NoticeLevel = "urgent" | "info" | "digest";

const LEVEL_MARK: Record<NoticeLevel, string> = { urgent: "🔴", info: "🟡", digest: "🔵" };

/** One short Teams message: a title with the ticket first, one line, and the long part hidden
 *  behind "Ver detalhes". */
export type Notice = {
  level: NoticeLevel;
  /** "PROJ-123 · esperando você": the subject first, then what happened. */
  title: string;
  summary: string;
  /** Shown under the summary (not hidden): what needs a look. */
  highlights?: CardSection;
  details?: CardSection[];
  links?: { title: string; url: string }[];
};

function detailsContainer(id: string, sections: CardSection[]): CardElement {
  return {
    type: "Container",
    id,
    isVisible: false,
    items: sections
      .filter((section) => section.items.length > 0)
      .flatMap((section) => [
        text(section.heading, { weight: "Bolder", spacing: "Medium" }),
        ...section.items.map((item) => text(item, { spacing: "Small" })),
      ]),
  };
}

function noticeActions(notice: Notice, detailsId: string | null): CardElement[] {
  return [
    ...(detailsId
      ? [{ type: "Action.ToggleVisibility", title: "Ver detalhes", targetElements: [detailsId] }]
      : []),
    ...(notice.links ?? []).map((link) => ({
      type: "Action.OpenUrl",
      title: link.title,
      url: link.url,
    })),
  ];
}

export function buildNoticeCard(notice: Notice): CardElement {
  const hasDetails = (notice.details ?? []).some((section) => section.items.length > 0);
  return card(
    [
      text(`${LEVEL_MARK[notice.level]} ${notice.title}`, { weight: "Bolder" }),
      text(notice.summary, { isSubtle: true, spacing: "Small" }),
      ...(notice.highlights && notice.highlights.items.length > 0
        ? [
            text(notice.highlights.heading, { weight: "Bolder", spacing: "Medium" }),
            ...notice.highlights.items.map((item) => text(`• ${item}`, { spacing: "Small" })),
          ]
        : []),
      ...(hasDetails ? [detailsContainer("details", notice.details ?? [])] : []),
    ],
    noticeActions(notice, hasDetails ? "details" : null),
  );
}

/** Several notices that came close together, as one message: a line each, details per item. */
export function buildNoticesCard(notices: Notice[]): CardElement {
  const level: NoticeLevel = notices.some((n) => n.level === "urgent") ? "urgent" : "info";
  const body: CardElement[] = [
    text(`${LEVEL_MARK[level]} ${notices.length} avisos`, { weight: "Bolder" }),
  ];
  notices.forEach((notice, index) => {
    const id = `details${index}`;
    const hasDetails = (notice.details ?? []).some((section) => section.items.length > 0);
    body.push({
      type: "Container",
      separator: true,
      spacing: "Medium",
      items: [
        text(`${LEVEL_MARK[notice.level]} ${notice.title}`, { weight: "Bolder" }),
        text(notice.summary, { isSubtle: true, spacing: "Small" }),
        ...(hasDetails ? [detailsContainer(id, notice.details ?? [])] : []),
        { type: "ActionSet", actions: noticeActions(notice, hasDetails ? id : null) },
      ],
    });
  });
  return card(body);
}
