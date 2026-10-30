/**
 * Atlassian Document Format (Jira Cloud's rich text) to plain markdown, enough for the
 * description gate and the test plan detection: headings, bold, lists, links, media and rules.
 */

type AdfNode = {
  type: string;
  text?: string;
  content?: AdfNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
};

function isNode(value: unknown): value is AdfNode {
  return Boolean(value) && typeof value === "object" && typeof (value as AdfNode).type === "string";
}

function inline(nodes: AdfNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type === "inlineCard" || node.type === "blockCard") {
        return typeof node.attrs?.url === "string" ? node.attrs.url : "";
      }
      if (node.type === "mention")
        return typeof node.attrs?.text === "string" ? node.attrs.text : "";
      if (node.type === "emoji") return typeof node.attrs?.text === "string" ? node.attrs.text : "";
      if (node.type !== "text") return inline(node.content);
      let text = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "strong") text = `**${text}**`;
        if (mark.type === "link" && typeof mark.attrs?.href === "string") {
          text = `[${text}](${mark.attrs.href})`;
        }
      }
      return text;
    })
    .join("");
}

function block(node: AdfNode, indent = ""): string {
  switch (node.type) {
    case "paragraph":
      return `${indent}${inline(node.content)}`;
    case "heading": {
      const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
      return `${"#".repeat(level)} ${inline(node.content)}`;
    }
    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => {
          const bullet = node.type === "orderedList" ? `${index + 1}.` : "-";
          const [first, ...rest] = item.content ?? [];
          const head = first ? block(first).trimStart() : "";
          const tail = rest.map((child) => block(child, `${indent}  `)).join("\n");
          return `${indent}${bullet} ${head}${tail ? `\n${tail}` : ""}`;
        })
        .join("\n");
    case "rule":
      return "---";
    case "mediaSingle":
    case "mediaGroup":
      return (node.content ?? [])
        .map((media) => `![${typeof media.attrs?.alt === "string" ? media.attrs.alt : ""}](media)`)
        .join("\n");
    case "codeBlock":
      return `\`\`\`\n${inline(node.content)}\n\`\`\``;
    default:
      return (node.content ?? []).map((child) => block(child, indent)).join("\n\n");
  }
}

export function adfToMarkdown(doc: unknown): string {
  if (typeof doc === "string") return doc;
  if (!isNode(doc)) return "";
  return block(doc).trim();
}
