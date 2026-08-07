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
    "Manage your local sessions",
    "Gerencie suas sessões locais",
    "Administra tus sesiones locales",
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

  "onboarding.step1.title": dict("1. Start a task", "1. Comece uma tarefa", "1. Inicia una tarea"),
  "onboarding.step1.body": dict(
    '"New task" creates a worktree and opens a terminal there already running Claude with ' +
      "your prompt. The main project folder is left untouched — you (or another task) can keep " +
      "using it at the same time.",
    '"Nova tarefa" cria um worktree e abre um terminal já rodando o Claude com o seu prompt. A ' +
      "pasta principal do projeto fica intacta — você (ou outra tarefa) pode continuar usando ela " +
      "ao mesmo tempo.",
    '"Nueva tarea" crea un worktree y abre una terminal que ya ejecuta Claude con tu prompt. La ' +
      "carpeta principal del proyecto queda intacta — tú (u otra tarea) puedes seguir usándola al " +
      "mismo tiempo.",
  ),

  "onboarding.step2.title": dict(
    "2. Test locally without commitment",
    "2. Teste localmente sem compromisso",
    "2. Prueba localmente sin compromiso",
  ),
  "onboarding.step2.body": dict(
    'Once the task looks done, use "Worktree → root" → "Copy files only" to copy its files ' +
      "into the project's root folder so you can test using your usual local setup. This doesn't " +
      "commit or push anything — it's disposable, and you can repeat it as many times as you " +
      "like (each copy discards the previous one, recoverably, via git stash).",
    'Quando a tarefa parecer pronta, use "Worktree → raiz" → "Copiar apenas os arquivos" pra ' +
      "copiar os arquivos dela pra pasta raiz do projeto e testar usando o seu ambiente local de " +
      "sempre. Isso não commita nem faz push de nada — é descartável, e você pode repetir quantas " +
      "vezes quiser (cada cópia descarta a anterior, de forma recuperável, via git stash).",
    'Cuando la tarea parezca lista, usa "Worktree → raíz" → "Copiar solo los archivos" para ' +
      "copiar sus archivos a la carpeta raíz del proyecto y probar usando tu entorno local " +
      "habitual. Esto no hace commit ni push de nada — es descartable, y puedes repetirlo tantas " +
      "veces como quieras (cada copia descarta la anterior, de forma recuperable, vía git stash).",
  ),

  "onboarding.step3.title": dict(
    "3. Finish it for real",
    "3. Finalize de verdade",
    "3. Finaliza de verdad",
  ),
  "onboarding.step3.body": dict(
    "The real commits live in the worktree's own branch — push and open your PR from a " +
      "terminal there, not from the root copy (that copy is just uncommitted preview files). " +
      'Alternatively, "Remove worktree & checkout branch" moves the branch (with full history) ' +
      "into the root folder in one step — but that's irreversible: the worktree gets deleted, so " +
      "its session can no longer be resumed afterward.",
    "Os commits reais ficam na própria branch do worktree — faça push e abra o PR a partir de um " +
      "terminal ali, não a partir da cópia na raiz (essa cópia é só um preview sem commit). " +
      'Como alternativa, "Remover worktree e fazer checkout da branch" move a branch (com todo ' +
      "o histórico) pra pasta raiz de uma vez só — mas isso é irreversível: o worktree é " +
      "deletado, então a sessão dele não pode mais ser retomada depois.",
    "Los commits reales están en la propia rama del worktree — haz push y abre tu PR desde una " +
      "terminal ahí, no desde la copia en la raíz (esa copia es solo una vista previa sin " +
      'commit). Como alternativa, "Eliminar worktree y hacer checkout de la rama" mueve la ' +
      "rama (con todo el historial) a la carpeta raíz en un solo paso — pero es irreversible: el " +
      "worktree se elimina, así que su sesión ya no se puede reanudar después.",
  ),

  "onboarding.step4.title": dict(
    "4. Clean up — but only once it's pushed",
    "4. Limpe — mas só depois do push",
    "4. Limpia — pero solo después del push",
  ),
  "onboarding.step4.body": dict(
    '"Clean up worktree" removes the folder and force-deletes its local branch. There\'s no ' +
      "check for unpushed commits, so only delete a worktree after its branch is safely on the " +
      "remote (ideally after the PR is merged) — otherwise you can lose local commits that " +
      "reviewers might still ask you to change.",
    '"Limpar worktree" remove a pasta e força a deleção da branch local. Não existe checagem ' +
      "de commits não enviados, então só delete um worktree depois que a branch estiver a salvo " +
      "no remoto (idealmente depois do PR mergeado) — senão você pode perder commits locais que " +
      "os revisores ainda podem pedir pra mudar.",
    '"Limpiar worktree" elimina la carpeta y fuerza la eliminación de su rama local. No hay ' +
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
    'After a checkout, that session\'s card shows "Original folder missing" — expected, since ' +
      "the worktree was removed on purpose. If the project's root folder still exists, the card " +
      "offers to open it in VS Code, or to continue working there: resuming an existing session " +
      "already at the root if one exists, or starting a fresh conversation seeded with a recap " +
      "of what the old one did.",
    'Depois de um checkout, o card daquela sessão mostra "Pasta original ausente" — esperado, ' +
      "já que o worktree foi removido de propósito. Se a pasta raiz do projeto ainda existir, o " +
      "card oferece abrir ela no VS Code, ou continuar o trabalho ali: retomando uma sessão já " +
      "existente na raiz, se houver uma, ou começando uma conversa nova alimentada com um resumo " +
      "do que a antiga fez.",
    'Después de un checkout, la tarjeta de esa sesión muestra "Falta la carpeta original" — es ' +
      "esperado, ya que el worktree se eliminó a propósito. Si la carpeta raíz del proyecto " +
      "todavía existe, la tarjeta ofrece abrirla en VS Code, o continuar trabajando ahí: " +
      "reanudando una sesión ya existente en la raíz, si hay una, o iniciando una conversación " +
      "nueva alimentada con un resumen de lo que hizo la anterior.",
  ),
  "confirmDialog.confirm": dict("Confirm", "Confirmar", "Confirmar"),
  "confirmDialog.cancel": dict("Cancel", "Cancelar", "Cancelar"),

  "nicknameModal.title": dict("Local nickname", "Apelido local", "Apodo local"),
  "nicknameModal.save": dict("Save", "Salvar", "Guardar"),
  "nicknameModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "nicknameModal.description": dict(
    "Only shown in this app's session list, alongside the session's real title — it won't rename the session or change what any terminal (including Warp) shows for it. Leave blank to remove the nickname.",
    "Aparece só na lista de sessões deste app, ao lado do título real da sessão — não renomeia a sessão nem muda o que qualquer terminal (incluindo o Warp) exibe para ela. Deixe em branco para remover o apelido.",
    "Solo se muestra en la lista de sesiones de esta app, junto al título real de la sesión — no renombra la sesión ni cambia lo que muestra cualquier terminal (incluido Warp). Déjalo en blanco para quitar el apodo.",
  ),
  "nicknameModal.placeholder": dict("Nickname", "Apelido", "Apodo"),

  "promptPreviewModal.loading": dict(
    "Loading prompts…",
    "Carregando prompts…",
    "Cargando prompts…",
  ),
  "promptPreviewModal.empty": dict(
    "No prompts found for this session.",
    "Nenhum prompt encontrado para esta sessão.",
    "No se encontraron prompts para esta sesión.",
  ),
  "promptPreviewModal.loadError": dict(
    "Couldn't load the full prompt text — showing a possibly truncated version.",
    "Não foi possível carregar o texto completo do prompt — mostrando uma versão possivelmente truncada.",
    "No se pudo cargar el texto completo del prompt — mostrando una versión posiblemente truncada.",
  ),

  "usageDetailsModal.empty": dict(
    "No token usage found for this session.",
    "Nenhum uso de tokens encontrado para esta sessão.",
    "No se encontró uso de tokens para esta sesión.",
  ),
  "usageDetailsModal.unknownPricing": dict(
    "Unknown pricing",
    "Preço desconhecido",
    "Precio desconocido",
  ),
  "usageDetailsModal.input": dict("Input:", "Entrada:", "Entrada:"),
  "usageDetailsModal.output": dict("Output:", "Saída:", "Salida:"),
  "usageDetailsModal.cacheWrite": dict("Cache write:", "Escrita em cache:", "Escritura de caché:"),
  "usageDetailsModal.cacheRead": dict("Cache read:", "Leitura de cache:", "Lectura de caché:"),
  "usageDetailsModal.subagentCount.one": dict(
    "Of which 1 subagent",
    "Sendo 1 subagente",
    "De los cuales 1 subagente",
  ),
  "usageDetailsModal.subagentCount.many": dict(
    "Of which {count} subagents",
    "Sendo {count} subagentes",
    "De los cuales {count} subagentes",
  ),
  "usageDetailsModal.estimatedTotal": dict("Estimated total", "Total estimado", "Total estimado"),
  "usageDetailsModal.unavailable": dict("Unavailable", "Indisponível", "No disponible"),
  "usageDetailsModal.disclaimer": dict(
    "Estimated from token counts using Anthropic's public API pricing, assuming the default 5-minute cache TTL. This is not your actual bill — it doesn't account for a Pro/Max subscription, promotional pricing changes, or other plan specifics.",
    "Estimado a partir da contagem de tokens usando os preços públicos da API da Anthropic, assumindo o TTL padrão de cache de 5 minutos. Isso não é sua conta real — não considera assinatura Pro/Max, mudanças promocionais de preço ou outras particularidades do plano.",
    "Estimado a partir del recuento de tokens usando los precios públicos de la API de Anthropic, asumiendo el TTL de caché predeterminado de 5 minutos. Esto no es tu factura real — no tiene en cuenta una suscripción Pro/Max, cambios de precio promocionales u otras particularidades del plan.",
  ),

  "subagentsModal.title": dict(
    "Subagents — {title}",
    "Subagentes — {title}",
    "Subagentes — {title}",
  ),
  "subagentsModal.showLess": dict("Show less", "Mostrar menos", "Mostrar menos"),
  "subagentsModal.showMore": dict("Show more", "Mostrar mais", "Mostrar más"),
  "subagentsModal.unknownType": dict("unknown", "desconhecido", "desconocido"),
  "subagentsModal.unknownPricing": dict(
    "Unknown pricing",
    "Preço desconhecido",
    "Precio desconocido",
  ),
  "subagentsModal.noDescription": dict("No description", "Sem descrição", "Sin descripción"),
  "subagentsModal.loadError": dict(
    "Couldn't load subagent details.",
    "Não foi possível carregar os detalhes dos subagentes.",
    "No se pudieron cargar los detalles de los subagentes.",
  ),
  "subagentsModal.retry": dict("Retry", "Tentar novamente", "Reintentar"),
  "subagentsModal.loading": dict(
    "Loading subagents…",
    "Carregando subagentes…",
    "Cargando subagentes…",
  ),
  "subagentsModal.empty": dict(
    "No subagents were spawned during this session.",
    "Nenhum subagente foi criado durante esta sessão.",
    "No se generaron subagentes durante esta sesión.",
  ),

  "insightsModal.scopeRepo": dict("Repo", "Repositório", "Repositorio"),
  "insightsModal.scopeSession": dict("Session", "Sessão", "Sesión"),
  "insightsModal.title": dict("Insights — {title}", "Insights — {title}", "Insights — {title}"),
  "insightsModal.loading": dict(
    "Checking for ways to save tokens…",
    "Verificando formas de economizar tokens…",
    "Buscando formas de ahorrar tokens…",
  ),
  "insightsModal.loadError": dict(
    "Couldn't check the repo for a CLAUDE.md or exploration patterns — showing session-level tips only.",
    "Não foi possível verificar o repositório em busca de um CLAUDE.md ou padrões de exploração — mostrando apenas dicas no nível da sessão.",
    "No se pudo verificar el repositorio en busca de un CLAUDE.md o patrones de exploración — mostrando solo consejos a nivel de sesión.",
  ),
  "insightsModal.empty": dict(
    "Nothing stands out — this session looks efficient.",
    "Nada chama atenção — esta sessão parece eficiente.",
    "Nada destaca — esta sesión se ve eficiente.",
  ),

  "searchBar.placeholder": dict(
    "Search by title, project, branch, or ID...",
    "Buscar por título, projeto, branch ou ID...",
    "Buscar por título, proyecto, branch o ID...",
  ),
  "searchBar.clearLabel": dict("Clear search", "Limpar busca", "Limpiar búsqueda"),

  "worktreeFilter.label": dict("Worktrees only", "Somente worktrees", "Solo worktrees"),

  "projectFilter.ariaLabel": dict(
    "Filter by project",
    "Filtrar por projeto",
    "Filtrar por proyecto",
  ),
  "projectFilter.allProjects": dict("All projects", "Todos os projetos", "Todos los proyectos"),

  "dateRangeFilter.fromLabel": dict("Updated from", "Atualizado a partir de", "Actualizado desde"),
  "dateRangeFilter.toLabel": dict("Updated to", "Atualizado até", "Actualizado hasta"),
  "dateRangeFilter.to": dict("to", "até", "hasta"),

  "pagination.previousLabel": dict("Previous page", "Página anterior", "Página anterior"),
  "pagination.nextLabel": dict("Next page", "Próxima página", "Página siguiente"),
  "pagination.pageInfo": dict(
    "Page {page} of {pageCount}",
    "Página {page} de {pageCount}",
    "Página {page} de {pageCount}",
  ),

  "perPageSelect.ariaLabel": dict("Sessions per page", "Sessões por página", "Sesiones por página"),
  "perPageSelect.all": dict("All", "Todas", "Todas"),
  "perPageSelect.perPage": dict("{count} / page", "{count} / página", "{count} / página"),

  "emptyState.noResultsTitle": dict(
    "No sessions found",
    "Nenhuma sessão encontrada",
    "No se encontraron sesiones",
  ),
  "emptyState.noSessionsTitle": dict(
    "No Claude sessions found",
    "Nenhuma sessão do Claude encontrada",
    "No se encontraron sesiones de Claude",
  ),
  "emptyState.noResultsMessage": dict(
    "Try adjusting your search terms.",
    "Tente ajustar os termos da sua busca.",
    "Intenta ajustar los términos de tu búsqueda.",
  ),
  "emptyState.noSessionsMessage": dict(
    "No sessions recorded yet in ~/.claude/projects.",
    "Ainda não há sessões registradas em ~/.claude/projects.",
    "Todavía no hay sesiones registradas en ~/.claude/projects.",
  ),

  "errorState.title": dict(
    "Error loading sessions",
    "Erro ao carregar sessões",
    "Error al cargar las sesiones",
  ),
  "errorState.retry": dict("Try again", "Tentar novamente", "Intentar de nuevo"),

  "loadingState.message": dict(
    "Loading sessions...",
    "Carregando sessões...",
    "Cargando sesiones...",
  ),

  "sessionSizeMeter.tooltip": dict(
    "{size} session — {message}",
    "Sessão de {size} — {message}",
    "Sesión de {size} — {message}",
  ),
  "sessionSizeMeter.label": dict(
    "Session size: {size}",
    "Tamanho da sessão: {size}",
    "Tamaño de la sesión: {size}",
  ),

  "sessionsPage.showingRange": dict(
    "Showing {start}–{end} of {total}",
    "Mostrando {start}–{end} de {total}",
    "Mostrando {start}–{end} de {total}",
  ),
  "sessionsPage.selectAllOnPage": dict(
    "Select all on this page",
    "Selecionar todas nesta página",
    "Seleccionar todas en esta página",
  ),
  "sessionsPage.selectedCount": dict(
    "{count} selected",
    "{count} selecionada(s)",
    "{count} seleccionada(s)",
  ),
  "sessionsPage.clearSelection": dict("Clear", "Limpar", "Limpiar"),
  "sessionsPage.deleteSelected": dict(
    "Delete selected",
    "Excluir selecionadas",
    "Eliminar seleccionadas",
  ),
  "sessionsPage.refresh": dict("Refresh sessions", "Atualizar sessões", "Actualizar sesiones"),
  "sessionsPage.delete": dict("Delete", "Excluir", "Eliminar"),
  "sessionsPage.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "sessionsPage.deleteConfirm.title": dict("Delete session", "Excluir sessão", "Eliminar sesión"),
  "sessionsPage.deleteConfirm.message": dict(
    "Are you sure you want to delete this session?",
    "Tem certeza de que deseja excluir esta sessão?",
    "¿Seguro que quieres eliminar esta sesión?",
  ),
  "sessionsPage.deleteConfirm.cleanupWorktree": dict(
    "Also clean up the worktree — removes its folder and the branch git created for it.",
    "Também limpar o worktree — remove sua pasta e a branch que o git criou para ele.",
    "También limpiar el worktree — elimina su carpeta y la rama que git creó para él.",
  ),
  "sessionsPage.deleteConfirm.cleanupBranch": dict(
    'Also delete the local branch "{branch}".',
    'Também excluir a branch local "{branch}".',
    'También eliminar la rama local "{branch}".',
  ),
  "sessionsPage.bulkDeleteConfirm.title": dict(
    "Delete selected sessions",
    "Excluir sessões selecionadas",
    "Eliminar sesiones seleccionadas",
  ),
  "sessionsPage.bulkDeleteConfirm.message.one": dict(
    "Are you sure you want to delete {count} session? This cannot be undone.",
    "Tem certeza de que deseja excluir {count} sessão? Isso não pode ser desfeito.",
    "¿Seguro que quieres eliminar {count} sesión? Esto no se puede deshacer.",
  ),
  "sessionsPage.bulkDeleteConfirm.message.many": dict(
    "Are you sure you want to delete {count} sessions? This cannot be undone.",
    "Tem certeza de que deseja excluir {count} sessões? Isso não pode ser desfeito.",
    "¿Seguro que quieres eliminar {count} sesiones? Esto no se puede deshacer.",
  ),

  "sessionCard.copyCommand.success": dict(
    "Command copied to clipboard.",
    "Comando copiado para a área de transferência.",
    "Comando copiado al portapapeles.",
  ),
  "sessionCard.copyCommand.error": dict(
    "Could not copy the command.",
    "Não foi possível copiar o comando.",
    "No se pudo copiar el comando.",
  ),
  "sessionCard.nickname.edit": dict(
    "Edit local nickname",
    "Editar apelido local",
    "Editar apodo local",
  ),
  "sessionCard.nickname.add": dict(
    "Add local nickname",
    "Adicionar apelido local",
    "Agregar apodo local",
  ),
  "sessionCard.nickname.localOnly": dict(
    "Local nickname — only shown in this app",
    "Apelido local — exibido apenas neste app",
    "Apodo local — solo se muestra en esta app",
  ),
  "sessionCard.nickname.disabledTooltip": dict(
    "Close this session in its terminal before changing its nickname.",
    "Encerre esta sessão no terminal antes de alterar o apelido.",
    "Cierra esta sesión en su terminal antes de cambiar el apodo.",
  ),
  "sessionCard.continueDisabled.directoryMissing": dict(
    "Recreate the original folder (or a symlink to it) before resuming — the Claude CLI resolves sessions by working directory.",
    "Recrie a pasta original (ou um link simbólico pra ela) antes de retomar — o Claude CLI resolve sessões pela pasta de trabalho.",
    "Recrea la carpeta original (o un enlace simbólico a ella) antes de reanudar — el Claude CLI resuelve las sesiones por carpeta de trabajo.",
  ),
  "sessionCard.resumeButton": dict(
    "Resume (terminal)",
    "Retomar (terminal)",
    "Reanudar (terminal)",
  ),
  "sessionCard.deleteButton": dict("Delete", "Excluir", "Eliminar"),
  "sessionCard.cancelButton": dict("Cancel", "Cancelar", "Cancelar"),
  "sessionCard.checkbox.select": dict("Select session", "Selecionar sessão", "Seleccionar sesión"),
  "sessionCard.checkbox.deselect": dict(
    "Deselect session",
    "Desmarcar sessão",
    "Deseleccionar sesión",
  ),
  "sessionCard.status.activeTooltip": dict(
    "Active — a terminal currently has this session resumed",
    "Ativa — um terminal está com esta sessão retomada agora",
    "Activa — una terminal tiene esta sesión reanudada ahora",
  ),
  "sessionCard.status.inactiveTooltip": dict(
    "Inactive — no terminal currently has this session resumed",
    "Inativa — nenhum terminal está com esta sessão retomada agora",
    "Inactiva — ninguna terminal tiene esta sesión reanudada ahora",
  ),
  "sessionCard.status.activeLabel": dict("Active session", "Sessão ativa", "Sesión activa"),
  "sessionCard.status.inactiveLabel": dict("Inactive session", "Sessão inativa", "Sesión inactiva"),
  "sessionCard.directoryMissing.title": dict(
    "Original folder missing",
    "Pasta original ausente",
    "Falta la carpeta original",
  ),
  "sessionCard.directoryMissing.tooltipWithPath": dict(
    "Original directory no longer exists: {path}",
    "O diretório original não existe mais: {path}",
    "El directorio original ya no existe: {path}",
  ),
  "sessionCard.directoryMissing.tooltipNoPath": dict(
    "This session's original directory no longer exists",
    "O diretório original desta sessão não existe mais",
    "El directorio original de esta sesión ya no existe",
  ),
  "sessionCard.directoryMissing.removedWorktree": dict(
    "This looks like a removed worktree — the project's root folder is still here:",
    "Isso parece um worktree removido — a pasta raiz do projeto ainda está aqui:",
    "Esto parece un worktree eliminado — la carpeta raíz del proyecto todavía está aquí:",
  ),
  "sessionCard.directoryMissing.openRootAriaLabel": dict(
    "Open the project root in VS Code",
    "Abrir a raiz do projeto no VS Code",
    "Abrir la raíz del proyecto en VS Code",
  ),
  "sessionCard.codeButton": dict("code .", "code .", "code ."),
  "sessionCard.directoryMissing.newSessionTooltip": dict(
    "The old transcript can't be resumed from a different folder — this starts a brand-new " +
      "conversation right here at the root, seeded with a recap of what the old session did.",
    "A transcrição antiga não pode ser retomada de uma pasta diferente — isso inicia uma " +
      "conversa totalmente nova aqui na raiz, alimentada com um resumo do que a sessão antiga " +
      "fez.",
    "La transcripción antigua no se puede reanudar desde una carpeta diferente — esto inicia " +
      "una conversación completamente nueva aquí en la raíz, alimentada con un resumen de lo " +
      "que hizo la sesión antigua.",
  ),
  "sessionCard.newSessionAtRootButton": dict(
    "New session in this folder",
    "Nova sessão nesta pasta",
    "Nueva sesión en esta carpeta",
  ),
  "sessionCard.worktreeTooltip": dict(
    "Git worktree — {path}",
    "Worktree do git — {path}",
    "Worktree de git — {path}",
  ),
  "sessionCard.worktreeNameLabel": dict(
    "Worktree name: {name}",
    "Nome do worktree: {name}",
    "Nombre del worktree: {name}",
  ),
  "sessionCard.openInVSCodeTooltip": dict(
    "Open this folder in VS Code",
    "Abrir esta pasta no VS Code",
    "Abrir esta carpeta en VS Code",
  ),
  "sessionCard.openInVSCodeAriaLabel": dict(
    "Open in VS Code",
    "Abrir no VS Code",
    "Abrir en VS Code",
  ),
  "sessionCard.worktreeToRoot.ariaLabel": dict(
    "Sync worktree into the root folder",
    "Sincronizar worktree com a pasta raiz",
    "Sincronizar worktree con la carpeta raíz",
  ),
  "sessionCard.worktreeToRootButton": dict("worktree → root", "worktree → raiz", "worktree → raíz"),
  "sessionCard.worktreeToRoot.tooltip": dict(
    "Sync this worktree's code into the project's root folder — copy files only, or remove the worktree and check out its branch there instead.",
    "Sincroniza o código deste worktree com a pasta raiz do projeto — copie só os arquivos, ou remova o worktree e faça checkout da branch dele ali.",
    "Sincroniza el código de este worktree con la carpeta raíz del proyecto — copia solo los archivos, o elimina el worktree y haz checkout de su rama ahí.",
  ),
  "sessionCard.subagents.tooltip": dict(
    "View what each subagent did — their token usage is included in the cost above",
    "Veja o que cada subagente fez — o uso de tokens deles está incluído no custo acima",
    "Mira lo que hizo cada subagente — su uso de tokens está incluido en el costo de arriba",
  ),
  "sessionCard.subagentCount.one": dict(
    "{count} subagent",
    "{count} subagente",
    "{count} subagente",
  ),
  "sessionCard.subagentCount.many": dict(
    "{count} subagents",
    "{count} subagentes",
    "{count} subagentes",
  ),
  "sessionCard.subagentCount.none": dict("No subagents", "Nenhum subagente", "Sin subagentes"),
  "sessionCard.updatedPrefix": dict("Updated", "Atualizada", "Actualizada"),
  "sessionCard.activeTimeTooltip": dict(
    "Actual time Claude spent processing this session, summed across turns",
    "Tempo real que o Claude gastou processando esta sessão, somado entre os turnos",
    "Tiempo real que Claude dedicó a procesar esta sesión, sumado entre los turnos",
  ),
  "sessionCard.activeSuffix": dict("active", "ativa", "activa"),
  "sessionCard.insightsTooltip": dict(
    "Insights — tips to spend fewer tokens",
    "Insights — dicas pra gastar menos tokens",
    "Insights — consejos para gastar menos tokens",
  ),
  "sessionCard.insightsAriaLabel": dict("View insights", "Ver insights", "Ver insights"),
  "sessionCard.usageTooltip": dict(
    "View token usage and estimated cost",
    "Ver uso de tokens e custo estimado",
    "Ver uso de tokens y costo estimado",
  ),
  "sessionCard.usageAriaLabel": dict("View usage and cost", "Ver uso e custo", "Ver uso y costo"),
  "sessionCard.previewTooltip": dict(
    "Preview prompts sent in this session",
    "Veja os prompts enviados nesta sessão",
    "Vista previa de los prompts enviados en esta sesión",
  ),
  "sessionCard.previewAriaLabel": dict("Preview prompts", "Ver prompts", "Vista previa de prompts"),
  "sessionCard.resetRootTooltip": dict(
    "Reset root — stashes (recoverable) then discards any uncommitted changes in the project's root folder, without touching this worktree. For the copy → test → reset → repeat loop, without opening the full worktree → root wizard each time.",
    "Reset root — guarda no stash (recuperável) e depois descarta as alterações não commitadas na pasta raiz do projeto, sem tocar neste worktree. Serve pro ciclo copiar → testar → resetar → repetir, sem abrir o assistente completo de worktree → root toda vez.",
    "Reset root — guarda en el stash (recuperable) y luego descarta los cambios sin commit en la carpeta raíz del proyecto, sin tocar este worktree. Sirve para el ciclo copiar → probar → resetear → repetir, sin abrir el asistente completo de worktree → root cada vez.",
  ),
  "sessionCard.resetRootAriaLabel": dict(
    "Reset root folder",
    "Resetar pasta raiz",
    "Restablecer carpeta raíz",
  ),
  "sessionCard.cleanupWorktree.disabledTooltip": dict(
    "Close this session in its terminal before cleaning up the worktree.",
    "Encerre esta sessão no terminal antes de limpar o worktree.",
    "Cierra esta sesión en su terminal antes de limpiar el worktree.",
  ),
  "sessionCard.cleanupWorktree.tooltip": dict(
    "Clean up this worktree — removes its folder and the branch git created for it. Doesn't touch the session transcript.",
    "Limpa este worktree — remove a pasta e a branch que o git criou pra ele. Não afeta a transcrição da sessão.",
    "Limpia este worktree — elimina su carpeta y la rama que git creó para él. No afecta la transcripción de la sesión.",
  ),
  "sessionCard.cleanupWorktreeAriaLabel": dict(
    "Clean up worktree",
    "Limpar worktree",
    "Limpiar worktree",
  ),
  "sessionCard.resumeCommandTitle": dict(
    "Resume command",
    "Comando de retomada",
    "Comando de reanudación",
  ),
  "sessionCard.copyCommandTooltip.copied": dict(
    "Resume command copied!",
    "Comando de retomada copiado!",
    "¡Comando de reanudación copiado!",
  ),
  "sessionCard.copyCommandTooltip.default": dict(
    "Copy resume command",
    "Copiar comando de retomada",
    "Copiar comando de reanudación",
  ),
  "sessionCard.copyCommandAriaLabel": dict(
    "Copy resume command",
    "Copiar comando de retomada",
    "Copiar comando de reanudación",
  ),
  "sessionCard.deleteDisabledTooltip": dict(
    "Close this session in its terminal before deleting.",
    "Encerre esta sessão no terminal antes de excluir.",
    "Cierra esta sesión en su terminal antes de eliminar.",
  ),
  "sessionCard.deleteWorktreeConfirm.title": dict(
    "Clean up worktree",
    "Limpar worktree",
    "Limpiar worktree",
  ),
  "sessionCard.deleteWorktreeConfirm.message": dict(
    "This removes the worktree's folder and the worktree-<name> branch git created for it, freeing the disk space it used. Uncommitted changes there will block the deletion — commit or stash them first if you need to keep them. The session transcript itself isn't affected.",
    "Isso remove a pasta do worktree e a branch worktree-<name> que o git criou pra ele, liberando o espaço em disco usado. Alterações não commitadas ali vão bloquear a exclusão — faça commit ou stash delas antes se precisar mantê-las. A transcrição da sessão em si não é afetada.",
    "Esto elimina la carpeta del worktree y la rama worktree-<name> que git creó para él, liberando el espacio en disco que usaba. Los cambios sin commit ahí bloquearán la eliminación — haz commit o stash de ellos antes si necesitas conservarlos. La transcripción de la sesión en sí no se ve afectada.",
  ),

  "cleanupModal.title": dict("Cleanup", "Limpeza", "Limpieza"),
  "cleanupModal.close": dict("Close", "Fechar", "Cerrar"),
  "cleanupModal.howItWorks.label": dict("How it works:", "Como funciona:", "Cómo funciona:"),
  "cleanupModal.howItWorks.body": dict(
    "locally checks the worktrees of every project known to the app for these situations:",
    "verifica localmente os worktrees de todos os projetos conhecidos pelo app para estas situações:",
    "revisa localmente los worktrees de todos los proyectos que la app conoce para estas situaciones:",
  ),
  "cleanupModal.finding.manualDelete.label": dict(
    "Worktree deleted manually",
    "Worktree excluído manualmente",
    "Worktree eliminado manualmente",
  ),
  "cleanupModal.finding.manualDelete.body": dict(
    "(folder removed directly on disk, outside the app) — git still keeps its record of it; the fix only cleans up that record, without deleting anything.",
    "(pasta removida direto no disco, fora do app) — o git ainda mantém o registro dele; a correção só limpa esse registro, sem deletar nada.",
    "(carpeta eliminada directamente en el disco, fuera de la app) — git todavía guarda su registro; la corrección solo limpia ese registro, sin eliminar nada.",
  ),
  "cleanupModal.finding.mergedBranch.label": dict(
    "Worktree with an already-merged branch",
    "Worktree com uma branch já mergeada",
    "Worktree con una rama ya fusionada",
  ),
  "cleanupModal.finding.mergedBranch.body": dict(
    "into the repository's default branch, with no active session or pending changes — can be safely removed (worktree and local branch together).",
    "na branch padrão do repositório, sem sessão ativa ou mudanças pendentes — pode ser removido com segurança (worktree e branch local juntos).",
    "en la rama predeterminada del repositorio, sin sesión activa ni cambios pendientes — se puede eliminar de forma segura (worktree y rama local juntos).",
  ),
  "cleanupModal.finding.prune.title": dict(
    'Worktrees deleted manually in "{project}"',
    'Worktrees excluídos manualmente em "{project}"',
    'Worktrees eliminados manualmente en "{project}"',
  ),
  "cleanupModal.finding.prune.description": dict(
    "{count} worktree(s) ({branches}) were deleted directly on disk, outside the app — git still keeps their record. This only cleans up that internal record, without deleting anything.",
    "{count} worktree(s) ({branches}) foram excluídos direto no disco, fora do app — o git ainda mantém o registro deles. Isso só limpa esse registro interno, sem deletar nada.",
    "{count} worktree(s) ({branches}) se eliminaron directamente en el disco, fuera de la app — git todavía guarda su registro. Esto solo limpia ese registro interno, sin eliminar nada.",
  ),
  "cleanupModal.finding.merged.title": dict(
    'Worktree "{branch}" already merged',
    'Worktree "{branch}" já mergeada',
    'Worktree "{branch}" ya fusionada',
  ),
  "cleanupModal.finding.merged.description": dict(
    'Branch "{branch}" is already merged into "{defaultBranch}" and the worktree has no active session or pending changes. The worktree and local branch can be safely removed.',
    'A branch "{branch}" já está mergeada em "{defaultBranch}" e o worktree não tem sessão ativa nem alterações pendentes. O worktree e a branch local podem ser removidos com segurança.',
    'La rama "{branch}" ya está fusionada en "{defaultBranch}" y el worktree no tiene sesión activa ni cambios pendientes. El worktree y la rama local se pueden eliminar de forma segura.',
  ),
  "cleanupModal.loading": dict("Loading...", "Carregando...", "Cargando..."),
  "cleanupModal.loadError": dict(
    "Could not fetch cleanup items.",
    "Não foi possível buscar os itens de limpeza.",
    "No se pudieron obtener los elementos de limpieza.",
  ),
  "cleanupModal.empty": dict(
    "Nothing found to clean up.",
    "Nada encontrado para limpar.",
    "No se encontró nada para limpiar.",
  ),
  "cleanupModal.run": dict("Run", "Executar", "Ejecutar"),
  "cleanupModal.resolved": dict(
    "Item resolved successfully.",
    "Item resolvido com sucesso.",
    "Elemento resuelto correctamente.",
  ),
  "cleanupModal.runError": dict(
    "Could not run this cleanup.",
    "Não foi possível executar essa limpeza.",
    "No se pudo ejecutar esta limpieza.",
  ),
  "newTaskModal.title": dict("New task", "Nova tarefa", "Nueva tarea"),
  "newTaskModal.confirm": dict(
    "Create and open terminal",
    "Criar e abrir terminal",
    "Crear y abrir terminal",
  ),
  "newTaskModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "newTaskModal.clear": dict("Clear", "Limpar", "Limpiar"),
  "newTaskModal.step.repo": dict(
    "Confirm the folder is a git repository",
    "Confirmar que a pasta é um repositório git",
    "Confirmar que la carpeta es un repositorio git",
  ),
  "newTaskModal.step.base": dict(
    "Fetch the latest version of the base branch",
    "Buscar a versão mais recente da branch base",
    "Obtener la última versión de la rama base",
  ),
  "newTaskModal.step.worktree": dict(
    "Create the branch and isolated worktree",
    "Criar a branch e o worktree isolado",
    "Crear la rama y el worktree aislado",
  ),
  "newTaskModal.step.worktreeNoWorktree": dict(
    "Create the branch directly in the project folder (no worktree)",
    "Criar a branch diretamente na pasta do projeto (sem worktree)",
    "Crear la rama directamente en la carpeta del proyecto (sin worktree)",
  ),
  "newTaskModal.step.launch": dict(
    "Open terminal and start Claude",
    "Abrir terminal e iniciar o Claude",
    "Abrir terminal e iniciar Claude",
  ),
  "newTaskModal.jiraLinkLabel": dict(
    "Task link (Jira)",
    "Link da tarefa (Jira)",
    "Enlace de la tarea (Jira)",
  ),
  "newTaskModal.pasteLinkHint": dict(
    "Paste the task link to continue filling in the rest of the setup.",
    "Cole o link da tarefa para continuar preenchendo o restante da configuração.",
    "Pega el enlace de la tarea para continuar completando el resto de la configuración.",
  ),
  "newTaskModal.projectLabel": dict("Project (folder)", "Projeto (pasta)", "Proyecto (carpeta)"),
  "newTaskModal.loadingProjects": dict(
    "Loading projects…",
    "Carregando projetos…",
    "Cargando proyectos…",
  ),
  "newTaskModal.selectProject": dict(
    "Select a project",
    "Selecione um projeto",
    "Selecciona un proyecto",
  ),
  "newTaskModal.otherFolder": dict(
    "Other (paste folder path)",
    "Outro (cole o caminho da pasta)",
    "Otro (pega la ruta de la carpeta)",
  ),
  "newTaskModal.readingRepoInfo": dict(
    "Reading repository information…",
    "Lendo as informações do repositório…",
    "Leyendo la información del repositorio…",
  ),
  "newTaskModal.repoInfoError": dict(
    "Could not read this repository's information.",
    "Não foi possível ler as informações deste repositório.",
    "No se pudo leer la información de este repositorio.",
  ),
  "newTaskModal.promptLabel": dict("Prompt", "Prompt", "Prompt"),
  "newTaskModal.saving": dict("Saving…", "Salvando…", "Guardando…"),
  "newTaskModal.saveAsDefault": dict(
    "Save as default",
    "Salvar como padrão",
    "Guardar como predeterminado",
  ),
  "newTaskModal.promptSaved": dict(
    "Default prompt saved.",
    "Prompt padrão salvo.",
    "Prompt predeterminado guardado.",
  ),
  "newTaskModal.promptSaveError": dict(
    "Could not save the default prompt.",
    "Não foi possível salvar o prompt padrão.",
    "No se pudo guardar el prompt predeterminado.",
  ),
  "newTaskModal.loadingDefaultPrompt": dict(
    "Loading default prompt…",
    "Carregando o prompt padrão…",
    "Cargando el prompt predeterminado…",
  ),
  "newTaskModal.promptPlaceholder": dict(
    "Instructions for Claude…",
    "Instruções para o Claude…",
    "Instrucciones para Claude…",
  ),
  "newTaskModal.finalPromptLabel": dict("Final prompt:", "Prompt final:", "Prompt final:"),
  "newTaskModal.baseBranchLabel": dict("Base branch", "Branch base", "Rama base"),
  "newTaskModal.branchTypeLabel": dict("Branch type", "Tipo de branch", "Tipo de rama"),
  "newTaskModal.otherBranchType": dict("Other", "Outro", "Otro"),
  "newTaskModal.customPrefixPlaceholder": dict(
    "custom prefix",
    "prefixo personalizado",
    "prefijo personalizado",
  ),
  "newTaskModal.branchNameLabel": dict("Branch name", "Nome da branch", "Nombre de la rama"),
  "newTaskModal.branchPreview": dict("Preview:", "Pré-visualização:", "Vista previa:"),
  "newTaskModal.skipWorktreeLabel": dict(
    "Don't use a worktree — switch the branch directly in the project folder.",
    "Não usar um worktree — trocar a branch diretamente na pasta do projeto.",
    "No usar un worktree — cambiar la rama directamente en la carpeta del proyecto.",
  ),
  "newTaskModal.useAsDefault": dict(
    "Use as default",
    "Usar como padrão",
    "Usar como predeterminado",
  ),
  "newTaskModal.worktreePrefSaved": dict(
    "Worktree preference saved.",
    "Preferência de worktree salva.",
    "Preferencia de worktree guardada.",
  ),
  "newTaskModal.worktreePrefSaveError": dict(
    "Could not save this preference.",
    "Não foi possível salvar essa preferência.",
    "No se pudo guardar esta preferencia.",
  ),
  "newTaskModal.skipWorktreeWarning": dict(
    "Without a worktree, the new branch is switched directly in the project's main folder — this can cause conflicts if another terminal or session is already active there.",
    "Sem um worktree, a nova branch é trocada diretamente na pasta principal do projeto — isso pode causar conflitos se outro terminal ou sessão já estiver ativo ali.",
    "Sin un worktree, la nueva rama se cambia directamente en la carpeta principal del proyecto — esto puede causar conflictos si otra terminal o sesión ya está activa ahí.",
  ),
  "newTaskModal.permissionModeAutoLabel": dict(
    "Skip permission prompts (--permission-mode auto)",
    "Pular confirmações de permissão (--permission-mode auto)",
    "Omitir confirmaciones de permiso (--permission-mode auto)",
  ),
  "newTaskModal.permissionModeAutoExplanation": dict(
    "Starts the session with Claude Code's own \"auto\" permission mode, so it stops asking for approval before most actions. Useful here specifically because a background terminal window can't be brought to front on some setups (see the app's own notes on this) — if it's sitting at an unanswered prompt you never saw, this avoids that entirely. Remembered as whatever you last left it at.",
    "Inicia a sessão no modo de permissão \"auto\" do próprio Claude Code, então ele para de pedir aprovação antes da maioria das ações. Útil aqui especificamente porque a janela do terminal em segundo plano não pode ser trazida para frente em algumas configurações — se ela estiver parada num prompt que você nunca viu, isso evita esse problema por completo. Fica lembrado como você deixou da última vez.",
    "Inicia la sesión en el modo de permiso \"auto\" propio de Claude Code, así deja de pedir aprobación antes de la mayoría de las acciones. Útil aquí específicamente porque la ventana de terminal en segundo plano no se puede traer al frente en algunas configuraciones — si está esperando en un aviso que nunca viste, esto evita ese problema por completo. Se recuerda como lo dejaste la última vez.",
  ),
  "newTaskModal.progressLabel": dict("Progress:", "Progresso:", "Progreso:"),
  "newTaskModal.whatWillHappen": dict(
    'What will happen when you click "Create and open terminal":',
    'O que vai acontecer quando você clicar em "Criar e abrir terminal":',
    'Qué sucederá cuando hagas clic en "Crear y abrir terminal":',
  ),
  "newTaskModal.explain.repo.pre": dict("Confirms that", "Confirma que", "Confirma que"),
  "newTaskModal.explain.folderPlaceholder": dict(
    "(chosen folder)",
    "(pasta escolhida)",
    "(carpeta elegida)",
  ),
  "newTaskModal.explain.repo.post": dict(
    "is a git repository.",
    "é um repositório git.",
    "es un repositorio git.",
  ),
  "newTaskModal.explain.base.pre": dict(
    "Fetches the latest version of the base branch",
    "Busca a versão mais recente da branch base",
    "Obtiene la última versión de la rama base",
  ),
  "newTaskModal.explain.basePlaceholder": dict("(base branch)", "(branch base)", "(rama base)"),
  "newTaskModal.explain.base.post": dict(
    "directly from the remote — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "diretamente do remoto — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
    "directamente desde el remoto — sin hacer checkout ni tocar la carpeta principal del proyecto (no afecta ninguna sesión ya activa ahí).",
  ),
  "newTaskModal.explain.branch.pre": dict(
    "Creates the new branch",
    "Cria a nova branch",
    "Crea la nueva rama",
  ),
  "newTaskModal.explain.branchPlaceholder": dict(
    "(branch name)",
    "(nome da branch)",
    "(nombre de la rama)",
  ),
  "newTaskModal.explain.branch.post": dict(
    "from that updated version.",
    "a partir dessa versão atualizada.",
    "a partir de esa versión actualizada.",
  ),
  "newTaskModal.explain.worktree.skip": dict(
    "Switches to that branch directly in the project's main folder — without a worktree, this can conflict with another terminal already open there.",
    "Troca para essa branch diretamente na pasta principal do projeto — sem um worktree, isso pode conflitar com outro terminal já aberto ali.",
    "Cambia a esa rama directamente en la carpeta principal del proyecto — sin un worktree, esto puede generar conflictos con otra terminal ya abierta ahí.",
  ),
  "newTaskModal.explain.worktree.create": dict(
    "Creates an isolated worktree (its own folder, separate from the main one) already on that branch — this is what lets you work on this task without interfering with another terminal open on the same project.",
    "Cria um worktree isolado (uma pasta própria, separada da principal) já naquela branch — é isso que permite trabalhar nessa tarefa sem interferir em outro terminal aberto no mesmo projeto.",
    "Crea un worktree aislado (su propia carpeta, separada de la principal) ya en esa rama — esto es lo que permite trabajar en esta tarea sin interferir con otra terminal abierta en el mismo proyecto.",
  ),
  "newTaskModal.explain.launch.pre": dict(
    "Opens a new terminal",
    "Abre um novo terminal",
    "Abre una nueva terminal",
  ),
  "newTaskModal.explain.launch.inProjectFolder": dict(
    "in the project folder",
    "na pasta do projeto",
    "en la carpeta del proyecto",
  ),
  "newTaskModal.explain.launch.insideWorktree": dict(
    "inside that worktree",
    "dentro daquele worktree",
    "dentro de ese worktree",
  ),
  "newTaskModal.explain.launch.and": dict("and starts", "e inicia o", "y ejecuta"),
  "newTaskModal.explain.launch.post": dict(
    "with the prompt above as the first message.",
    "com o prompt acima como primeira mensagem.",
    "con el prompt anterior como primer mensaje.",
  ),
  "newTaskModal.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Verifique a barra de tarefas se ele não veio para a frente.",
    "Terminal abierta. Revisa la barra de tareas si no pasó al frente.",
  ),
  "newTaskModal.unexpectedFailure": dict(
    "Unexpected failure.",
    "Falha inesperada.",
    "Fallo inesperado.",
  ),
  "newTaskModal.createFailed": dict(
    "Failed to create task: {message}",
    "Falha ao criar a tarefa: {message}",
    "No se pudo crear la tarea: {message}",
  ),

  "useSessions.loadError": dict(
    "Could not load sessions.",
    "Não foi possível carregar as sessões.",
    "No se pudieron cargar las sesiones.",
  ),
  "useSessions.worktreeDeleted": dict(
    "Worktree and its branch deleted.",
    "Worktree e sua branch excluídos.",
    "Se eliminaron el worktree y su rama.",
  ),
  "useSessions.cleanupWorktreeError": dict(
    "Could not clean up the worktree.",
    "Não foi possível limpar o worktree.",
    "No se pudo limpiar el worktree.",
  ),
  "useSessions.branchDeleted": dict(
    'Branch "{branch}" deleted.',
    'Branch "{branch}" excluída.',
    'Se eliminó la rama "{branch}".',
  ),
  "useSessions.deleteBranchError": dict(
    "Could not delete the branch.",
    "Não foi possível excluir a branch.",
    "No se pudo eliminar la rama.",
  ),
  "useSessions.sessionDeleted": dict(
    "Session deleted successfully.",
    "Sessão excluída com sucesso.",
    "La sesión se eliminó correctamente.",
  ),
  "useSessions.deleteSessionError": dict(
    "Could not delete the session.",
    "Não foi possível excluir a sessão.",
    "No se pudo eliminar la sesión.",
  ),
  "useSessions.deleted.one": dict(
    "Deleted 1 session.",
    "1 sessão excluída.",
    "Se eliminó 1 sesión.",
  ),
  "useSessions.deleted.many": dict(
    "Deleted {count} sessions.",
    "{count} sessões excluídas.",
    "Se eliminaron {count} sesiones.",
  ),
  "useSessions.deleteFailed.one": dict(
    "Could not delete 1 session.",
    "Não foi possível excluir 1 sessão.",
    "No se pudo eliminar 1 sesión.",
  ),
  "useSessions.deleteFailed.many": dict(
    "Could not delete {count} sessions.",
    "Não foi possível excluir {count} sessões.",
    "No se pudieron eliminar {count} sesiones.",
  ),
  "useSessions.deletedPartial.one": dict(
    "Deleted 1 session, {failedCount} failed.",
    "1 sessão excluída, {failedCount} falharam.",
    "Se eliminó 1 sesión, {failedCount} fallaron.",
  ),
  "useSessions.deletedPartial.many": dict(
    "Deleted {count} sessions, {failedCount} failed.",
    "{count} sessões excluídas, {failedCount} falharam.",
    "Se eliminaron {count} sesiones, {failedCount} fallaron.",
  ),
  "useSessions.nicknameSaved": dict("Nickname saved.", "Apelido salvo.", "Se guardó el apodo."),
  "useSessions.nicknameRemoved": dict(
    "Nickname removed.",
    "Apelido removido.",
    "Se quitó el apodo.",
  ),
  "useSessions.saveNicknameError": dict(
    "Could not save the nickname.",
    "Não foi possível salvar o apelido.",
    "No se pudo guardar el apodo.",
  ),
  "useSessions.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Confira a barra de tarefas se ele não veio para frente.",
    "Se abrió la terminal. Revisa la barra de tareas si no aparece al frente.",
  ),
  "useSessions.resumeError": dict(
    "Could not resume the session.",
    "Não foi possível retomar a sessão.",
    "No se pudo reanudar la sesión.",
  ),
  "useSessions.stoppedAndResumed": dict(
    "Stopped the other terminal, checked out the branch, and opened a terminal here.",
    "O outro terminal foi parado, foi feito checkout da branch e um terminal foi aberto aqui.",
    "Se detuvo la otra terminal, se cambió a la rama y se abrió una terminal aquí.",
  ),
  "useSessions.switchSessionsError": dict(
    "Could not switch sessions.",
    "Não foi possível alternar entre as sessões.",
    "No se pudo cambiar de sesión.",
  ),
  "useSessions.openingVSCode": dict(
    "Opening in VS Code…",
    "Abrindo no VS Code…",
    "Abriendo en VS Code…",
  ),
  "useSessions.openVSCodeError": dict(
    "Could not open VS Code.",
    "Não foi possível abrir o VS Code.",
    "No se pudo abrir VS Code.",
  ),
  "useSessions.openingRootVSCode": dict(
    "Opening the project root in VS Code…",
    "Abrindo a pasta raiz do projeto no VS Code…",
    "Abriendo la carpeta raíz del proyecto en VS Code…",
  ),
  "useSessions.newTerminalAtRoot": dict(
    "New terminal opened at the project root. Check your taskbar if it didn't come to the front.",
    "Novo terminal aberto na pasta raiz do projeto. Confira a barra de tarefas se ele não veio para frente.",
    "Se abrió una nueva terminal en la carpeta raíz del proyecto. Revisa la barra de tareas si no aparece al frente.",
  ),
  "useSessions.startSessionError": dict(
    "Could not start a session there.",
    "Não foi possível iniciar uma sessão ali.",
    "No se pudo iniciar una sesión ahí.",
  ),
  "useSessions.worktreeCreated": dict(
    "Worktree created. Terminal opened — check your taskbar if it didn't come to the front.",
    "Worktree criado. Terminal aberto — confira a barra de tarefas se ele não veio para frente.",
    "Se creó el worktree. Se abrió una terminal — revisa la barra de tareas si no aparece al frente.",
  ),
  "useSessions.createWorktreeError": dict(
    "Could not create the worktree.",
    "Não foi possível criar o worktree.",
    "No se pudo crear el worktree.",
  ),
  "useSessions.deleteWorktreeError": dict(
    "Could not delete the worktree.",
    "Não foi possível excluir o worktree.",
    "No se pudo eliminar el worktree.",
  ),
  "useUpdate.updateSuccess": dict(
    "Updated successfully. Restart the app to load the new version.",
    "Atualizado com sucesso. Reinicie o app para carregar a nova versão.",
    "Se actualizó correctamente. Reinicia la app para cargar la nueva versión.",
  ),
  "useUpdate.updateError": dict(
    "Could not update the application.",
    "Não foi possível atualizar o aplicativo.",
    "No se pudo actualizar la aplicación.",
  ),
  "useUsageLimits.fetchError": dict(
    "Could not fetch usage limits.",
    "Não foi possível buscar os limites de uso.",
    "No se pudieron obtener los límites de uso.",
  ),
  "updateButton.checking": dict(
    "Checking for updates…",
    "Verificando atualizações…",
    "Buscando actualizaciones…",
  ),
  "updateButton.updating": dict(
    "Updating — running git pull and npm install…",
    "Atualizando — executando git pull e npm install…",
    "Actualizando — ejecutando git pull y npm install…",
  ),
  "updateButton.checkError": dict(
    "Could not check for updates.",
    "Não foi possível verificar atualizações.",
    "No se pudieron buscar actualizaciones.",
  ),
  "updateButton.upToDate": dict("Up to date", "Atualizado", "Actualizado"),
  "updateButton.updateAvailable.one": dict(
    "1 new commit on {branch} — click to update",
    "1 novo commit em {branch} — clique para atualizar",
    "1 commit nuevo en {branch} — haz clic para actualizar",
  ),
  "updateButton.updateAvailable.many": dict(
    "{count} new commits on {branch} — click to update",
    "{count} novos commits em {branch} — clique para atualizar",
    "{count} commits nuevos en {branch} — haz clic para actualizar",
  ),
  "updateButton.label": dict("Update app", "Atualizar app", "Actualizar app"),
  "usageLimitsBadge.compact.session": dict("5h", "5h", "5h"),
  "usageLimitsBadge.compact.weeklyAll": dict("7d", "7d", "7d"),
  "usageLimitsBadge.full.session": dict("Session (5h)", "Sessão (5h)", "Sesión (5h)"),
  "usageLimitsBadge.full.weeklyAll": dict("Weekly", "Semanal", "Semanal"),
  "usageLimitsBadge.full.weeklyOpus": dict("Weekly (Opus)", "Semanal (Opus)", "Semanal (Opus)"),
  "usageLimitsBadge.full.weeklySonnet": dict(
    "Weekly (Sonnet)",
    "Semanal (Sonnet)",
    "Semanal (Sonnet)",
  ),
  "usageLimitsBadge.resetsSoon": dict(
    "resets soon ({absolute})",
    "reinicia em breve ({absolute})",
    "se reinicia pronto ({absolute})",
  ),
  "usageLimitsBadge.lessThanOneMin": dict("less than 1min", "menos de 1min", "menos de 1min"),
  "usageLimitsBadge.resetsIn": dict(
    "resets in {relative} ({absolute})",
    "reinicia em {relative} ({absolute})",
    "se reinicia en {relative} ({absolute})",
  ),
  "usageLimitsBadge.unavailable": dict(
    "Usage unavailable",
    "Uso indisponível",
    "Uso no disponible",
  ),
  "usageLimitsBadge.noData": dict("Usage —", "Uso —", "Uso —"),
  "usageLimitsBadge.title": dict(
    "Claude usage limits",
    "Limites de uso do Claude",
    "Límites de uso de Claude",
  ),
  "usageLimitsBadge.noLimits": dict(
    "No limits reported.",
    "Nenhum limite reportado.",
    "No se reportaron límites.",
  ),
  "usageLimitsBadge.extraUsage": dict(
    "Extra usage: {usedCredits} / {monthlyLimit} {currency}",
    "Uso extra: {usedCredits} / {monthlyLimit} {currency}",
    "Uso extra: {usedCredits} / {monthlyLimit} {currency}",
  ),
  "usageLimitsBadge.clickToRefresh": dict(
    "Click to refresh.",
    "Clique para atualizar.",
    "Haz clic para actualizar.",
  ),
  "themeToggle.switchToLight": dict(
    "Switch to light theme",
    "Mudar para o tema claro",
    "Cambiar al tema claro",
  ),
  "themeToggle.switchToDark": dict(
    "Switch to dark theme",
    "Mudar para o tema escuro",
    "Cambiar al tema oscuro",
  ),

  "worktreeToRootModal.title": dict("Worktree → root", "Worktree → raiz", "Worktree → raíz"),
  "worktreeToRootModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "worktreeToRootModal.back": dict("Back", "Voltar", "Atrás"),
  "worktreeToRootModal.keepCard": dict("Keep the card", "Manter o card", "Mantener la tarjeta"),
  "worktreeToRootModal.confirmContinue": dict("Continue", "Continuar", "Continuar"),
  "worktreeToRootModal.confirmYesDoIt": dict("Yes, do it", "Sim, pode fazer", "Sí, hazlo"),
  "worktreeToRootModal.confirmDeleteSession": dict(
    "Delete this session",
    "Excluir esta sessão",
    "Eliminar esta sesión",
  ),

  "worktreeToRootModal.steps.resetRoot": dict(
    "Discard uncommitted changes in the root folder",
    "Descartar alterações não commitadas na pasta raiz",
    "Descartar cambios sin commit en la carpeta raíz",
  ),
  "worktreeToRootModal.steps.copy": dict(
    "Copy the worktree's files into the root folder",
    "Copiar os arquivos do worktree para a pasta raiz",
    "Copiar los archivos del worktree a la carpeta raíz",
  ),
  "worktreeToRootModal.steps.removeAndCheckout": dict(
    "Remove the worktree and check out its branch in the root folder",
    "Remover o worktree e fazer checkout da branch dele na pasta raiz",
    "Eliminar el worktree y hacer checkout de su rama en la carpeta raíz",
  ),

  "worktreeToRootModal.fileListBox.none": dict("None", "Nenhum", "Ninguno"),

  "worktreeToRootModal.choice.intro": dict(
    "Both options start by discarding any uncommitted changes currently in the root folder — pick which one, then you'll see exactly what will happen before confirming anything.",
    "As duas opções começam descartando qualquer alteração não commitada que exista agora na pasta raiz — escolha uma, e você vai ver exatamente o que vai acontecer antes de confirmar qualquer coisa.",
    "Ambas opciones empiezan descartando cualquier cambio sin commit que haya ahora en la carpeta raíz — elige una, y verás exactamente qué va a pasar antes de confirmar nada.",
  ),
  "worktreeToRootModal.choice.copyTitle": dict(
    "Copy files only",
    "Copiar apenas os arquivos",
    "Copiar solo los archivos",
  ),
  "worktreeToRootModal.choice.copyBody": dict(
    "Copies the worktree's current files into the root folder. The worktree is left exactly as it is — nothing there is deleted or checked out. Root's branch doesn't change either; it just ends up with the worktree's files as uncommitted changes. No commits, no history — meant as a disposable preview you'll likely discard afterward.",
    "Copia os arquivos atuais do worktree para a pasta raiz. O worktree fica exatamente como está — nada nele é excluído ou passa por checkout. A branch da raiz também não muda; ela só acaba com os arquivos do worktree como alterações não commitadas. Sem commits, sem histórico — pensado como um preview descartável que você provavelmente vai jogar fora depois.",
    "Copia los archivos actuales del worktree a la carpeta raíz. El worktree queda exactamente como está — nada en él se elimina ni pasa por checkout. La rama de la raíz tampoco cambia; solo termina con los archivos del worktree como cambios sin commit. Sin commits, sin historial — pensado como una vista previa descartable que probablemente vas a descartar después.",
  ),
  "worktreeToRootModal.choice.checkoutTitle": dict(
    "Remove worktree & checkout branch",
    "Remover worktree e fazer checkout da branch",
    "Eliminar worktree y hacer checkout de la rama",
  ),
  "worktreeToRootModal.choice.checkoutBody": dict(
    "Deletes the worktree's folder and checks its branch out directly in the root folder instead — a real git checkout with full history preserved. The branch itself is never deleted. This session's transcript can no longer be resumed afterward, since it's tied to the worktree folder that just got removed.",
    "Exclui a pasta do worktree e faz checkout da branch dele direto na pasta raiz — um checkout de git real, com todo o histórico preservado. A branch em si nunca é excluída. A transcrição desta sessão não pode mais ser retomada depois, já que está vinculada à pasta do worktree que acabou de ser removida.",
    "Elimina la carpeta del worktree y hace checkout de su rama directamente en la carpeta raíz — un checkout de git real, con todo el historial preservado. La rama en sí nunca se elimina. La transcripción de esta sesión ya no se puede reanudar después, ya que está vinculada a la carpeta del worktree que acaba de eliminarse.",
  ),

  "worktreeToRootModal.preview.loading": dict(
    "Reading the worktree and root folder…",
    "Lendo o worktree e a pasta raiz…",
    "Leyendo el worktree y la carpeta raíz…",
  ),
  "worktreeToRootModal.preview.errorFallback": dict(
    "Could not read the worktree/root folders.",
    "Não foi possível ler as pastas do worktree/raiz.",
    "No se pudieron leer las carpetas del worktree/raíz.",
  ),
  "worktreeToRootModal.preview.rootFolderLabel": dict(
    "Root folder",
    "A pasta raiz",
    "La carpeta raíz",
  ),
  "worktreeToRootModal.preview.currentlyOnBranch": dict(
    "is currently on branch",
    "está atualmente na branch",
    "está actualmente en la rama",
  ),
  "worktreeToRootModal.preview.detachedHead": dict(
    "(detached HEAD)",
    "(HEAD destacado)",
    "(HEAD separado)",
  ),
  "worktreeToRootModal.preview.switchToPrefix": dict(
    "It will be switched to",
    "Ela vai ser trocada para",
    "Se cambiará a",
  ),
  "worktreeToRootModal.preview.switchToSuffix": dict(
    "— the worktree's own branch.",
    "— a própria branch do worktree.",
    "— la propia rama del worktree.",
  ),
  "worktreeToRootModal.preview.unknownBranch": dict("(unknown)", "(desconhecida)", "(desconocida)"),
  "worktreeToRootModal.preview.dirtyFilesNoneTitle": dict(
    "Uncommitted files in root (none — nothing will be lost there)",
    "Arquivos não commitados na raiz (nenhum — nada será perdido ali)",
    "Archivos sin commit en la raíz (ninguno — no se perderá nada ahí)",
  ),
  "worktreeToRootModal.preview.dirtyFilesTitle": dict(
    "Uncommitted files in root that will be discarded",
    "Arquivos não commitados na raiz que serão descartados",
    "Archivos sin commit en la raíz que se descartarán",
  ),
  "worktreeToRootModal.preview.openInVSCode": dict(
    "Open the root folder in VS Code",
    "Abrir a pasta raiz no VS Code",
    "Abrir la carpeta raíz en VS Code",
  ),
  "worktreeToRootModal.preview.addedTitle": dict(
    "Added to root",
    "Adicionados à raiz",
    "Agregados a la raíz",
  ),
  "worktreeToRootModal.preview.modifiedTitle": dict(
    "Modified in root",
    "Modificados na raiz",
    "Modificados en la raíz",
  ),
  "worktreeToRootModal.preview.removedTitle": dict(
    "Removed from root",
    "Removidos da raiz",
    "Eliminados de la raíz",
  ),
  "worktreeToRootModal.preview.checkoutWarning": dict(
    "The worktree's folder will be deleted (its branch and commits are kept). This session's transcript is tied to that exact folder, so it won't be resumable from this app afterward — the code itself isn't lost, it's just in the root folder now.",
    "A pasta do worktree será excluída (a branch e os commits dele são mantidos). A transcrição desta sessão está vinculada exatamente a essa pasta, então ela não poderá ser retomada a partir deste app depois — o código em si não é perdido, só que fica na pasta raiz agora.",
    "La carpeta del worktree se eliminará (su rama y sus commits se conservan). La transcripción de esta sesión está vinculada exactamente a esa carpeta, así que no podrá reanudarse desde esta app después — el código en sí no se pierde, solo que ahora está en la carpeta raíz.",
  ),
  "worktreeToRootModal.preview.rootActiveWarning": dict(
    "A session is currently active in the root folder — close its terminal before continuing.",
    "Uma sessão está ativa agora na pasta raiz — encerre o terminal dela antes de continuar.",
    "Una sesión está activa ahora en la carpeta raíz — cierra su terminal antes de continuar.",
  ),
  "worktreeToRootModal.preview.worktreeActiveWarning": dict(
    "A session is still active in this worktree — close its terminal before removing it.",
    "Uma sessão ainda está ativa neste worktree — encerre o terminal dela antes de removê-lo.",
    "Una sesión todavía está activa en este worktree — cierra su terminal antes de eliminarlo.",
  ),

  "worktreeToRootModal.confirm.stashIntro": dict(
    "Root's current uncommitted changes will be stashed first (recoverable afterward via",
    "As alterações não commitadas atuais da raiz serão colocadas no stash primeiro (recuperáveis depois via",
    "Los cambios sin commit actuales de la raíz se guardarán en el stash primero (recuperables después mediante",
  ),
  "worktreeToRootModal.confirm.stashIntroSuffix": dict(
    "), then cleared from the working tree.",
    "), e então removidas da working tree.",
    "), y luego se eliminarán del working tree.",
  ),
  "worktreeToRootModal.confirm.checkoutWarning": dict(
    "After that, the worktree's folder will be permanently deleted (its branch and commits are kept) and root will switch to that branch.",
    "Depois disso, a pasta do worktree será excluída permanentemente (a branch e os commits dele são mantidos) e a raiz vai mudar para essa branch.",
    "Después de eso, la carpeta del worktree se eliminará permanentemente (su rama y sus commits se conservan) y la raíz cambiará a esa rama.",
  ),
  "worktreeToRootModal.confirm.copyWarning": dict(
    "The worktree itself is never touched by any of this.",
    "O worktree em si nunca é afetado por nada disso.",
    "El worktree en sí nunca se ve afectado por nada de esto.",
  ),
  "worktreeToRootModal.confirm.doubleChecking": dict(
    "Double-checking the root folder hasn't changed since you opened this…",
    "Verificando de novo se a pasta raiz não mudou desde que você abriu isso…",
    "Verificando de nuevo que la carpeta raíz no haya cambiado desde que abriste esto…",
  ),
  "worktreeToRootModal.confirm.dirtyNoneTitle": dict(
    "Uncommitted files in root right now (none)",
    "Arquivos não commitados na raiz agora (nenhum)",
    "Archivos sin commit en la raíz ahora mismo (ninguno)",
  ),
  "worktreeToRootModal.confirm.dirtyTitle": dict(
    "Uncommitted files in root right now — about to be stashed",
    "Arquivos não commitados na raiz agora — serão colocados no stash",
    "Archivos sin commit en la raíz ahora mismo — se guardarán en el stash",
  ),

  "worktreeToRootModal.done.message": dict(
    "Done — the root folder is now on the worktree's branch, with full history preserved.",
    "Concluído — a pasta raiz agora está na branch do worktree, com todo o histórico preservado.",
    "Listo — la carpeta raíz ahora está en la rama del worktree, con todo el historial preservado.",
  ),
  "worktreeToRootModal.done.explanation": dict(
    "This session's transcript was tied to the worktree folder that just got removed, so it can't be resumed from this app anymore — the code itself is safe, it's just in the root folder now. Delete this now-dead card, or keep it around as a record.",
    "A transcrição desta sessão estava vinculada à pasta do worktree que acabou de ser removida, então ela não pode mais ser retomada a partir deste app — o código em si está seguro, só que agora está na pasta raiz. Exclua este card agora inativo, ou mantenha-o como registro.",
    "La transcripción de esta sesión estaba vinculada a la carpeta del worktree que acaba de eliminarse, así que ya no se puede reanudar desde esta app — el código en sí está seguro, solo que ahora está en la carpeta raíz. Elimina esta tarjeta ya inactiva, o conserva como registro.",
  ),

  "worktreeToRootModal.toast.openingVSCode": dict(
    "Opening the root folder in VS Code…",
    "Abrindo a pasta raiz no VS Code…",
    "Abriendo la carpeta raíz en VS Code…",
  ),
  "worktreeToRootModal.toast.openVSCodeError": dict(
    "Could not open VS Code.",
    "Não foi possível abrir o VS Code.",
    "No se pudo abrir VS Code.",
  ),
  "worktreeToRootModal.toast.stashNote": dict(
    'Root\'s previous state is saved — recover it with "git stash apply {stashRef}".',
    'O estado anterior da raiz foi salvo — recupere com "git stash apply {stashRef}".',
    'El estado anterior de la raíz se guardó — recupéralo con "git stash apply {stashRef}".',
  ),
  "worktreeToRootModal.toast.copySuccess": dict(
    "Copied the worktree's files into the root folder.",
    "Arquivos do worktree copiados para a pasta raiz.",
    "Archivos del worktree copiados a la carpeta raíz.",
  ),
  "worktreeToRootModal.toast.checkoutSuccessWithPrevious": dict(
    'Worktree removed — root switched from "{previousBranch}" to "{newBranch}".',
    'Worktree removido — a raiz mudou de "{previousBranch}" para "{newBranch}".',
    'Worktree eliminado — la raíz cambió de "{previousBranch}" a "{newBranch}".',
  ),
  "worktreeToRootModal.toast.checkoutSuccessNoPrevious": dict(
    'Worktree removed — root switched to "{newBranch}".',
    'Worktree removido — a raiz mudou para "{newBranch}".',
    'Worktree eliminado — la raíz cambió a "{newBranch}".',
  ),
  "worktreeToRootModal.toast.unexpectedFailure": dict(
    "Unexpected failure.",
    "Falha inesperada.",
    "Fallo inesperado.",
  ),
  "worktreeToRootModal.toast.failedPrefix": dict(
    "Failed: {message}",
    "Falhou: {message}",
    "Falló: {message}",
  ),
  "worktreeToRootModal.stashList.title": dict(
    "Previous resets, still recoverable:",
    "Resets anteriores, ainda recuperáveis:",
    "Restablecimientos anteriores, aún recuperables:",
  ),
  "worktreeToRootModal.stashList.copyTooltip": dict(
    "Copy \"git stash apply\" for this one",
    "Copiar \"git stash apply\" para este",
    "Copiar \"git stash apply\" para este",
  ),
  "worktreeToRootModal.stashList.copiedTooltip": dict("Copied!", "Copiado!", "¡Copiado!"),
  "worktreeToRootModal.stashList.copyError": dict(
    "Could not copy to clipboard.",
    "Não foi possível copiar.",
    "No se pudo copiar.",
  ),

  "resetRootConfirmModal.title": dict("Reset root", "Resetar raiz", "Restablecer raíz"),
  "resetRootConfirmModal.confirmLabel": dict("Reset root", "Resetar raiz", "Restablecer raíz"),
  "resetRootConfirmModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "resetRootConfirmModal.warningIntro": dict(
    "Stashes (recoverable via",
    "Coloca no stash (recuperável via",
    "Guarda en el stash (recuperable mediante",
  ),
  "resetRootConfirmModal.warningMiddle": dict(
    ") then clears every uncommitted change in the root folder. The branch it's on doesn't change, and nothing gitignored (like",
    ") e então limpa todas as alterações não commitadas na pasta raiz. A branch em que ela está não muda, e nada ignorado pelo git (como",
    ") y luego elimina todos los cambios sin commit en la carpeta raíz. La rama en la que está no cambia, y nada ignorado por git (como",
  ),
  "resetRootConfirmModal.warningEnd": dict(") is touched.", ") é tocado.", ") se toca."),
  "resetRootConfirmModal.loading": dict(
    "Reading the root folder…",
    "Lendo a pasta raiz…",
    "Leyendo la carpeta raíz…",
  ),
  "resetRootConfirmModal.statusErrorFallback": dict(
    "Could not read the root folder's status.",
    "Não foi possível ler o status da pasta raiz.",
    "No se pudo leer el estado de la carpeta raíz.",
  ),
  "resetRootConfirmModal.branchPrefix": dict(
    "Root folder is on branch",
    "A pasta raiz está na branch",
    "La carpeta raíz está en la rama",
  ),
  "resetRootConfirmModal.detachedHead": dict(
    "(detached HEAD)",
    "(HEAD destacado)",
    "(HEAD separado)",
  ),
  "resetRootConfirmModal.dirtyNoneTitle": dict(
    "Uncommitted files right now (none)",
    "Arquivos não commitados agora (nenhum)",
    "Archivos sin commit ahora mismo (ninguno)",
  ),
  "resetRootConfirmModal.dirtyTitle": dict(
    "Uncommitted files right now — about to be stashed",
    "Arquivos não commitados agora — serão colocados no stash",
    "Archivos sin commit ahora mismo — se guardarán en el stash",
  ),
  "resetRootConfirmModal.toast.resetWithStash": dict(
    'Root folder reset. Previous changes saved — recover with "git stash apply {stashRef}".',
    'Pasta raiz resetada. As alterações anteriores foram salvas — recupere com "git stash apply {stashRef}".',
    'Carpeta raíz restablecida. Los cambios anteriores se guardaron — recupéralos con "git stash apply {stashRef}".',
  ),
  "resetRootConfirmModal.toast.resetClean": dict(
    "Root folder was already clean — nothing to reset.",
    "A pasta raiz já estava limpa — nada para resetar.",
    "La carpeta raíz ya estaba limpia — no había nada que restablecer.",
  ),
  "resetRootConfirmModal.toast.resetErrorFallback": dict(
    "Could not reset the root folder.",
    "Não foi possível resetar a pasta raiz.",
    "No se pudo restablecer la carpeta raíz.",
  ),

  "resumeConflictModal.title.selfConflict": dict(
    "This session is already open elsewhere",
    "Esta sessão já está aberta em outro lugar",
    "Esta sesión ya está abierta en otro lugar",
  ),
  "resumeConflictModal.title.otherConflict": dict(
    "Another session is active here",
    "Outra sessão está ativa aqui",
    "Otra sesión está activa aquí",
  ),
  "resumeConflictModal.intro.selfConflict": dict(
    "This exact session is already open in another terminal. Resuming it again here would start a second Claude process against the same transcript at once.",
    "Esta mesma sessão já está aberta em outro terminal. Retomá-la aqui de novo iniciaria um segundo processo do Claude contra a mesma transcrição ao mesmo tempo.",
    "Esta misma sesión ya está abierta en otra terminal. Reanudarla aquí de nuevo iniciaría un segundo proceso de Claude contra la misma transcripción al mismo tiempo.",
  ),
  "resumeConflictModal.intro.otherConflictSuffix": dict(
    "is currently active in this project's folder. Resuming here too would put two Claude processes in the same working tree at once.",
    "está ativa agora nesta pasta do projeto. Retomar aqui também colocaria dois processos do Claude na mesma working tree ao mesmo tempo.",
    "está activa ahora en la carpeta de este proyecto. Reanudar aquí también pondría dos procesos de Claude en el mismo working tree a la vez.",
  ),
  "resumeConflictModal.intro.pickOption": dict(
    "Pick one of the options below instead.",
    "Escolha uma das opções abaixo.",
    "Elige una de las opciones a continuación.",
  ),

  "resumeConflictModal.worktree.title": dict(
    "Create a worktree (recommended)",
    "Criar um worktree (recomendado)",
    "Crear un worktree (recomendado)",
  ),
  "resumeConflictModal.worktree.bodyPrefix": dict(
    "Starts a fresh",
    "Inicia uma conversa nova do",
    "Inicia una conversación nueva de",
  ),
  "resumeConflictModal.worktree.bodyMiddle": dict(
    "conversation in a separate checkout of this project —",
    "em um checkout separado deste projeto —",
    "en un checkout separado de este proyecto —",
  ),
  "resumeConflictModal.worktree.selfTerminalLabel": dict(
    "the terminal that already has this session open",
    "o terminal que já tem esta sessão aberta",
    "la terminal que ya tiene esta sesión abierta",
  ),
  "resumeConflictModal.worktree.otherSessionLabel": dict(
    "the active session above",
    "a sessão ativa acima",
    "la sesión activa arriba",
  ),
  "resumeConflictModal.worktree.bodySuffix": dict(
    "keeps running untouched. It won't resume this specific transcript (the CLI can't do that from a different folder), just a new one alongside it.",
    "continua rodando sem ser afetado. Isso não vai retomar esta transcrição específica (a CLI não consegue fazer isso a partir de uma pasta diferente), só inicia uma nova ao lado dela.",
    "sigue funcionando sin ser afectado. Esto no reanudará esta transcripción específica (la CLI no puede hacer eso desde una carpeta diferente), solo inicia una nueva junto a ella.",
  ),
  "resumeConflictModal.worktree.namePlaceholder": dict(
    "Worktree name, e.g. my-task",
    "Nome do worktree, ex.: minha-tarefa",
    "Nombre del worktree, p. ej. mi-tarea",
  ),
  "resumeConflictModal.worktree.createButton": dict("Create", "Criar", "Crear"),

  "resumeConflictModal.stop.titleSelf": dict(
    "Stop the other terminal & continue here",
    "Parar o outro terminal e continuar aqui",
    "Detener la otra terminal y continuar aquí",
  ),
  "resumeConflictModal.stop.titleOther": dict(
    "Stop the other session & continue here",
    "Parar a outra sessão e continuar aqui",
    "Detener la otra sesión y continuar aquí",
  ),
  "resumeConflictModal.stop.bodySelf": dict(
    "Ends this session's other terminal process",
    "Encerra o outro processo de terminal desta sessão",
    "Finaliza el otro proceso de terminal de esta sesión",
  ),
  "resumeConflictModal.stop.bodyOtherPrefix": dict(
    "Ends",
    "Encerra o processo do terminal de",
    "Finaliza el proceso de terminal de",
  ),
  "resumeConflictModal.stop.bodyOtherSuffix": dict("'s terminal process", "", ""),
  "resumeConflictModal.stop.bodyCommon": dict(
    ", checks out the branch below in this shared folder, then resumes this session there. Anything that terminal hadn't saved or committed yet can be lost — only do this if you're sure it's safe to interrupt.",
    ", faz checkout da branch abaixo nessa pasta compartilhada e então retoma esta sessão ali. Qualquer coisa que aquele terminal ainda não tivesse salvo ou commitado pode ser perdida — só faça isso se tiver certeza de que é seguro interromper.",
    ", hace checkout de la rama de abajo en esa carpeta compartida y luego reanuda esta sesión ahí. Cualquier cosa que esa terminal no hubiera guardado o hecho commit todavía puede perderse — hazlo solo si estás seguro de que es seguro interrumpir.",
  ),
  "resumeConflictModal.stop.branchPlaceholder": dict(
    "Branch to check out",
    "Branch para fazer checkout",
    "Rama para hacer checkout",
  ),
  "resumeConflictModal.stop.confirmButton": dict(
    "Stop & continue",
    "Parar e continuar",
    "Detener y continuar",
  ),
  "resumeConflictModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
} satisfies Record<string, Dict>;

export type TranslationKey = keyof typeof translations;

/** `params` fills `{name}`-style placeholders in the template (e.g. "Deleted {count} sessions.")
 *  — plain string substitution, no ICU plural rules. Where wording genuinely changes by count
 *  (singular vs plural), use two separate keys instead of relying on this for grammar. */
export function t(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = translations[key][language];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}
