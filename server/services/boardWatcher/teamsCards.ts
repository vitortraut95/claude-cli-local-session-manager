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
}): CardElement {
  const body: CardElement[] = [text(options.title, { weight: "Bolder", size: "Medium" })];
  if (options.subtitle) body.push(text(options.subtitle, { isSubtle: true, spacing: "None" }));
  for (const section of options.sections) {
    if (section.items.length === 0) continue;
    const shown = section.items.slice(0, MAX_ITEMS_PER_SECTION);
    const hidden = section.items.length - shown.length;
    body.push({
      type: "Container",
      separator: true,
      spacing: "Medium",
      items: [
        text(`${section.heading} (${section.items.length})`, { weight: "Bolder" }),
        ...shown.map((item) => text(`• ${item}`, { spacing: "Small" })),
        ...(hidden > 0 ? [text(`… e mais ${hidden}`, { isSubtle: true })] : []),
      ],
    });
  }
  const actions = options.link
    ? [{ type: "Action.OpenUrl", title: options.link.title, url: options.link.url }]
    : [];
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
