import type { Language } from "../services/tasksApi";

export type { Language };

export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
];

/** Maps the browser's own language (`navigator.languages`, falling back to `navigator.language`)
 *  to one of the three supported languages — used only when the user has never explicitly picked
 *  one via the header switcher (`UserPreferences.language` is null). Anything unrecognized falls
 *  back to English rather than guessing. */
export function detectBrowserLanguage(): Language {
  const candidates = navigator.languages ?? [navigator.language];
  for (const raw of candidates) {
    const prefix = raw.slice(0, 2).toLowerCase();
    if (prefix === "pt" || prefix === "es" || prefix === "en") return prefix;
  }
  return "en";
}

type Dict = Record<Language, string>;

function dict(en: string, pt: string, es: string): Dict {
  return { en, pt, es };
}

/**
 * Hand-rolled instead of a library (react-i18next/i18next) on purpose — this app has no other
 * cross-cutting library dependency (theme/toast/usage are all small hand-rolled hooks), only 3
 * languages, and no plural/ICU-message needs. Covers the Header and the onboarding modal only for
 * now — the rest of the app's text (SessionCard, other modals, filters, toasts) is a deliberate
 * follow-up, not translated yet.
 */
export const translations = {
  "header.subtitle": dict(
    "Manage your local Claude CLI sessions",
    "Gerencie suas sessões locais do Claude CLI",
    "Administra tus sesiones locales de Claude CLI",
  ),
  "header.newTask": dict("New task", "Nova tarefa", "Nueva tarea"),
  "header.cleanup": dict("Cleanup", "Limpeza", "Limpieza"),
  "header.help": dict("How this works", "Como funciona", "Cómo funciona"),
  "header.language": dict("Language", "Idioma", "Idioma"),

  "onboarding.title": dict(
    "How the worktree workflow works",
    "Como funciona o fluxo de trabalho com worktrees",
    "Cómo funciona el flujo de trabajo con worktrees",
  ),
  "onboarding.intro": dict(
    "Every new task gets its own isolated working folder (a git worktree), so you can run " +
      "several tasks in parallel without one stepping on another's code. Here's the workflow " +
      "from start to finish.",
    "Cada tarefa nova ganha sua própria pasta de trabalho isolada (um worktree do git), então " +
      "você pode rodar várias tarefas em paralelo sem que uma pise no código da outra. Aqui está " +
      "o fluxo do início ao fim.",
    "Cada tarea nueva obtiene su propia carpeta de trabajo aislada (un worktree de git), así " +
      "puedes ejecutar varias tareas en paralelo sin que una interfiera con el código de otra. " +
      "Este es el flujo de principio a fin.",
  ),

  "onboarding.step1.title": dict(
    "1. Start a task",
    "1. Comece uma tarefa",
    "1. Inicia una tarea",
  ),
  "onboarding.step1.body": dict(
    "\"New task\" creates a worktree and opens a terminal there already running Claude with " +
      "your prompt. The main project folder is left untouched — you (or another task) can keep " +
      "using it at the same time.",
    "\"New task\" cria um worktree e abre um terminal já rodando o Claude com o seu prompt. A " +
      "pasta principal do projeto fica intacta — você (ou outra tarefa) pode continuar usando ela " +
      "ao mesmo tempo.",
    "\"New task\" crea un worktree y abre una terminal que ya ejecuta Claude con tu prompt. La " +
      "carpeta principal del proyecto queda intacta — tú (u otra tarea) puedes seguir usándola al " +
      "mismo tiempo.",
  ),

  "onboarding.step2.title": dict(
    "2. Test locally without commitment",
    "2. Teste localmente sem compromisso",
    "2. Prueba localmente sin compromiso",
  ),
  "onboarding.step2.body": dict(
    "Once the task looks done, use \"Worktree → root\" → \"Copy files only\" to copy its files " +
      "into the project's root folder so you can test using your usual local setup. This doesn't " +
      "commit or push anything — it's disposable, and you can repeat it as many times as you " +
      "like (each copy discards the previous one, recoverably, via git stash).",
    "Quando a tarefa parecer pronta, use \"Worktree → root\" → \"Copy files only\" pra copiar os " +
      "arquivos dela pra pasta raiz do projeto e testar usando o seu ambiente local de sempre. " +
      "Isso não commita nem faz push de nada — é descartável, e você pode repetir quantas vezes " +
      "quiser (cada cópia descarta a anterior, de forma recuperável, via git stash).",
    "Cuando la tarea parezca lista, usa \"Worktree → root\" → \"Copy files only\" para copiar sus " +
      "archivos a la carpeta raíz del proyecto y probar usando tu entorno local habitual. Esto no " +
      "hace commit ni push de nada — es descartable, y puedes repetirlo tantas veces como " +
      "quieras (cada copia descarta la anterior, de forma recuperable, vía git stash).",
  ),

  "onboarding.step3.title": dict(
    "3. Finish it for real",
    "3. Finalize de verdade",
    "3. Finaliza de verdad",
  ),
  "onboarding.step3.body": dict(
    "The real commits live in the worktree's own branch — push and open your PR from a " +
      "terminal there, not from the root copy (that copy is just uncommitted preview files). " +
      "Alternatively, \"Remove worktree & checkout branch\" moves the branch (with full history) " +
      "into the root folder in one step — but that's irreversible: the worktree gets deleted, so " +
      "its session can no longer be resumed afterward.",
    "Os commits reais ficam na própria branch do worktree — faça push e abra o PR a partir de um " +
      "terminal ali, não a partir da cópia na raiz (essa cópia é só um preview sem commit). " +
      "Como alternativa, \"Remove worktree & checkout branch\" move a branch (com todo o " +
      "histórico) pra pasta raiz de uma vez só — mas isso é irreversível: o worktree é deletado, " +
      "então a sessão dele não pode mais ser retomada depois.",
    "Los commits reales están en la propia rama del worktree — haz push y abre tu PR desde una " +
      "terminal ahí, no desde la copia en la raíz (esa copia es solo una vista previa sin " +
      "commit). Como alternativa, \"Remove worktree & checkout branch\" mueve la rama (con todo " +
      "el historial) a la carpeta raíz en un solo paso — pero es irreversible: el worktree se " +
      "elimina, así que su sesión ya no se puede reanudar después.",
  ),

  "onboarding.step4.title": dict(
    "4. Clean up — but only once it's pushed",
    "4. Limpe — mas só depois do push",
    "4. Limpia — pero solo después del push",
  ),
  "onboarding.step4.body": dict(
    "\"Clean up worktree\" removes the folder and force-deletes its local branch. There's no " +
      "check for unpushed commits, so only delete a worktree after its branch is safely on the " +
      "remote (ideally after the PR is merged) — otherwise you can lose local commits that " +
      "reviewers might still ask you to change.",
    "\"Clean up worktree\" remove a pasta e força a deleção da branch local. Não existe checagem " +
      "de commits não enviados, então só delete um worktree depois que a branch estiver a salvo " +
      "no remoto (idealmente depois do PR mergeado) — senão você pode perder commits locais que " +
      "os revisores ainda podem pedir pra mudar.",
    "\"Clean up worktree\" elimina la carpeta y fuerza la eliminación de su rama local. No hay " +
      "verificación de commits sin enviar, así que solo elimina un worktree después de que su " +
      "rama esté a salvo en el remoto (idealmente después de que el PR se haya fusionado) — de " +
      "lo contrario puedes perder commits locales que los revisores todavía podrían pedirte " +
      "cambiar.",
  ),

  "onboarding.step5.title": dict(
    "5. If the worktree folder disappears",
    "5. Se a pasta do worktree desaparecer",
    "5. Si la carpeta del worktree desaparece",
  ),
  "onboarding.step5.body": dict(
    "After a checkout, that session's card shows \"Original folder missing\" — expected, since " +
      "the worktree was removed on purpose. If the project's root folder still exists, the card " +
      "offers to open it in VS Code, or to continue working there: resuming an existing session " +
      "already at the root if one exists, or starting a fresh conversation seeded with a recap " +
      "of what the old one did.",
    "Depois de um checkout, o card daquela sessão mostra \"Original folder missing\" — esperado, " +
      "já que o worktree foi removido de propósito. Se a pasta raiz do projeto ainda existir, o " +
      "card oferece abrir ela no VS Code, ou continuar o trabalho ali: retomando uma sessão já " +
      "existente na raiz, se houver uma, ou começando uma conversa nova alimentada com um resumo " +
      "do que a antiga fez.",
    "Después de un checkout, la tarjeta de esa sesión muestra \"Original folder missing\" — es " +
      "esperado, ya que el worktree se eliminó a propósito. Si la carpeta raíz del proyecto " +
      "todavía existe, la tarjeta ofrece abrirla en VS Code, o continuar trabajando ahí: " +
      "reanudando una sesión ya existente en la raíz, si hay una, o iniciando una conversación " +
      "nueva alimentada con un resumen de lo que hizo la anterior.",
  ),
} satisfies Record<string, Dict>;

export type TranslationKey = keyof typeof translations;

export function t(language: Language, key: TranslationKey): string {
  return translations[key][language];
}
