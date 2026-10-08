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
 * languages, and no plural/ICU-message needs. Covers essentially every user-visible string in the
 * app now (SessionCard, every modal, filters, toasts included) — a hardcoded string found outside
 * this file is very likely a gap, not a deliberate exception.
 */
export const translations = {
  "header.subtitle": dict(
    "Manage your local sessions",
    "Gerencie suas sessões locais",
    "Administra tus sesiones locales",
  ),
  "header.newTask": dict("New task", "Nova tarefa", "Nueva tarea"),
  "header.skills": dict("Skills", "Skills", "Skills"),
  "header.skills.active": dict(
    "{count} team skill(s) active on this machine",
    "{count} skill(s) do time ativa(s) nesta máquina",
    "{count} skill(s) del equipo activa(s) en esta máquina",
  ),
  "header.skills.notConfigured": dict(
    "Team skills repo not configured — click to set it up",
    "Repo de skills do time não configurado — clique pra configurar",
    "Repo de skills del equipo no configurado — haz clic para configurarlo",
  ),
  "header.skills.notInstalled": dict(
    "Team skills repo configured but not cloned on this machine — click to install",
    "Repo de skills do time configurado mas não clonado nesta máquina — clique pra instalar",
    "Repo de skills del equipo configurado pero no clonado en esta máquina — haz clic para instalarlo",
  ),
  "header.newSession": dict("New session", "Nova sessão", "Nueva sesión"),
  "header.cleanup": dict("Cleanup", "Limpeza", "Limpieza"),
  "header.importSession": dict("Import session", "Importar sessão", "Importar sesión"),
  "header.settings": dict("Settings", "Configurações", "Configuración"),
  "header.language": dict("Language", "Idioma", "Idioma"),








  "confirmDialog.confirm": dict("Confirm", "Confirmar", "Confirmar"),
  "confirmDialog.cancel": dict("Cancel", "Cancelar", "Cancelar"),

  // Translated server error messages — see server/utils/httpError.ts's AppError and
  // resolveApiErrorMessage in src/utils/apiClient.ts. Deliberately generic (they can't carry the
  // specific id/path a given failure mentioned in its raw English message, since only the code
  // crosses into this lookup) — still far better than always-English for the common cases.
  "apiError.sessionNotFound": dict(
    "Session not found.",
    "Sessão não encontrada.",
    "Sesión no encontrada.",
  ),
  "apiError.sessionActive": dict(
    "This session (or its folder) is already open in another terminal.",
    "Esta sessão (ou a pasta dela) já está aberta em outro terminal.",
    "Esta sesión (o su carpeta) ya está abierta en otra terminal.",
  ),
  "apiError.invalidSessionId": dict(
    "Invalid session id.",
    "Id de sessão inválido.",
    "Id de sesión inválido.",
  ),
  "apiError.taskFolderRequired": dict(
    "A project folder is required.",
    "É necessário informar a pasta do projeto.",
    "Se requiere una carpeta de proyecto.",
  ),
  "apiError.taskFolderNotFound": dict(
    "That folder doesn't exist.",
    "Essa pasta não existe.",
    "Esa carpeta no existe.",
  ),
  "apiError.taskNotGitRepo": dict(
    "That folder isn't inside a git repository.",
    "Essa pasta não está dentro de um repositório git.",
    "Esa carpeta no está dentro de un repositorio git.",
  ),
  "apiError.taskBaseBranchRequired": dict(
    "A source branch is required.",
    "É necessário informar a branch de origem.",
    "Se requiere una rama de origen.",
  ),
  "apiError.taskBranchNameRequired": dict(
    "A branch name is required.",
    "É necessário informar o nome da branch.",
    "Se requiere un nombre de rama.",
  ),
  "apiError.taskInvalidBranchName": dict(
    'Not a valid branch name (letters, numbers, "-", "_", "." and "/" only, must start with a ' +
      "letter or number).",
    'Nome de branch inválido (apenas letras, números, "-", "_", "." e "/", precisa começar com ' +
      "letra ou número).",
    'Nombre de rama inválido (solo letras, números, "-", "_", "." y "/", debe empezar con letra ' +
      "o número).",
  ),
  "apiError.taskBaseBranchRefRequired": dict(
    "A resolved base branch is required.",
    "É necessário resolver a branch base primeiro.",
    "Se requiere una rama base resuelta.",
  ),
  "apiError.taskBranchExists": dict(
    "That branch already exists.",
    "Essa branch já existe.",
    "Esa rama ya existe.",
  ),
  "apiError.taskWorktreeExists": dict(
    "The worktree folder for this branch name is already in use — try a different branch name, or remove the worktree occupying it.",
    "A pasta de worktree para esse nome de branch já está em uso — tente outro nome de branch, ou remova o worktree que a está ocupando.",
    "La carpeta de worktree para ese nombre de branch ya está en uso — prueba otro nombre de branch, o elimina el worktree que la ocupa.",
  ),
  "apiError.taskWorktreePathRequired": dict(
    "A worktree path is required.",
    "É necessário informar o caminho do worktree.",
    "Se requiere una ruta de worktree.",
  ),
  "apiError.malformedPreferences": dict(
    "Malformed preferences payload.",
    "Payload de preferências malformado.",
    "Payload de preferencias con formato incorrecto.",
  ),
  "apiError.usageNoCredentials": dict(
    'Could not find Claude\'s login credentials — run "claude" and sign in first.',
    'Não foi possível encontrar as credenciais de login do Claude — rode "claude" e faça login primeiro.',
    'No se pudieron encontrar las credenciales de inicio de sesión de Claude — ejecuta "claude" e ' +
      "inicia sesión primero.",
  ),
  "apiError.usageCredentialsUnreadable": dict(
    "Claude's credentials file is unreadable.",
    "O arquivo de credenciais do Claude está ilegível.",
    "El archivo de credenciales de Claude no se puede leer.",
  ),
  "apiError.usageNoToken": dict(
    'No Claude login token found — run "claude" and sign in first.',
    'Nenhum token de login do Claude encontrado — rode "claude" e faça login primeiro.',
    'No se encontró un token de inicio de sesión de Claude — ejecuta "claude" e inicia sesión ' +
      "primero.",
  ),
  "apiError.usageEndpointUnreachable": dict(
    "Could not reach Anthropic's usage endpoint.",
    "Não foi possível acessar o endpoint de uso da Anthropic.",
    "No se pudo acceder al endpoint de uso de Anthropic.",
  ),
  "apiError.usageTokenExpired": dict(
    'Claude\'s login token has expired — run "claude" once to refresh it.',
    'O token de login do Claude expirou — rode "claude" uma vez para renová-lo.',
    'El token de inicio de sesión de Claude venció — ejecuta "claude" una vez para renovarlo.',
  ),
  "apiError.usageFetchFailed": dict(
    "Could not fetch usage data.",
    "Não foi possível buscar os dados de uso.",
    "No se pudieron obtener los datos de uso.",
  ),
  "apiError.updateBlocked": dict(
    "The project has uncommitted changes — commit or stash them before updating.",
    "O projeto tem alterações não commitadas — commite ou dê stash nelas antes de atualizar.",
    "El proyecto tiene cambios sin confirmar — haz commit o stash antes de actualizar.",
  ),
  "apiError.updateAlreadyRunning": dict(
    "An update is already in progress.",
    "Uma atualização já está em andamento.",
    "Ya hay una actualización en curso.",
  ),
  "apiError.updateFetchFailed": dict(
    "Could not reach the remote repository.",
    "Não foi possível acessar o repositório remoto.",
    "No se pudo acceder al repositorio remoto.",
  ),
  "apiError.updateUnexpectedGitOutput": dict(
    "Unexpected output while checking for updates.",
    "Saída inesperada ao verificar atualizações.",
    "Salida inesperada al comprobar actualizaciones.",
  ),
  "apiError.updateGitPullFailed": dict(
    "Failed to pull the latest changes. If this keeps happening, open a terminal in the " +
      "project folder and run: git fetch origin && git reset --hard origin/main (this discards " +
      "any local changes in favor of the remote).",
    "Falha ao buscar as atualizações mais recentes. Se isso continuar acontecendo, abra um " +
      "terminal na pasta do projeto e rode: git fetch origin && git reset --hard origin/main " +
      "(isso descarta qualquer alteração local em favor do remoto).",
    "Error al obtener los últimos cambios. Si esto sigue ocurriendo, abre una terminal en la " +
      "carpeta del proyecto y ejecuta: git fetch origin && git reset --hard origin/main (esto " +
      "descarta cualquier cambio local en favor del remoto).",
  ),
  "apiError.updateYarnInstallFailed": dict(
    "Failed to install dependencies.",
    "Falha ao instalar as dependências.",
    "Error al instalar las dependencias.",
  ),
  "apiError.cleanupMissingTarget": dict(
    "Missing worktree path or branch for this cleanup item.",
    "Faltam o caminho do worktree ou a branch para este item de limpeza.",
    "Falta la ruta del worktree o la rama para este elemento de limpieza.",
  ),
  "apiError.cleanupTargetGone": dict(
    "That folder no longer exists — refresh the list.",
    "Essa pasta não existe mais — atualize a lista.",
    "Esa carpeta ya no existe — actualiza la lista.",
  ),
  "apiError.cleanupBranchNotMerged": dict(
    "That branch is no longer merged into the default branch — cancelled for safety.",
    "Essa branch não está mais mergeada na branch padrão — cancelado por segurança.",
    "Esa rama ya no está fusionada con la rama predeterminada — cancelado por seguridad.",
  ),
  "apiError.cleanupUncommittedChanges": dict(
    "That folder now has uncommitted changes — cancelled for safety.",
    "Essa pasta agora tem alterações não commitadas — cancelado por segurança.",
    "Esa carpeta ahora tiene cambios sin confirmar — cancelado por seguridad.",
  ),
  "apiError.malformedCleanupFinding": dict(
    "Malformed cleanup finding.",
    "Item de limpeza malformado.",
    "Elemento de limpieza con formato incorrecto.",
  ),
  "apiError.taskBaseBranchNotFound": dict(
    "That base branch wasn't found locally or on origin.",
    "Essa branch base não foi encontrada localmente nem no origin.",
    "Esa rama base no se encontró localmente ni en origin.",
  ),
  "apiError.notAGitWorktree": dict(
    "That folder is no longer a git worktree.",
    "Essa pasta não é mais um worktree do git.",
    "Esa carpeta ya no es un worktree de git.",
  ),
  "apiError.sessionNoWorkingDirectory": dict(
    "This session has no known working directory.",
    "Esta sessão não tem um diretório de trabalho conhecido.",
    "Esta sesión no tiene un directorio de trabajo conocido.",
  ),
  "apiError.sessionDirectoryMissing": dict(
    "This session's original directory no longer exists. Recreate the folder (or a symlink) at " +
      "the old path to continue working with it.",
    "O diretório original desta sessão não existe mais. Recrie a pasta (ou um link simbólico) no " +
      "caminho antigo para continuar trabalhando com ela.",
    "El directorio original de esta sesión ya no existe. Recrea la carpeta (o un enlace " +
      "simbólico) en la ruta anterior para seguir trabajando con ella.",
  ),
  "apiError.directoryMissing": dict(
    "That directory no longer exists.",
    "Essa pasta não existe mais.",
    "Esa carpeta ya no existe.",
  ),
  "apiError.vscodeCommandNotFound": dict(
    'Could not open VS Code — the "code" command wasn\'t found on PATH.',
    'Não foi possível abrir o VS Code — o comando "code" não foi encontrado no PATH.',
    'No se pudo abrir VS Code — el comando "code" no se encontró en el PATH.',
  ),
  "apiError.cursorCommandNotFound": dict(
    'Could not open Cursor — the "cursor" command wasn\'t found on PATH.',
    'Não foi possível abrir o Cursor — o comando "cursor" não foi encontrado no PATH.',
    'No se pudo abrir Cursor — el comando "cursor" no se encontró en el PATH.',
  ),
  "apiError.notAppWorktree": dict(
    "This session's directory doesn't look like one of this app's own worktrees.",
    "O diretório desta sessão não parece ser um worktree criado por este app.",
    "El directorio de esta sesión no parece ser un worktree creado por esta app.",
  ),
  "apiError.projectRootMissing": dict(
    "The project's root folder no longer exists either.",
    "A pasta raiz do projeto também não existe mais.",
    "La carpeta raíz del proyecto tampoco existe.",
  ),
  "apiError.terminalLaunchFailed": dict(
    "Could not open a terminal.",
    "Não foi possível abrir um terminal.",
    "No se pudo abrir una terminal.",
  ),
  "apiError.worktreeNameRequired": dict(
    "A worktree name is required.",
    "É necessário informar o nome do worktree.",
    "Se requiere un nombre de worktree.",
  ),
  "apiError.notAWorktreeSession": dict(
    "This session isn't running in a git worktree.",
    "Esta sessão não está rodando em um worktree do git.",
    "Esta sesión no se está ejecutando en un worktree de git.",
  ),
  "apiError.protectedBranchDeleteForbidden": dict(
    "Refusing to delete that branch — it looks like the repo's primary branch.",
    "Não é possível excluir essa branch — ela parece ser a branch principal do repositório.",
    "No se puede eliminar esa rama — parece ser la rama principal del repositorio.",
  ),
  "apiError.repoRootUnresolved": dict(
    "Could not resolve the repo root for this session's directory.",
    "Não foi possível resolver a raiz do repositório para o diretório desta sessão.",
    "No se pudo resolver la raíz del repositorio para el directorio de esta sesión.",
  ),
  "apiError.worktreeBranchUnknown": dict(
    "Could not determine the worktree's branch before removing it.",
    "Não foi possível determinar a branch do worktree antes de removê-lo.",
    "No se pudo determinar la rama del worktree antes de eliminarlo.",
  ),
  "apiError.worktreeToRootCheckoutFailed": dict(
    "The worktree was removed, but checking out its branch in the root folder failed — the " +
      "branch's commits are safe, finish the checkout by hand from a terminal there.",
    "O worktree foi removido, mas o checkout da branch na pasta raiz falhou — os commits da " +
      "branch estão seguros, finalize o checkout manualmente por um terminal ali.",
    "El worktree fue eliminado, pero el checkout de su rama en la carpeta raíz falló — los " +
      "commits de la rama están seguros, termina el checkout manualmente desde una terminal ahí.",
  ),
  "apiError.importInvalidBundle": dict(
    "This file isn't a session exported by Claude Session Manager.",
    "Este arquivo não é uma sessão exportada pelo Claude Session Manager.",
    "Este archivo no es una sesión exportada por Claude Session Manager.",
  ),
  "apiError.importUnsupportedVersion": dict(
    "This session was exported by a newer version of the app — update it first.",
    "Esta sessão foi exportada por uma versão mais nova do app — atualize-o primeiro.",
    "Esta sesión fue exportada por una versión más nueva de la app — actualízala primero.",
  ),
  "apiError.importTargetRequired": dict(
    "Choose the folder to import the session into.",
    "Escolha a pasta para onde importar a sessão.",
    "Elige la carpeta a la que importar la sesión.",
  ),
  "apiError.importTargetMissing": dict(
    "That folder doesn't exist on this machine.",
    "Essa pasta não existe nesta máquina.",
    "Esa carpeta no existe en esta máquina.",
  ),
  "apiError.importSessionExists": dict(
    "This session already exists here — choose whether to overwrite it or import a copy.",
    "Esta sessão já existe aqui — escolha entre sobrescrever ou importar uma cópia.",
    "Esta sesión ya existe aquí — elige entre sobrescribirla o importar una copia.",
  ),
  "apiError.importOverwriteActive": dict(
    "The local session is active in a terminal — close it before overwriting, or import a copy.",
    "A sessão local está ativa num terminal — feche-a antes de sobrescrever, ou importe uma cópia.",
    "La sesión local está activa en una terminal — ciérrala antes de sobrescribir, o importa una copia.",
  ),
  "apiError.importCheckoutBlockedActive": dict(
    "Another Claude session is active in that folder — close it before switching branches, or import without checking out.",
    "Outra sessão do Claude está ativa nessa pasta — feche-a antes de trocar de branch, ou importe sem fazer checkout.",
    "Otra sesión de Claude está activa en esa carpeta — ciérrala antes de cambiar de rama, o importa sin hacer checkout.",
  ),
  "apiError.worktreeUncommittedChanges": dict(
    "That worktree still has uncommitted changes, so it wasn't removed — commit or discard them " +
      'first (or use "copy" mode instead, which doesn\'t require the worktree to be clean).',
    'Esse worktree ainda tem alterações não commitadas, então não foi removido — commite ou ' +
      'descarte elas primeiro (ou use o modo "copiar", que não exige que o worktree esteja limpo).',
    'Ese worktree todavía tiene cambios sin confirmar, así que no se eliminó — haz commit o ' +
      'descártalos primero (o usa el modo "copiar", que no requiere que el worktree esté limpio).',
  ),

  "modal.closeAriaLabel": dict("Close", "Fechar", "Cerrar"),
  "modal.confirmDefault": dict("Confirm", "Confirmar", "Confirmar"),
  "modal.cancelDefault": dict("Cancel", "Cancelar", "Cancelar"),

  "toast.closeAriaLabel": dict(
    "Close notification",
    "Fechar notificação",
    "Cerrar notificación",
  ),

  "nicknameModal.title": dict("Local nickname", "Apelido local", "Apodo local"),
  "nicknameModal.save": dict("Save", "Salvar", "Guardar"),
  "nicknameModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "nicknameModal.description": dict(
    "Only shown in this app's session list, alongside the session's real title — it won't rename the session or change what any terminal (including Warp) shows for it. Leave blank to remove the nickname.",
    "Aparece só na lista de sessões deste app, ao lado do título real da sessão — não renomeia a sessão nem muda o que qualquer terminal (incluindo o Warp) exibe para ela. Deixe em branco para remover o apelido.",
    "Solo se muestra en la lista de sesiones de esta app, junto al título real de la sesión — no renombra la sesión ni cambia lo que muestra cualquier terminal (incluido Warp). Déjalo en blanco para quitar el apodo.",
  ),
  "nicknameModal.placeholder": dict("Nickname", "Apelido", "Apodo"),

  "jenkinsLinksModal.title": dict("Jenkins", "Jenkins", "Jenkins"),
  "jenkinsLinksModal.section.currentBranch": dict(
    "Current branch",
    "Branch atual",
    "Rama actual",
  ),
  "jenkinsLinksModal.section.originBranch": dict(
    "Branch it was created from",
    "Branch de origem",
    "Rama de origen",
  ),
  "jenkinsLinksModal.section.envPreviews": dict(
    "{branch} previews:",
    "Previews do {branch}:",
    "Previews de {branch}:",
  ),
  "jenkinsLinksModal.section.variants": dict(
    "Same ticket, other prefixes",
    "Mesmo ticket, outros prefixos",
    "Mismo ticket, otros prefijos",
  ),
  "jenkinsLinksModal.section.views": dict("Project", "Projeto", "Proyecto"),
  "jenkinsLinksModal.project": dict(
    "{project} (all branches)",
    "{project} (todas as branches)",
    "{project} (todas las ramas)",
  ),
  "jenkinsLinksModal.pullRequests": dict("Pull requests", "Pull requests", "Pull requests"),
  "jenkinsLinksModal.tags": dict("Tags", "Tags", "Tags"),

  "settings.title": dict("Settings", "Configurações", "Configuración"),
  "settings.intro": dict(
    "Everything this app remembers on this machine (userPreferences.json).",
    "Tudo o que este app guarda nesta máquina (userPreferences.json).",
    "Todo lo que esta app guarda en esta máquina (userPreferences.json).",
  ),
  "settings.openFile": dict(
    "Open file in VS Code",
    "Abrir arquivo no VS Code",
    "Abrir archivo en VS Code",
  ),
  "settings.loading": dict("Loading settings…", "Carregando configurações…", "Cargando configuración…"),
  "settings.loadError": dict(
    "Could not load the settings.",
    "Não foi possível carregar as configurações.",
    "No se pudo cargar la configuración.",
  ),
  "settings.saveError": dict(
    "Could not save the setting.",
    "Não foi possível salvar a configuração.",
    "No se pudo guardar la configuración.",
  ),
  "settings.openFileError": dict(
    "Could not open the file in VS Code.",
    "Não foi possível abrir o arquivo no VS Code.",
    "No se pudo abrir el archivo en VS Code.",
  ),
  "settings.saved": dict("Setting saved.", "Configuração salva.", "Configuración guardada."),
  "settings.edit": dict("Edit", "Editar", "Editar"),
  "settings.save": dict("Save", "Salvar", "Guardar"),
  "settings.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "settings.preview.notSet": dict("Not set yet", "Ainda não configurado", "Aún sin configurar"),
  "settings.preview.emptyList": dict("(empty)", "(vazio)", "(vacío)"),
  "settings.preview.emptyText": dict("(empty)", "(vazio)", "(vacío)"),
  "settings.preview.text": dict(
    "{firstLine} … ({lines} lines)",
    "{firstLine} … ({lines} linhas)",
    "{firstLine} … ({lines} líneas)",
  ),
  "settings.list.add": dict("Add", "Adicionar", "Agregar"),
  "settings.list.remove": dict("Remove", "Remover", "Quitar"),
  "settings.list.moveUp": dict("Move up", "Mover para cima", "Subir"),
  "settings.list.moveDown": dict("Move down", "Mover para baixo", "Bajar"),
  "settings.workspaceDirs.title": dict(
    "Repository folders",
    "Pastas de repositórios",
    "Carpetas de repositorios",
  ),
  "settings.workspaceDirs.description": dict(
    "Folders holding your repos (e.g. ~/git) — every repo directly inside them is known to the app, even ones you never used with Claude.",
    "Pastas onde ficam seus repos (ex.: ~/git) — todo repo direto dentro delas fica conhecido pelo app, mesmo os que você nunca usou com o Claude.",
    "Carpetas donde están tus repos (ej.: ~/git) — todo repo directamente dentro de ellas queda conocido por la app, incluso los que nunca usaste con Claude.",
  ),
  "settings.defaultPrompt.title": dict("Default prompt", "Prompt padrão", "Prompt predeterminado"),
  "settings.defaultPrompt.description": dict(
    "Pre-filled instructions in the \"New task\" modal.",
    "Instruções que já vêm preenchidas no modal \"Nova tarefa\".",
    "Instrucciones que vienen precargadas en el modal \"Nueva tarea\".",
  ),
  "settings.defaultSessionPrompt.title": dict(
    "Default session prompt",
    "Prompt padrão de sessão",
    "Prompt predeterminado de sesión",
  ),
  "settings.defaultSessionPrompt.description": dict(
    "Pre-filled instructions in the \"New session\" modal.",
    "Instruções que já vêm preenchidas no modal \"Nova sessão\".",
    "Instrucciones que vienen precargadas en el modal \"Nueva sesión\".",
  ),
  "settings.branchTypes.title": dict("Branch types", "Tipos de branch", "Tipos de rama"),
  "settings.branchTypes.description": dict(
    "Options of the \"New task\" branch type select — the first one is the default.",
    "Opções do seletor de tipo de branch do \"Nova tarefa\" — a primeira é a padrão.",
    "Opciones del selector de tipo de rama de \"Nueva tarea\" — la primera es la predeterminada.",
  ),
  "settings.branchTypes.placeholder": dict("e.g. feature", "ex.: feature", "ej.: feature"),
  "settings.branchTypes.firstIsDefault": dict("default", "padrão", "predeterminado"),
  "settings.recentProjectPaths.title": dict(
    "Recent projects",
    "Projetos recentes",
    "Proyectos recientes",
  ),
  "settings.recentProjectPaths.description": dict(
    "Repos used in \"New task\", most recent first — remove the ones that no longer exist.",
    "Repos usados no \"Nova tarefa\", mais recentes primeiro — remova os que não existem mais.",
    "Repos usados en \"Nueva tarea\", los más recientes primero — quita los que ya no existen.",
  ),
  "settings.recentProjectPaths.placeholder": dict(
    "/absolute/path/to/repo",
    "/caminho/absoluto/do/repo",
    "/ruta/absoluta/del/repo",
  ),
  "settings.useWorktreeByDefault.title": dict(
    "Use a worktree by default",
    "Usar worktree por padrão",
    "Usar worktree por defecto",
  ),
  "settings.useWorktreeByDefault.description": dict(
    "\"New task\" fallback before a folder is chosen — once it is, the app suggests a worktree only if the repo root already has an active session.",
    "Padrão do \"Nova tarefa\" antes de escolher a pasta — depois de escolhida, o app sugere worktree só se a raiz do repo já tiver uma sessão ativa.",
    "Valor de \"Nueva tarea\" antes de elegir la carpeta — una vez elegida, la app sugiere worktree solo si la raíz del repo ya tiene una sesión activa.",
  ),
  "settings.useAutoPermissionModeByDefault.title": dict(
    "Start tasks with --permission-mode auto",
    "Iniciar tarefas com --permission-mode auto",
    "Iniciar tareas con --permission-mode auto",
  ),
  "settings.useAutoPermissionModeByDefault.description": dict(
    "Default state of that checkbox in \"New task\".",
    "Estado padrão dessa opção no \"Nova tarefa\".",
    "Estado predeterminado de esa opción en \"Nueva tarea\".",
  ),
  "settings.keepRecentSessionsPerProject.title": dict(
    "Sessions kept by Cleanup",
    "Sessões mantidas pela Limpeza",
    "Sesiones conservadas por Limpieza",
  ),
  "settings.keepRecentSessionsPerProject.description": dict(
    "How many of each project's most recent sessions the \"old sessions\" cleanup always keeps.",
    "Quantas das sessões mais recentes de cada projeto a limpeza de \"sessões antigas\" sempre mantém.",
    "Cuántas de las sesiones más recientes de cada proyecto conserva siempre la limpieza de \"sesiones antiguas\".",
  ),
  "settings.theme.title": dict("Theme", "Tema", "Tema"),
  "settings.theme.description": dict(
    "Light or dark — saved in this browser, not in userPreferences.json.",
    "Claro ou escuro — salvo neste navegador, não no userPreferences.json.",
    "Claro u oscuro — guardado en este navegador, no en userPreferences.json.",
  ),

  "workspaceDirs.add": dict("Add", "Adicionar", "Agregar"),
  "workspaceDirs.remove": dict("Remove folder", "Remover pasta", "Quitar carpeta"),
  "workspaceDirs.empty": dict(
    "No folder added yet.",
    "Nenhuma pasta adicionada ainda.",
    "Todavía no agregaste ninguna carpeta.",
  ),
  "workspaceDirs.placeholder": dict(
    "/absolute/path or ~/folder",
    "/caminho/absoluto ou ~/pasta",
    "/ruta/absoluta o ~/carpeta",
  ),
  "workspaceDirs.loadingSuggestions": dict(
    "Looking for where your repos are…",
    "Procurando onde estão seus repos…",
    "Buscando dónde están tus repos…",
  ),
  "workspaceDirs.suggestionsTitle": dict(
    "Suggestions, based on the repos you already use:",
    "Sugestões, com base nos repos que você já usa:",
    "Sugerencias, según los repos que ya usas:",
  ),
  "workspaceDirs.status.repos": dict("{count} repo(s)", "{count} repo(s)", "{count} repo(s)"),
  "workspaceDirs.status.missing": dict(
    "Folder doesn't exist",
    "Pasta não existe",
    "La carpeta no existe",
  ),

  "workspaceDirsPrompt.title": dict(
    "Where are your repos?",
    "Onde ficam seus repositórios?",
    "¿Dónde están tus repositorios?",
  ),
  "workspaceDirsPrompt.intro": dict(
    "Pick the folder(s) where you keep your repos. The app uses them to know every project you work on — not only the ones you already used with Claude.",
    "Escolha a(s) pasta(s) onde você guarda seus repos. O app usa isso para conhecer todos os projetos em que você trabalha — não só os que você já usou com o Claude.",
    "Elige la(s) carpeta(s) donde guardas tus repos. La app las usa para conocer todos los proyectos en los que trabajas — no solo los que ya usaste con Claude.",
  ),
  "workspaceDirsPrompt.laterHint": dict(
    "You can change this any time in Settings (gear icon in the header).",
    "Dá para mudar quando quiser em Configurações (ícone de engrenagem no header).",
    "Puedes cambiarlo cuando quieras en Configuración (ícono de engranaje en el encabezado).",
  ),
  "teamPrompt.title": dict(
    "Team integrations",
    "Integrações do time",
    "Integraciones del equipo",
  ),
  "teamPrompt.intro": dict(
    "Optional, per-machine settings for your team's tools. They live only in your local userPreferences.json — never in this app's public repo.",
    "Configurações opcionais e locais das ferramentas do seu time. Ficam só no seu userPreferences.json local — nunca no repo público deste app.",
    "Configuraciones opcionales y locales de las herramientas de tu equipo. Quedan solo en tu userPreferences.json local — nunca en el repo público de esta app.",
  ),
  "teamPrompt.prefilled": dict(
    "Pre-filled from your current setup — just confirm.",
    "Pré-preenchido com a sua configuração atual — é só confirmar.",
    "Prellenado con tu configuración actual — solo confirma.",
  ),
  "teamPrompt.jenkins.label": dict(
    "Jenkins base URL",
    "URL base do Jenkins",
    "URL base de Jenkins",
  ),
  "teamPrompt.jenkins.hint": dict(
    "Enables the Jenkins button on session cards. Leave empty if your team doesn't use Jenkins.",
    "Habilita o botão do Jenkins nos cards de sessão. Deixe vazio se o seu time não usa Jenkins.",
    "Habilita el botón de Jenkins en las tarjetas de sesión. Déjalo vacío si tu equipo no usa Jenkins.",
  ),
  "teamPrompt.skillsHub.label": dict(
    "Team skills repo (clone URL)",
    "Repo de skills do time (URL de clone)",
    "Repo de skills del equipo (URL de clonado)",
  ),
  "teamPrompt.skillsHub.hint": dict(
    "A git repo with a catalog/ folder of Claude skills, e.g. git@host:team/skills-repo.git. Ask your team. Leave empty if there's none.",
    "Um repo git com uma pasta catalog/ de skills do Claude, ex.: git@host:time/repo-de-skills.git. Pergunte ao seu time. Deixe vazio se não houver.",
    "Un repo git con una carpeta catalog/ de skills de Claude, p. ej. git@host:equipo/repo-de-skills.git. Pregunta a tu equipo. Déjalo vacío si no hay.",
  ),
  "teamPrompt.save": dict(
    "Save",
    "Salvar",
    "Guardar",
  ),
  "teamPrompt.skip": dict(
    "Not now",
    "Agora não",
    "Ahora no",
  ),
  "teamPrompt.saved": dict(
    "Team integrations saved.",
    "Integrações do time salvas.",
    "Integraciones del equipo guardadas.",
  ),
  "workspaceDirsPrompt.save": dict("Save", "Salvar", "Guardar"),
  "workspaceDirsPrompt.skip": dict("Not now", "Agora não", "Ahora no"),
  "workspaceDirsPrompt.saved": dict(
    "Repository folders saved.",
    "Pastas de repositórios salvas.",
    "Carpetas de repositorios guardadas.",
  ),

  "exportSessionModal.title": dict("Export session", "Exportar sessão", "Exportar sesión"),
  "exportSessionModal.intro": dict(
    "Downloads this session as a single .claude-session.json.gz file. Send it to another dev (Teams, Slack, e-mail…) and they can import it with \"Import session\" in their own Claude Session Manager.",
    "Baixa esta sessão como um único arquivo .claude-session.json.gz. Envie para outro dev (Teams, Slack, e-mail…) e ele pode importar com \"Importar sessão\" no próprio Claude Session Manager.",
    "Descarga esta sesión como un único archivo .claude-session.json.gz. Envíalo a otro dev (Teams, Slack, e-mail…) y podrá importarlo con \"Importar sesión\" en su propio Claude Session Manager.",
  ),
  "exportSessionModal.sensitiveWarning": dict(
    "The file holds the whole conversation, including the contents of every file Claude read and every command output it saw. Make sure it doesn't contain passwords, tokens or other secrets before sending it — you can review it with: zcat <file> | less",
    "O arquivo contém a conversa inteira, incluindo o conteúdo de todo arquivo que o Claude leu e toda saída de comando que ele viu. Confira se não há senhas, tokens ou outros segredos antes de enviar — dá pra revisar com: zcat <arquivo> | less",
    "El archivo contiene la conversación completa, incluido el contenido de cada archivo que Claude leyó y cada salida de comando que vio. Asegúrate de que no contenga contraseñas, tokens u otros secretos antes de enviarlo — puedes revisarlo con: zcat <archivo> | less",
  ),
  "exportSessionModal.recipientHint": dict(
    "Whoever imports it needs a clone of the same repository; the app finds it by the origin URL and rewrites the paths to theirs.",
    "Quem importar precisa ter um clone do mesmo repositório; o app encontra pelo URL do origin e reescreve os caminhos para os dele.",
    "Quien la importe necesita un clon del mismo repositorio; la app lo encuentra por la URL de origin y reescribe las rutas a las suyas.",
  ),
  "exportSessionModal.confirm": dict("Download file", "Baixar arquivo", "Descargar archivo"),
  "exportSessionModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "exportSessionModal.success": dict("Session exported.", "Sessão exportada.", "Sesión exportada."),
  "exportSessionModal.error": dict(
    "Could not export the session.",
    "Não foi possível exportar a sessão.",
    "No se pudo exportar la sesión.",
  ),

  "importSessionModal.title": dict("Import session", "Importar sessão", "Importar sesión"),
  "importSessionModal.intro": dict(
    "Pick a .claude-session.json.gz file exported from another machine. Nothing is written until you confirm.",
    "Escolha um arquivo .claude-session.json.gz exportado de outra máquina. Nada é gravado até você confirmar.",
    "Elige un archivo .claude-session.json.gz exportado desde otra máquina. No se escribe nada hasta que confirmes.",
  ),
  "importSessionModal.chooseFile": dict("Choose file…", "Escolher arquivo…", "Elegir archivo…"),
  "importSessionModal.chooseAnother": dict(
    "Choose another file…",
    "Escolher outro arquivo…",
    "Elegir otro archivo…",
  ),
  "importSessionModal.inspectError": dict(
    "Could not read this file.",
    "Não foi possível ler este arquivo.",
    "No se pudo leer este archivo.",
  ),
  "importSessionModal.importError": dict(
    "Could not import the session.",
    "Não foi possível importar a sessão.",
    "No se pudo importar la sesión.",
  ),
  "importSessionModal.success": dict(
    "Session imported.",
    "Sessão importada.",
    "Sesión importada.",
  ),
  "importSessionModal.successCopy": dict(
    "Session imported as a copy (it already existed here).",
    "Sessão importada como cópia (ela já existia aqui).",
    "Sesión importada como copia (ya existía aquí).",
  ),
  "importSessionModal.confirm": dict("Import", "Importar", "Importar"),
  "importSessionModal.confirmOverwrite": dict(
    "Overwrite and import",
    "Sobrescrever e importar",
    "Sobrescribir e importar",
  ),
  "importSessionModal.successOverwrite": dict(
    "Session imported, replacing the local copy.",
    "Sessão importada, substituindo a cópia local.",
    "Sesión importada, reemplazando la copia local.",
  ),
  "importSessionModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
  "importSessionModal.field.title": dict("Title", "Título", "Título"),
  "importSessionModal.field.nickname": dict("Nickname", "Apelido", "Apodo"),
  "importSessionModal.field.branch": dict("Branch", "Branch", "Rama"),
  "importSessionModal.field.remote": dict("Repository", "Repositório", "Repositorio"),
  "importSessionModal.field.originalFolder": dict(
    "Original folder",
    "Pasta original",
    "Carpeta original",
  ),
  "importSessionModal.field.lastActivity": dict(
    "Last activity",
    "Última atividade",
    "Última actividad",
  ),
  "importSessionModal.field.size": dict("Size", "Tamanho", "Tamaño"),
  "importSessionModal.subagents": dict(
    "{count} subagent(s)",
    "{count} subagente(s)",
    "{count} subagente(s)",
  ),
  "importSessionModal.conflict.title": dict(
    "This session already exists on this machine. Choose what to do:",
    "Esta sessão já existe nesta máquina. Escolha o que fazer:",
    "Esta sesión ya existe en esta máquina. Elige qué hacer:",
  ),
  "importSessionModal.conflict.local": dict("Here now", "Aqui agora", "Aquí ahora"),
  "importSessionModal.conflict.incoming": dict("In the file", "No arquivo", "En el archivo"),
  "importSessionModal.conflict.incomingNewer": dict(
    "The file is newer.",
    "O arquivo é mais recente.",
    "El archivo es más reciente.",
  ),
  "importSessionModal.conflict.incomingOlder": dict(
    "The file is older than the local copy.",
    "O arquivo é mais antigo que a cópia local.",
    "El archivo es más antiguo que la copia local.",
  ),
  "importSessionModal.conflict.incomingSame": dict(
    "Same version as the local copy.",
    "Mesma versão da cópia local.",
    "Misma versión que la copia local.",
  ),
  "importSessionModal.conflict.copy.title": dict(
    "Import as a copy (new id)",
    "Importar como cópia (novo id)",
    "Importar como copia (id nuevo)",
  ),
  "importSessionModal.conflict.copy.body": dict(
    "Both stay: the local session is untouched and the imported one gets a new id.",
    "As duas ficam: a sessão local não é alterada e a importada ganha um novo id.",
    "Quedan las dos: la sesión local no se modifica y la importada recibe un id nuevo.",
  ),
  "importSessionModal.conflict.overwrite.title": dict(
    "Overwrite the local session",
    "Sobrescrever a sessão local",
    "Sobrescribir la sesión local",
  ),
  "importSessionModal.conflict.overwrite.body": dict(
    "Replaces the local conversation (and its subagents) with the file's, keeping the same id. The local version is lost.",
    "Substitui a conversa local (e seus subagentes) pela do arquivo, mantendo o mesmo id. A versão local é perdida.",
    "Reemplaza la conversación local (y sus subagentes) por la del archivo, manteniendo el mismo id. La versión local se pierde.",
  ),
  "importSessionModal.conflict.overwrite.blockedActive": dict(
    "Unavailable — the local session is active in a terminal. Close it first, or import a copy.",
    "Indisponível — a sessão local está ativa num terminal. Feche-a antes, ou importe uma cópia.",
    "No disponible — la sesión local está activa en una terminal. Ciérrala antes, o importa una copia.",
  ),
  "importSessionModal.targetLabel": dict(
    "Import into this local clone",
    "Importar neste clone local",
    "Importar en este clon local",
  ),
  "importSessionModal.sameRepoOption": dict(
    "{path} (same repository)",
    "{path} (mesmo repositório)",
    "{path} (mismo repositorio)",
  ),
  "importSessionModal.otherFolderOption": dict(
    "Other folder…",
    "Outra pasta…",
    "Otra carpeta…",
  ),
  "importSessionModal.otherFolderPlaceholder": dict(
    "/absolute/path/to/your/clone",
    "/caminho/absoluto/do/seu/clone",
    "/ruta/absoluta/de/tu/clon",
  ),
  "importSessionModal.subfolderHint": dict(
    "The session ran in a subfolder — it will be resumed from:",
    "A sessão rodou numa subpasta — ela será retomada a partir de:",
    "La sesión se ejecutó en una subcarpeta — se reanudará desde:",
  ),
  "importSessionModal.remoteMismatch": dict(
    "This folder's origin doesn't match the exported session's repository — Claude may refer to files that don't exist here.",
    "O origin desta pasta não bate com o repositório da sessão exportada — o Claude pode citar arquivos que não existem aqui.",
    "El origin de esta carpeta no coincide con el repositorio de la sesión exportada — Claude puede mencionar archivos que no existen aquí.",
  ),
  "importSessionModal.commitMissing": dict(
    "Commit {commit} (where the session left off) isn't in this clone yet — run git fetch, or the branch may not have been pushed.",
    "O commit {commit} (onde a sessão parou) ainda não está neste clone — rode git fetch, ou a branch pode não ter sido enviada (push).",
    "El commit {commit} (donde quedó la sesión) aún no está en este clon — ejecuta git fetch, o puede que la rama no se haya subido (push).",
  ),
  "importSessionModal.checkoutLabel": dict(
    "Check out {branch} before importing",
    "Fazer checkout de {branch} antes de importar",
    "Hacer checkout de {branch} antes de importar",
  ),
  "importSessionModal.checkoutHint": dict(
    "Fetched from origin if you don't have it locally. Uncommitted changes that would be overwritten block the checkout.",
    "Busca no origin se você não tiver localmente. Alterações não commitadas que seriam sobrescritas bloqueiam o checkout.",
    "Se busca en origin si no la tienes localmente. Los cambios sin commit que se sobrescribirían bloquean el checkout.",
  ),
  "importSessionModal.checkoutHintWithCurrent": dict(
    "This folder is on {current} now. Fetched from origin if you don't have it locally; uncommitted changes that would be overwritten block the checkout.",
    "Esta pasta está em {current} agora. Busca no origin se você não tiver localmente; alterações não commitadas que seriam sobrescritas bloqueiam o checkout.",
    "Esta carpeta está en {current} ahora. Se busca en origin si no la tienes localmente; los cambios sin commit que se sobrescribirían bloquean el checkout.",
  ),
  "importSessionModal.checkoutBlocked": dict(
    "Unavailable — another Claude session is active in this folder.",
    "Indisponível — outra sessão do Claude está ativa nesta pasta.",
    "No disponible — otra sesión de Claude está activa en esta carpeta.",
  ),
  "importSessionModal.alreadyOnBranch": dict(
    "This folder is already on {branch}.",
    "Esta pasta já está em {branch}.",
    "Esta carpeta ya está en {branch}.",
  ),

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

  "subagentsModal.title": dict(
    "Subagents — {title}",
    "Subagentes — {title}",
    "Subagentes — {title}",
  ),
  "subagentsModal.showLess": dict("Show less", "Mostrar menos", "Mostrar menos"),
  "subagentsModal.showMore": dict("Show more", "Mostrar mais", "Mostrar más"),
  "subagentsModal.unknownType": dict("unknown", "desconhecido", "desconocido"),
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

  "searchBar.placeholder": dict(
    "Search by title, project, branch, or ID...",
    "Buscar por título, projeto, branch ou ID...",
    "Buscar por título, proyecto, branch o ID...",
  ),
  "searchBar.clearLabel": dict("Clear search", "Limpar busca", "Limpiar búsqueda"),

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
  "loadingState.scanning.title": dict(
    "Scanning your sessions for the first time — this can take a while with a lot of them.",
    "Fazendo a primeira varredura das suas sessões — isso pode demorar um pouco se houver muitas.",
    "Escaneando tus sesiones por primera vez — esto puede tardar un poco si hay muchas.",
  ),
  "loadingState.scanning.progress": dict(
    "{done} of {total} sessions processed",
    "{done} de {total} sessões processadas",
    "{done} de {total} sesiones procesadas",
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
  "sessionCard.cursorButton": dict("cursor .", "cursor .", "cursor ."),
  "sessionCard.openInCursorTooltip": dict(
    "Open this folder in Cursor",
    "Abrir esta pasta no Cursor",
    "Abrir esta carpeta en Cursor",
  ),
  "sessionCard.openInCursorAriaLabel": dict(
    "Open in Cursor",
    "Abrir no Cursor",
    "Abrir en Cursor",
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
    "View what each subagent did",
    "Veja o que cada subagente fez",
    "Mira lo que hizo cada subagente",
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
  "sessionCard.previewTooltip": dict(
    "Preview prompts sent in this session",
    "Veja os prompts enviados nesta sessão",
    "Vista previa de los prompts enviados en esta sesión",
  ),
  "sessionCard.previewAriaLabel": dict("Preview prompts", "Ver prompts", "Vista previa de prompts"),
  "sessionCard.exportTooltip": dict(
    "Export session as a file",
    "Exportar sessão como arquivo",
    "Exportar sesión como archivo",
  ),
  "sessionCard.exportAriaLabel": dict("Export session", "Exportar sessão", "Exportar sesión"),
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
  "sessionCard.openJenkinsTooltip": dict(
    "Jenkins links for this project and branch",
    "Links do Jenkins deste projeto e branch",
    "Enlaces de Jenkins de este proyecto y rama",
  ),
  "sessionCard.openJenkinsAriaLabel": dict(
    "Jenkins links",
    "Links do Jenkins",
    "Enlaces de Jenkins",
  ),
  "sessionCard.openPrTooltip": dict(
    "Open this branch's compare/PR page (GitHub or Bitbucket)",
    "Abrir a página de comparação/PR desta branch (GitHub ou Bitbucket)",
    "Abrir la página de comparación/PR de esta rama (GitHub o Bitbucket)",
  ),
  "sessionCard.openPrAriaLabel": dict(
    "Open PR page",
    "Abrir página de PR",
    "Abrir página de PR",
  ),
  "sessionCard.openPr.error": dict(
    "Couldn't open a PR link for this session.",
    "Não foi possível abrir um link de PR para esta sessão.",
    "No se pudo abrir un enlace de PR para esta sesión.",
  ),
  "openPrBaseChoiceModal.title": dict(
    "Compare against which base?",
    "Comparar com qual branch base?",
    "¿Comparar contra qué rama base?",
  ),
  "openPrBaseChoiceModal.intro": dict(
    "This task's branch was created off {branch} instead of the repo's default. Choose which comparison to open.",
    "A branch desta tarefa foi criada a partir de {branch}, e não da branch padrão do repositório. Escolha qual comparação abrir.",
    "La rama de esta tarea se creó a partir de {branch}, no de la rama predeterminada del repositorio. Elige qué comparación abrir.",
  ),
  "openPrBaseChoiceModal.useBase.title": dict(
    "Compare against {branch}",
    "Comparar com {branch}",
    "Comparar contra {branch}",
  ),
  "openPrBaseChoiceModal.useBase.body": dict(
    "Opens the compare/PR page against the actual branch this task started from — the accurate diff.",
    "Abre a página de comparação/PR contra a branch que esta tarefa realmente usou como base — o diff correto.",
    "Abre la página de comparación/PR contra la rama que esta tarea realmente usó como base — el diff correcto.",
  ),
  "openPrBaseChoiceModal.useBase.button": dict(
    "Compare with {branch}",
    "Comparar com {branch}",
    "Comparar con {branch}",
  ),
  "openPrBaseChoiceModal.useDefault.title": dict(
    "Compare against the repo's default",
    "Comparar com a branch padrão do repositório",
    "Comparar contra la rama predeterminada del repositorio",
  ),
  "openPrBaseChoiceModal.useDefault.body": dict(
    "Opens the compare/PR page against the repo's usual default branch (main/master) instead.",
    "Abre a página de comparação/PR contra a branch padrão do repositório (main/master).",
    "Abre la página de comparación/PR contra la rama predeterminada del repositorio (main/master).",
  ),
  "openPrBaseChoiceModal.useDefault.button": dict(
    "Compare with default",
    "Comparar com a padrão",
    "Comparar con la predeterminada",
  ),
  "openPrBaseChoiceModal.cancel": dict("Cancel", "Cancelar", "Cancelar"),
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
  "cleanupModal.finding.abandonedWorktree.label": dict(
    "Abandoned worktree",
    "Worktree abandonado",
    "Worktree abandonado",
  ),
  "cleanupModal.finding.abandonedWorktree.body": dict(
    "(created by Claude/\"New task\" under .claude/worktrees/ but never used by any session) with no pending changes and no commit of its own — removing it loses nothing.",
    "(criado pelo Claude/\"Nova tarefa\" em .claude/worktrees/ mas nunca usado por nenhuma sessão) sem mudanças pendentes e sem nenhum commit próprio — removê-lo não perde nada.",
    "(creado por Claude/\"Nueva tarea\" en .claude/worktrees/ pero nunca usado por ninguna sesión) sin cambios pendientes ni commits propios — eliminarlo no pierde nada.",
  ),
  "cleanupModal.finding.oldSessions.label": dict(
    "Old local sessions",
    "Sessões locais antigas",
    "Sesiones locales antiguas",
  ),
  "cleanupModal.finding.oldSessions.body": dict(
    "once a project has more sessions than the configured limit (5 by default — edit " +
      '"keepRecentSessionsPerProject" in userPreferences.json to change it), the oldest ones ' +
      "can be deleted to free disk space and speed up the session list. The active session is never " +
      "suggested.",
    'quando um projeto tem mais sessões do que o limite configurado (5 por padrão — edite ' +
      '"keepRecentSessionsPerProject" no userPreferences.json para mudar isso), as mais antigas ' +
      "podem ser excluídas para liberar espaço em disco e acelerar a listagem de sessões. A " +
      "sessão ativa nunca é sugerida.",
    'cuando un proyecto tiene más sesiones que el límite configurado (5 por defecto — edita ' +
      '"keepRecentSessionsPerProject" en userPreferences.json para cambiarlo), las más antiguas ' +
      "se pueden eliminar para liberar espacio en disco y acelerar el listado de sesiones. La " +
      "sesión activa nunca se sugiere.",
  ),
  "cleanupModal.finding.oldSessions.title": dict(
    '{count} old session(s) in "{project}"',
    '{count} sessão(ões) antiga(s) em "{project}"',
    '{count} sesión(es) antigua(s) en "{project}"',
  ),
  "cleanupModal.finding.oldSessions.description": dict(
    "Keeping the {keep} most recently updated session(s) in this project. These {count} older " +
      "session(s) can be deleted, freeing about {freed}.",
    "Mantendo a(s) {keep} sessão(ões) mais recente(s) deste projeto. Estas {count} sessão(ões) " +
      "mais antiga(s) podem ser excluídas, liberando cerca de {freed}.",
    "Manteniendo la(s) {keep} sesión(es) más reciente(s) de este proyecto. Estas {count} " +
      "sesión(es) más antigua(s) se pueden eliminar, liberando aproximadamente {freed}.",
  ),
  "cleanupModal.finding.oldSessions.warning": dict(
    "This permanently deletes the session transcript(s) listed below. This cannot be undone.",
    "Isso exclui permanentemente a(s) transcrição(ões) de sessão listada(s) abaixo. Isso não pode ser desfeito.",
    "Esto elimina permanentemente la(s) transcripción(es) de sesión que se muestran abajo. Esto no se puede deshacer.",
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
  "cleanupModal.finding.abandoned.title": dict(
    'Abandoned worktree "{branch}" in "{project}"',
    'Worktree abandonado "{branch}" em "{project}"',
    'Worktree abandonado "{branch}" en "{project}"',
  ),
  "cleanupModal.finding.abandoned.description": dict(
    'No session ever ran in this worktree, it has no pending changes, and branch "{branch}" has no commit that isn\'t on another branch, remote or tag. The worktree and local branch can be safely removed.',
    'Nenhuma sessão rodou neste worktree, ele não tem alterações pendentes e a branch "{branch}" não tem nenhum commit que já não esteja em outra branch, no remoto ou numa tag. O worktree e a branch local podem ser removidos com segurança.',
    'Ninguna sesión se ejecutó en este worktree, no tiene cambios pendientes y la rama "{branch}" no tiene ningún commit que no esté en otra rama, en el remoto o en una tag. El worktree y la rama local se pueden eliminar de forma segura.',
  ),
  "apiError.cleanupBranchHasCommits": dict(
    "That branch now has commits of its own — cancelled for safety.",
    "Essa branch agora tem commits próprios — cancelado por segurança.",
    "Esa rama ahora tiene commits propios — cancelado por seguridad.",
  ),
  "apiError.cleanupWorktreeHasSession": dict(
    "A session now exists in that worktree — cancelled for safety.",
    "Agora existe uma sessão nesse worktree — cancelado por segurança.",
    "Ahora existe una sesión en ese worktree — cancelado por seguridad.",
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
  "newTaskModal.taskPrefix": dict("Task", "Tarefa", "Tarea"),
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
  "newTaskModal.recentProjectsGroup": dict("Recent", "Recentes", "Recientes"),
  "newTaskModal.workspaceProjectsGroup": dict(
    "Other repos (from your folders)",
    "Outros repositórios (das suas pastas)",
    "Otros repositorios (de tus carpetas)",
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
  "newTaskModal.baseBranchLabel": dict("Base branch", "Branch base", "Rama base"),
  "newTaskModal.useLocalBaseBranchLabel": dict(
    "Use the local branch instead of fetching the latest from the remote.",
    "Usar a branch local em vez de buscar a mais recente do remoto.",
    "Usar la rama local en lugar de obtener la más reciente del remoto.",
  ),
  "newTaskModal.branchTypeLabel": dict("Branch type", "Tipo de branch", "Tipo de rama"),
  "newTaskModal.otherBranchType": dict("Other", "Outro", "Otro"),
  "newTaskModal.customPrefixPlaceholder": dict(
    "custom prefix",
    "prefixo personalizado",
    "prefijo personalizado",
  ),
  "newTaskModal.branchNameLabel": dict("Branch name", "Nome da branch", "Nombre de la rama"),
  "newTaskModal.branchPreview": dict("Preview:", "Pré-visualização:", "Vista previa:"),
  "newTaskModal.useWorktreeLabel": dict(
    "Use an isolated worktree — instead of switching the branch directly in the project folder.",
    "Usar um worktree isolado — em vez de trocar a branch diretamente na pasta do projeto.",
    "Usar un worktree aislado — en vez de cambiar la rama directamente en la carpeta del proyecto.",
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
  "newTaskModal.noWorktreeWarning": dict(
    "Without a worktree, the new branch is switched directly in the project's main folder — this can cause conflicts if another terminal or session is already active there.",
    "Sem um worktree, a nova branch é trocada diretamente na pasta principal do projeto — isso pode causar conflitos se outro terminal ou sessão já estiver ativo ali.",
    "Sin un worktree, la nueva rama se cambia directamente en la carpeta principal del proyecto — esto puede causar conflictos si otra terminal o sesión ya está activa ahí.",
  ),
  "newTaskModal.worktreeAutoExplanation": dict(
    "We only suggest an isolated worktree when this project's main folder already has an active session — otherwise the branch is switched directly there, which is simpler and doesn't leave an extra folder behind. You can always override this checkbox by hand.",
    "Só sugerimos um worktree isolado quando a pasta principal deste projeto já tem uma sessão ativa — caso contrário, a branch é trocada diretamente ali, o que é mais simples e não deixa uma pasta extra para trás. Você sempre pode sobrescrever essa opção manualmente.",
    "Solo sugerimos un worktree aislado cuando la carpeta principal de este proyecto ya tiene una sesión activa — de lo contrario, la rama se cambia directamente ahí, lo cual es más simple y no deja una carpeta extra. Siempre puedes anular esta opción manualmente.",
  ),
  "newTaskModal.checkingActiveSession": dict(
    "Checking whether this project already has an active session…",
    "Verificando se este projeto já tem uma sessão ativa…",
    "Verificando si este proyecto ya tiene una sesión activa…",
  ),
  "newTaskModal.activeSessionDetected": dict(
    "Active session detected in this project's main folder — suggesting an isolated worktree so this new task doesn't interfere with it.",
    "Sessão ativa detectada na pasta principal deste projeto — sugerindo um worktree isolado para essa nova tarefa não interferir nela.",
    "Sesión activa detectada en la carpeta principal de este proyecto — sugiriendo un worktree aislado para que esta nueva tarea no interfiera con ella.",
  ),
  "newTaskModal.noActiveSessionDetected": dict(
    "No active session detected in this project's main folder, so a worktree isn't needed.",
    "Nenhuma sessão ativa detectada na pasta principal deste projeto, então um worktree não é necessário.",
    "No se detectó ninguna sesión activa en la carpeta principal de este proyecto, así que no hace falta un worktree.",
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
  "newTaskModal.explain.base.pre.remote": dict(
    "Fetches the latest version of the base branch",
    "Busca a versão mais recente da branch base",
    "Obtiene la última versión de la rama base",
  ),
  "newTaskModal.explain.base.pre.local": dict(
    "Uses the local base branch",
    "Usa a branch base local",
    "Usa la rama base local",
  ),
  "newTaskModal.explain.basePlaceholder": dict("(base branch)", "(branch base)", "(rama base)"),
  "newTaskModal.explain.base.post.remote": dict(
    "directly from the remote — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "diretamente do remoto — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
    "directamente desde el remoto — sin hacer checkout ni tocar la carpeta principal del proyecto (no afecta ninguna sesión ya activa ahí).",
  ),
  "newTaskModal.explain.base.post.local": dict(
    "as-is, without fetching from the remote first — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "como está, sem buscar do remoto primeiro — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
    "tal cual, sin obtenerla del remoto primero — sin hacer checkout ni tocar la carpeta principal del proyecto (no afecta ninguna sesión ya activa ahí).",
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

  "newSessionModal.title": dict("New session", "Nova sessão", "Nueva sesión"),
  "newSessionModal.intro": dict(
    "Starts Claude straight in the project's folder, on whatever branch it's on — no Jira link, branch or worktree.",
    "Inicia o Claude direto na pasta do projeto, na branch em que ela estiver — sem link do Jira, branch nem worktree.",
    "Inicia Claude directamente en la carpeta del proyecto, en la rama en que esté — sin enlace de Jira, rama ni worktree.",
  ),
  "newSessionModal.confirm": dict(
    "Start session",
    "Iniciar sessão",
    "Iniciar sesión",
  ),
  "newSessionModal.promptPlaceholder": dict(
    "Instructions for Claude (optional — leave blank to just open Claude)…",
    "Instruções para o Claude (opcional — deixe em branco para só abrir o Claude)…",
    "Instrucciones para Claude (opcional — déjalo en blanco para solo abrir Claude)…",
  ),
  "newSessionModal.launchFailed": dict(
    "Failed to start the session: {message}",
    "Falha ao iniciar a sessão: {message}",
    "No se pudo iniciar la sesión: {message}",
  ),
  "newSessionModal.activeSessionTitle": dict(
    "There's already a session in this repository",
    "Já existe uma sessão neste repositório",
    "Ya hay una sesión en este repositorio",
  ),
  "newSessionModal.activeSessionMessage": dict(
    "A Claude session is already running in {folder}. Both sessions will work on the same files and branch at the same time. Start anyway?",
    "Já há uma sessão do Claude rodando em {folder}. As duas sessões vão mexer nos mesmos arquivos e na mesma branch ao mesmo tempo. Iniciar mesmo assim?",
    "Ya hay una sesión de Claude en ejecución en {folder}. Ambas sesiones trabajarán sobre los mismos archivos y la misma rama al mismo tiempo. ¿Iniciar de todos modos?",
  ),
  "newSessionModal.activeSessionConfirm": dict(
    "Start anyway",
    "Iniciar mesmo assim",
    "Iniciar de todos modos",
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
  "useSessions.openingCursor": dict(
    "Opening in Cursor…",
    "Abrindo no Cursor…",
    "Abriendo en Cursor…",
  ),
  "useSessions.openCursorError": dict(
    "Could not open Cursor.",
    "Não foi possível abrir o Cursor.",
    "No se pudo abrir Cursor.",
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
  "useUpdate.timeoutError": dict(
    "Timed out waiting for the update to finish.",
    "Tempo esgotado esperando a atualização terminar.",
    "Se agotó el tiempo esperando que la actualización terminara.",
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
    "Updating — fetching the latest version and installing dependencies…",
    "Atualizando — buscando a versão mais recente e instalando dependências…",
    "Actualizando — obteniendo la última versión e instalando dependencias…",
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
  "updateOverlay.title": dict(
    "Updating the app…",
    "Atualizando o aplicativo…",
    "Actualizando la aplicación…",
  ),
  "updateOverlay.subtitle": dict(
    "A new version was found and is being installed automatically. This should only take a moment — please don't close this window.",
    "Uma nova versão foi encontrada e está sendo instalada automaticamente. Isso deve levar só um instante — não feche esta janela.",
    "Se encontró una nueva versión y se está instalando automáticamente. Esto debería tardar solo un instante — no cierres esta ventana.",
  ),
  "updateOverlay.errorTitle": dict(
    "Automatic update failed",
    "Falha na atualização automática",
    "Falló la actualización automática",
  ),
  "updateOverlay.dismiss": dict(
    "Continue anyway",
    "Continuar mesmo assim",
    "Continuar de todos modos",
  ),
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
    "No usage recorded yet — use Claude a bit, then click to refresh.",
    "Nenhum uso registrado ainda — use o Claude um pouco e depois clique para atualizar.",
    "Todavía no hay uso registrado — usa Claude un poco y luego haz clic para actualizar.",
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



  "settings.jenkinsBaseUrl.title": dict(
    "Jenkins base URL",
    "URL base do Jenkins",
    "URL base de Jenkins",
  ),
  "settings.jenkinsBaseUrl.description": dict(
    "Your team's Jenkins, used by the Jenkins button on session cards. Empty = button hidden.",
    "O Jenkins do seu time, usado pelo botão do Jenkins nos cards de sessão. Vazio = botão escondido.",
    "El Jenkins de tu equipo, usado por el botón de Jenkins en las tarjetas de sesión. Vacío = botón oculto.",
  ),
  "settings.envPreviews.title": dict(
    "env/* preview links",
    "Links de preview de env/*",
    "Links de preview de env/*",
  ),
  "settings.envPreviews.description": dict(
    "Preview sites an env/* branch deploys, per project folder name, shown in the Jenkins modal. JSON: { \"<project>\": [{ \"label\": \"BR\", \"url\": \"http://{env}.example.com/\" }] } — {env} becomes the branch slug (env/PROJ-1 → env-proj-1).",
    "Sites de preview que uma branch env/* publica, por nome da pasta do projeto, mostrados no modal do Jenkins. JSON: { \"<projeto>\": [{ \"label\": \"BR\", \"url\": \"http://{env}.example.com/\" }] } — {env} vira o slug da branch (env/PROJ-1 → env-proj-1).",
    "Sitios de preview que publica una rama env/*, por nombre de carpeta del proyecto, mostrados en el modal de Jenkins. JSON: { \"<proyecto>\": [{ \"label\": \"BR\", \"url\": \"http://{env}.example.com/\" }] } — {env} se convierte en el slug de la rama (env/PROJ-1 → env-proj-1).",
  ),
  "settings.envPreviews.preview": dict(
    "{count} project(s): {projects}",
    "{count} projeto(s): {projects}",
    "{count} proyecto(s): {projects}",
  ),
  "settings.envPreviews.invalid": dict(
    "Invalid JSON or shape — expected an object of { label, url } lists.",
    "JSON ou formato inválido — esperado um objeto de listas { label, url }.",
    "JSON o formato inválido — se espera un objeto de listas { label, url }.",
  ),
  "settings.preview.notUsed": dict(
    "not used",
    "não usado",
    "no usado",
  ),
  "settings.skillsHub.noRepo": dict(
    "repo not configured",
    "repo não configurado",
    "repo no configurado",
  ),
  "settings.skillsHub.title": dict(
    "Team skills",
    "Skills do time",
    "Skills del equipo",
  ),
  "settings.skillsHub.description": dict(
    "Your team's shared Claude skills: for each skill you select in the repo, the app creates a shortcut (symlink) to it in {dir}, where Claude loads skills from. Updated by \"Update now\" and, if enabled, when the app starts.",
    "Skills do Claude compartilhadas pelo time: pra cada skill que você seleciona no repo, o app cria um atalho (link simbólico) dela em {dir}, que é de onde o Claude carrega as skills. Atualizadas pelo \"Atualizar agora\" e, se ligado, ao iniciar o app.",
    "Skills de Claude compartidas por el equipo: por cada skill que seleccionas en el repo, la app crea un acceso directo (enlace simbólico) en {dir}, de donde Claude carga las skills. Se actualizan con \"Actualizar ahora\" y, si está activado, al iniciar la app.",
  ),
  "settings.skillsHub.manage": dict(
    "Manage",
    "Gerenciar",
    "Gestionar",
  ),
  "settings.skillsHubAutoUpdate.title": dict(
    "Update team skills on start",
    "Atualizar skills do time ao iniciar",
    "Actualizar skills del equipo al iniciar",
  ),
  "settings.skillsHubAutoUpdate.description": dict(
    "Every time the app starts, updates the skills clone in the background (only a fast-forward when it's clean — never forces anything) and links new skills.",
    "Toda vez que o app inicia, atualiza o clone de skills em background (só fast-forward quando está limpo — nunca força nada) e linka as skills novas.",
    "Cada vez que la app inicia, actualiza el clon de skills en segundo plano (solo fast-forward cuando está limpio — nunca fuerza nada) y enlaza las skills nuevas.",
  ),
  "settings.skillsHub.setup": dict(
    "Set up",
    "Configurar",
    "Configurar",
  ),
  "settings.skillsHub.repoUrlTitle": dict(
    "Team skills repo",
    "Repo das skills do time",
    "Repo de skills del equipo",
  ),
  "settings.skillsHub.repoUrlDescription": dict(
    "Where your team's skills repo comes from (git URL) and where its clone lives on this machine. Leave the git URL empty if your team doesn't use one.",
    "De onde vem o repo de skills do time (URL git) e onde o clone dele fica nesta máquina. Deixe a URL git vazia se o seu time não usa.",
    "De dónde viene el repo de skills del equipo (URL git) y dónde está su clon en esta máquina. Deja la URL git vacía si tu equipo no usa uno.",
  ),
  "settings.skillsHub.repoUrlLabel": dict(
    "Git URL (the one you'd pass to git clone)",
    "URL git (a mesma que você passaria pro git clone)",
    "URL git (la misma que pasarías a git clone)",
  ),
  "settings.skillsHub.pathLabel": dict(
    "Local clone folder",
    "Pasta do clone nesta máquina",
    "Carpeta del clon en esta máquina",
  ),
  "settings.skillsHub.pathHint": dict(
    "Empty = found automatically in your repos folder. It must be a clone of the repo above.",
    "Vazio = encontrado automaticamente na sua pasta de repositórios. Precisa ser um clone do repo acima.",
    "Vacío = se encuentra automáticamente en tu carpeta de repositorios. Debe ser un clon del repo de arriba.",
  ),
  "settings.skillsHub.pathDetected": dict(
    "Empty = auto-detect (currently found at {path}). It must be a clone of the repo above.",
    "Vazio = detectar automaticamente (encontrado agora em {path}). Precisa ser um clone do repo acima.",
    "Vacío = detectar automáticamente (encontrado ahora en {path}). Debe ser un clon del repo de arriba.",
  ),
  "settings.skillsHub.noCatalogs": dict(
    "no catalogs chosen",
    "nenhum catálogo escolhido",
    "ningún catálogo elegido",
  ),
  "settings.skillsHub.notInstalled": dict(
    "not installed",
    "não instalado",
    "no instalado",
  ),
  "skillsHub.manage.openFolder": dict(
    "Open skills in file manager",
    "Abrir skills no explorador",
    "Abrir skills en el explorador",
  ),
  "skillsHub.manage.openHub": dict(
    "Team skills repo (git clone)",
    "Repo de skills do time (clone git)",
    "Repo de skills del equipo (clon git)",
  ),
  "skillsHub.manage.openUserSkills": dict(
    "This machine's skills folder (where they're linked)",
    "Pasta de skills desta máquina (onde ficam linkadas)",
    "Carpeta de skills de esta máquina (donde quedan enlazadas)",
  ),
  "skillsHub.manage.openFolderError": dict(
    "Couldn't open the folder.",
    "Não deu pra abrir a pasta.",
    "No se pudo abrir la carpeta.",
  ),
  "skillsHub.autoDetect": dict(
    "Auto-detect",
    "Detectar automaticamente",
    "Detectar automáticamente",
  ),
  "skillsHub.catalogsApplied": dict(
    "Selection applied: {linked} linked, {unlinked} removed.",
    "Seleção aplicada: {linked} linkadas, {unlinked} removidas.",
    "Selección aplicada: {linked} enlazadas, {unlinked} eliminadas.",
  ),
  "skillsHub.catalogsApplyError": dict(
    "Couldn't apply the selection.",
    "Não foi possível aplicar a seleção.",
    "No se pudo aplicar la selección.",
  ),
  "skillsHub.cloned": dict(
    "Skills hub cloned. Now choose your catalogs.",
    "Hub de skills clonado. Agora escolha seus catálogos.",
    "Hub de skills clonado. Ahora elige tus catálogos.",
  ),
  "skillsHub.cloneError": dict(
    "Couldn't clone the skills hub.",
    "Não foi possível clonar o hub de skills.",
    "No se pudo clonar el hub de skills.",
  ),
  "skillsHub.configuredPathInvalid": dict(
    "The folder saved in the preferences isn't a clone of the skills hub anymore — clone it again or point to the right folder.",
    "A pasta salva nas preferências não é mais um clone do hub de skills — clone de novo ou aponte a pasta certa.",
    "La carpeta guardada en las preferencias ya no es un clon del hub de skills — clónalo de nuevo o indica la carpeta correcta.",
  ),
  "skillsHub.copy": dict(
    "Copy",
    "Copiar",
    "Copiar",
  ),
  "skillsHub.copyFailed": dict(
    "Couldn't copy to the clipboard.",
    "Não foi possível copiar.",
    "No se pudo copiar.",
  ),
  "skillsHub.install.cloneButton": dict(
    "Clone into {target}",
    "Clonar em {target}",
    "Clonar en {target}",
  ),
  "skillsHub.install.cloneTitle": dict(
    "Clone it with one click",
    "Clone com um clique",
    "Clónalo con un clic",
  ),
  "skillsHub.install.existingTitle": dict(
    "Already have it cloned somewhere else?",
    "Já tem clonado em outra pasta?",
    "¿Ya lo tienes clonado en otra carpeta?",
  ),
  "skillsHub.install.manualBody": dict(
    "If the clone fails (e.g. no SSH key for the repo's host), run this in a terminal, then reopen this window:",
    "Se o clone falhar (ex.: sem chave SSH no host do repo), rode isto num terminal e depois reabra esta janela:",
    "Si el clon falla (p. ej. sin clave SSH en el host del repo), ejecuta esto en una terminal y luego vuelve a abrir esta ventana:",
  ),
  "skillsHub.install.manualTitle": dict(
    "Or clone it by hand",
    "Ou clone na mão",
    "O clónalo a mano",
  ),
  "skillsHub.install.openRepo": dict(
    "Open the repo in the browser",
    "Abrir o repo no navegador",
    "Abrir el repo en el navegador",
  ),
  "skillsHub.install.sshNote": dict(
    "Uses your own access (SSH key) to the repo's host.",
    "Usa o seu próprio acesso (chave SSH) ao host do repo.",
    "Usa tu propio acceso (clave SSH) al host del repo.",
  ),
  "skillsHub.invite.body": dict(
    "The skills repo is where your team keeps reusable Claude skills. Once it's cloned, you pick which skills to use and the app creates a shortcut (symlink) for each selected skill from the repo into {dir} — so every Claude session on this machine can use them.",
    "O repo de skills é onde o seu time guarda skills reutilizáveis do Claude. Depois de clonado, você escolhe quais skills usar e o app cria um atalho (link simbólico) de cada skill selecionada do repo para {dir} — assim toda sessão do Claude nesta máquina pode usá-las.",
    "El repo de skills es donde tu equipo guarda skills reutilizables de Claude. Una vez clonado, eliges qué skills usar y la app crea un acceso directo (enlace simbólico) de cada skill seleccionada del repo en {dir} — así toda sesión de Claude en esta máquina puede usarlas.",
  ),
  "skillsHub.invite.optional": dict(
    "Optional — tasks work the same without it.",
    "Opcional — as tarefas funcionam igual sem ele.",
    "Opcional — las tareas funcionan igual sin él.",
  ),
  "skillsHub.invite.title": dict(
    "Use the team's Claude skills",
    "Use as skills do Claude do time",
    "Usa las skills de Claude del equipo",
  ),
  "skillsHub.loadError": dict(
    "Couldn't read the skills status.",
    "Não foi possível ler o status das skills.",
    "No se pudo leer el estado de las skills.",
  ),
  "skillsHub.loading": dict(
    "Checking the skills hub…",
    "Verificando o hub de skills…",
    "Verificando el hub de skills…",
  ),
  "skillsHub.manage.ahead": dict(
    "{count} local commit(s) not pushed",
    "{count} commit(s) local(is) sem push",
    "{count} commit(s) local(es) sin push",
  ),
  "skillsHub.manage.applyCatalogs": dict(
    "Apply",
    "Aplicar",
    "Aplicar",
  ),
  "skillsHub.manage.behind": dict(
    "{count} commit(s) behind",
    "{count} commit(s) atrás",
    "{count} commit(s) atrás",
  ),
  "skillsHub.manage.branch": dict(
    "Branch:",
    "Branch:",
    "Rama:",
  ),
  "skillsHub.manage.catalogsHelp": dict(
    "Check a catalog to take all of it (skills added to it later included), or click individual skills to pick just those. Everything picked is linked into {dir} and works in any repo/worktree.",
    "Marque um catálogo pra levar ele inteiro (incluindo skills adicionadas depois), ou clique em skills soltas pra pegar só elas. Tudo o que estiver marcado é linkado em {dir} e vale em qualquer repo/worktree.",
    "Marca un catálogo para llevarlo completo (incluidas las skills que se agreguen después), o haz clic en skills sueltas para tomar solo esas. Todo lo marcado se enlaza en {dir} y vale en cualquier repo/worktree.",
  ),
  "skillsHub.manage.catalogsInferred": dict(
    "Preselected from the skills you already have linked — click Apply to confirm.",
    "Pré-selecionado a partir das skills que você já tem linkadas — clique em Aplicar para confirmar.",
    "Preseleccionado a partir de las skills que ya tienes enlazadas — haz clic en Aplicar para confirmar.",
  ),
  "skillsHub.manage.catalogsNone": dict(
    "Check whole catalogs or click individual skills. Nothing is linked until you apply.",
    "Marque catálogos inteiros ou clique em skills soltas. Nada é linkado até você aplicar.",
    "Marca catálogos completos o haz clic en skills sueltas. Nada se enlaza hasta que apliques.",
  ),
  "skillsHub.manage.catalogsTitle": dict(
    "Catalogs and skills",
    "Catálogos e skills",
    "Catálogos y skills",
  ),
  "skillsHub.manage.changePath": dict(
    "Change folder",
    "Trocar pasta",
    "Cambiar carpeta",
  ),
  "skillsHub.manage.changePathHint": dict(
    "The repo and the clone folder are changed in one place: the gear (Settings) in the header → \"Team skills\" → Edit.",
    "O repo e a pasta do clone são trocados num lugar só: na engrenagem (Configurações) do header → \"Skills do time\" → Editar.",
    "El repo y la carpeta del clon se cambian en un solo lugar: el engranaje (Configuración) del header → \"Skills del equipo\" → Editar.",
  ),
  "skillsHub.manage.detached": dict(
    "(detached)",
    "(detached)",
    "(detached)",
  ),
  "skillsHub.manage.dirty": dict(
    "local changes",
    "mudanças locais",
    "cambios locales",
  ),
  "skillsHub.manage.duplicates": dict(
    "Same skill name in more than one checked catalog: {names} — only the first catalog's is linked.",
    "Mesmo nome de skill em mais de um catálogo marcado: {names} — só a do primeiro catálogo é linkada.",
    "Mismo nombre de skill en más de un catálogo marcado: {names} — solo se enlaza la del primer catálogo.",
  ),
  "skillsHub.manage.intro": dict(
    "For each skill selected below, the app creates a shortcut (symlink) from its folder in the skills repo to {dir}, which is where Claude looks for skills. Nothing is copied: updating the repo updates the linked skills too. The clone is never reset or forced — only fetch + fast-forward when it's clean.",
    "Pra cada skill selecionada abaixo, o app cria um atalho (link simbólico) da pasta dela no repo de skills para {dir}, que é onde o Claude procura as skills. Nada é copiado: atualizar o repo já atualiza as skills linkadas. O clone nunca é resetado nem forçado — só fetch + fast-forward quando está limpo.",
    "Por cada skill seleccionada abajo, la app crea un acceso directo (enlace simbólico) de su carpeta en el repo de skills a {dir}, que es donde Claude busca las skills. No se copia nada: actualizar el repo actualiza las skills enlazadas. El clon nunca se resetea ni se fuerza — solo fetch + fast-forward cuando está limpio.",
  ),
  "skillsHub.manage.newSessionsNote": dict(
    "Claude loads skills when a session starts — sessions already open only see new skills after a restart.",
    "O Claude carrega as skills quando a sessão começa — sessões já abertas só veem skills novas depois de reiniciar.",
    "Claude carga las skills al iniciar la sesión — las sesiones ya abiertas solo ven skills nuevas tras reiniciar.",
  ),
  "skillsHub.manage.notDefaultBranch": dict(
    "The clone is not on {defaultBranch}: you get this branch's skills, and updates follow its own upstream.",
    "O clone não está na {defaultBranch}: você usa as skills desta branch, e as atualizações seguem o upstream dela.",
    "El clon no está en {defaultBranch}: usas las skills de esta rama, y las actualizaciones siguen su propio upstream.",
  ),
  "skillsHub.manage.syncNow": dict(
    "Update now",
    "Atualizar agora",
    "Actualizar ahora",
  ),
  "skillsHub.modal.title": dict(
    "Team skills",
    "Skills do time",
    "Skills del equipo",
  ),
  "skillsHub.panel.choose": dict(
    "Choose",
    "Escolher",
    "Elegir",
  ),
  "skillsHub.panel.chooseCatalogs": dict(
    "Skills hub found — pick your team's catalog(s) or individual skills to use them in your tasks.",
    "Hub de skills encontrado — escolha catálogo(s) do seu time ou skills soltas pra usar nas tarefas.",
    "Hub de skills encontrado — elige catálogo(s) de tu equipo o skills sueltas para usarlas en tus tareas.",
  ),
  "skillsHub.panel.conflicts": dict(
    "{count} name conflict(s)",
    "{count} conflito(s) de nome",
    "{count} conflicto(s) de nombre",
  ),
  "skillsHub.panel.inviteShort": dict(
    "Clone your team's skills repo and pick which skills to use — the app creates a shortcut to each one in {dir}.",
    "Clone o repo de skills do time e escolha quais skills usar — o app cria um atalho de cada uma em {dir}.",
    "Clona el repo de skills del equipo y elige qué skills usar — la app crea un acceso directo de cada una en {dir}.",
  ),
  "skillsHub.panel.manage": dict(
    "Manage",
    "Gerenciar",
    "Gestionar",
  ),
  "skillsHub.panel.offDefault": dict(
    "hub on {branch}",
    "hub na {branch}",
    "hub en {branch}",
  ),
  "skillsHub.panel.pending": dict(
    "{count} new to link — update in Manage",
    "{count} nova(s) a linkar — atualize em Gerenciar",
    "{count} nueva(s) por enlazar — actualiza en Gestionar",
  ),
  "skillsHub.panel.setup": dict(
    "Set up",
    "Configurar",
    "Configurar",
  ),
  "skillsHub.panel.summary": dict(
    "Skills: {count} linked ({catalogs})",
    "Skills: {count} linkadas ({catalogs})",
    "Skills: {count} enlazadas ({catalogs})",
  ),
  "skillsHub.pathSaved": dict(
    "Skills hub folder saved.",
    "Pasta do hub de skills salva.",
    "Carpeta del hub de skills guardada.",
  ),
  "skillsHub.pathSaveError": dict(
    "Couldn't use that folder.",
    "Não foi possível usar essa pasta.",
    "No se pudo usar esa carpeta.",
  ),
  "skillsHub.state.broken": dict(
    "broken link",
    "link quebrado",
    "link roto",
  ),
  "skillsHub.state.conflict": dict(
    "conflict",
    "conflito",
    "conflicto",
  ),
  "skillsHub.state.linked": dict(
    "linked",
    "linkada",
    "enlazada",
  ),
  "skillsHub.state.missing": dict(
    "new",
    "nova",
    "nueva",
  ),
  "skillsHub.sync.conflicts": dict(
    "not linked (name already taken): {names}",
    "não linkadas (nome já usado): {names}",
    "no enlazadas (nombre ya usado): {names}",
  ),
  "skillsHub.syncError": dict(
    "Couldn't update the skills.",
    "Não foi possível atualizar as skills.",
    "No se pudieron actualizar las skills.",
  ),
  "skillsHub.sync.fetchFailed": dict(
    "couldn't reach the repo's host (offline or no SSH access) — using the local version",
    "sem acesso ao host do repo (offline ou sem SSH) — usando a versão local",
    "sin acceso al host del repo (offline o sin SSH) — usando la versión local",
  ),
  "skillsHub.sync.linked": dict(
    "linked: {names}",
    "linkadas: {names}",
    "enlazadas: {names}",
  ),
  "skillsHub.sync.pulled": dict(
    "updated (+{count} commit(s))",
    "atualizado (+{count} commit(s))",
    "actualizado (+{count} commit(s))",
  ),
  "skillsHub.sync.skippedDirty": dict(
    "update available but not applied: the clone has local changes",
    "atualização disponível mas não aplicada: o clone tem mudanças locais",
    "actualización disponible pero no aplicada: el clon tiene cambios locales",
  ),
  "skillsHub.sync.skippedDiverged": dict(
    "update available but not applied: the branch has local commits (diverged)",
    "atualização disponível mas não aplicada: a branch tem commits locais (divergiu)",
    "actualización disponible pero no aplicada: la rama tiene commits locales (divergió)",
  ),
  "skillsHub.sync.skippedFailed": dict(
    "update available but the fast-forward failed",
    "atualização disponível mas o fast-forward falhou",
    "actualización disponible pero el fast-forward falló",
  ),
  "skillsHub.sync.upToDate": dict(
    "already up to date",
    "já atualizado",
    "ya actualizado",
  ),
  "skillsHub.usePath": dict(
    "Use this folder",
    "Usar esta pasta",
    "Usar esta carpeta",
  ),
  "skillsHub.repoUrl.title": dict(
    "Skills hub repo",
    "Repo do hub de skills",
    "Repo del hub de skills",
  ),
  "skillsHub.repoUrl.body": dict(
    "Clone URL of your team's skills repo (a git repo with a catalog/ folder). Stored only in your local userPreferences.json.",
    "URL de clone do repo de skills do seu time (um repo git com uma pasta catalog/). Fica só no seu userPreferences.json local.",
    "URL de clonado del repo de skills de tu equipo (un repo git con una carpeta catalog/). Se guarda solo en tu userPreferences.json local.",
  ),
  "skillsHub.repoUrl.detected": dict(
    "Detected from your existing clone — save to confirm.",
    "Detectado do clone que você já tem — salve para confirmar.",
    "Detectado de tu clon existente — guarda para confirmar.",
  ),
  "skillsHub.repoUrl.save": dict(
    "Save",
    "Salvar",
    "Guardar",
  ),
  "skillsHub.repoUrl.saved": dict(
    "Skills hub repo saved.",
    "Repo do hub de skills salvo.",
    "Repo del hub de skills guardado.",
  ),
  "skillsHub.repoUrl.saveError": dict(
    "Couldn't save the repo URL.",
    "Não foi possível salvar a URL do repo.",
    "No se pudo guardar la URL del repo.",
  ),
  "apiError.skillsHubRepoUrlMissing": dict(
    "The skills hub repo URL isn't set.",
    "A URL do repo do hub de skills não está configurada.",
    "La URL del repo del hub de skills no está configurada.",
  ),
  "apiError.skillsFolderOpenFailed": dict(
    "Couldn't open the folder in the file manager (xdg-open not available?).",
    "Não deu pra abrir a pasta no explorador de arquivos (xdg-open indisponível?).",
    "No se pudo abrir la carpeta en el explorador de archivos (¿xdg-open no disponible?).",
  ),
  "apiError.skillsHubNotFound": dict(
    "Skills hub clone not found.",
    "Clone do hub de skills não encontrado.",
    "No se encontró el clon del hub de skills.",
  ),
  "apiError.skillsHubInvalidPath": dict(
    "That folder isn't a clone of the configured skills hub (needs a catalog/ folder and the configured repo as origin).",
    "Essa pasta não é um clone do hub de skills configurado (precisa ter a pasta catalog/ e o repo configurado como origin).",
    "Esa carpeta no es un clon del hub de skills configurado (necesita la carpeta catalog/ y el repo configurado como origin).",
  ),
  "apiError.skillsHubCloneParentMissing": dict(
    "The destination folder doesn't exist.",
    "A pasta de destino não existe.",
    "La carpeta de destino no existe.",
  ),
  "apiError.skillsHubCloneTargetExists": dict(
    "There's already a folder with that name there (and it isn't the hub).",
    "Já existe uma pasta com esse nome ali (e ela não é o hub).",
    "Ya existe una carpeta con ese nombre ahí (y no es el hub).",
  ),
  "apiError.skillsDirUnwritable": dict(
    "Couldn't create Claude's skills folder (~/.claude/skills).",
    "Não foi possível criar a pasta de skills do Claude (~/.claude/skills).",
    "No se pudo crear la carpeta de skills de Claude (~/.claude/skills).",
  ),
  "skillsHub.manage.syncHelp": dict(
    "\"Update now\" runs git fetch, fast-forwards the clone when it's clean, and creates shortcuts in {dir} for new skills. It also runs on its own when the app starts, if enabled in Settings.",
    "\"Atualizar agora\" roda git fetch, avança o clone (fast-forward) quando está limpo e cria os atalhos das skills novas em {dir}. Também roda sozinho quando o app inicia, se estiver ligado na Configuração.",
    "\"Actualizar ahora\" ejecuta git fetch, avanza el clon (fast-forward) cuando está limpio y crea en {dir} los accesos directos de las skills nuevas. También se ejecuta solo al iniciar la app, si está activado en Configuración.",
  ),
  "skillsHub.panel.behind": dict(
    "hub {count} commit(s) behind — update it in Manage",
    "hub {count} commit(s) atrás — atualize em Gerenciar",
    "hub {count} commit(s) atrás — actualízalo en Gestionar",
  ),
  "skillsHub.manage.wholeCatalog": dict(
    "whole catalog · {count} skill(s), new ones included",
    "catálogo inteiro · {count} skill(s), incluindo as novas",
    "catálogo completo · {count} skill(s), incluidas las nuevas",
  ),
  "skillsHub.manage.pickedCount": dict(
    "{picked} of {count} skill(s)",
    "{picked} de {count} skill(s)",
    "{picked} de {count} skill(s)",
  ),
  "skillsHub.preview.open": dict(
    "Show the content of {name}",
    "Ver o conteúdo de {name}",
    "Ver el contenido de {name}",
  ),
  "skillsHub.preview.noDescription": dict(
    "No description.",
    "Sem descrição.",
    "Sin descripción.",
  ),
  "skillsHub.preview.whenUsed": dict(
    "When Claude uses it",
    "Quando o Claude usa",
    "Cuándo la usa Claude",
  ),
  "skillsHub.preview.requires": dict(
    "Depends on:",
    "Depende de:",
    "Depende de:",
  ),
  "skillsHub.preview.files": dict(
    "Files that come with it",
    "Arquivos que vêm junto",
    "Archivos que vienen con ella",
  ),
  "skillsHub.preview.loadError": dict(
    "Couldn't read this skill.",
    "Não foi possível ler esta skill.",
    "No se pudo leer esta skill.",
  ),
  "apiError.skillNotFound": dict(
    "Skill not found in the skills hub (maybe removed by the last update).",
    "Skill não encontrada no hub de skills (talvez removida na última atualização).",
    "Skill no encontrada en el hub de skills (quizá eliminada en la última actualización).",
  ),
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
