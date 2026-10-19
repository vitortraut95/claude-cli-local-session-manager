import type { Language } from "../services/tasksApi";

export type { Language };

export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

/** Maps the browser's language to a supported one (English if unrecognized) — used while
 *  `UserPreferences.language` is null. */
export function detectBrowserLanguage(): Language {
  const candidates = navigator.languages ?? [navigator.language];
  for (const raw of candidates) {
    const prefix = raw.slice(0, 2).toLowerCase();
    if (prefix === "pt" || prefix === "en") return prefix;
  }
  return "en";
}

type Dict = Record<Language, string>;

function dict(en: string, pt: string): Dict {
  return { en, pt };
}

/** Every user-visible string in the app, per language. */
export const translations = {
  "header.subtitle": dict("Manage your local sessions", "Gerencie suas sessões locais"),
  "header.newTask": dict("New task", "Nova tarefa"),
  "header.skills": dict("Skills", "Skills"),
  "header.skills.active": dict(
    "{count} team skill(s) active on this machine",
    "{count} skill(s) do time ativa(s) nesta máquina",
  ),
  "header.skills.notConfigured": dict(
    "Team skills repo not configured — click to set it up",
    "Repo de skills do time não configurado — clique pra configurar",
  ),
  "header.skills.notInstalled": dict(
    "Team skills repo configured but not cloned on this machine — click to install",
    "Repo de skills do time configurado mas não clonado nesta máquina — clique pra instalar",
  ),
  "header.newSession": dict("New session", "Nova sessão"),
  "header.testTask": dict("Test task", "Testar tarefa"),
  "header.testTask.tooltip": dict(
    "Opens a terminal running the {skill} skill on a task's link",
    "Abre um terminal rodando a skill {skill} com o link de uma tarefa",
  ),
  "header.testTask.notInstalled": dict(
    "The test skill {skill} isn't installed on this machine — choose another one in Settings or in the Skills window",
    "A skill de teste {skill} não está instalada nesta máquina — escolha outra em Configurações ou na janela de Skills",
  ),
  "header.cleanup": dict("Cleanup", "Limpeza"),
  "header.importSession": dict("Import session", "Importar sessão"),
  "header.settings": dict("Settings", "Configurações"),
  "header.language": dict("Language", "Idioma"),

  "confirmDialog.confirm": dict("Confirm", "Confirmar"),
  "confirmDialog.cancel": dict("Cancel", "Cancelar"),

  // Server error codes (see resolveApiErrorMessage) — generic, since only the code is known.
  "apiError.sessionNotFound": dict("Session not found.", "Sessão não encontrada."),
  "apiError.sessionActive": dict(
    "This session (or its folder) is already open in another terminal.",
    "Esta sessão (ou a pasta dela) já está aberta em outro terminal.",
  ),
  "apiError.invalidSessionId": dict("Invalid session id.", "Id de sessão inválido."),
  "apiError.taskFolderRequired": dict(
    "A project folder is required.",
    "É necessário informar a pasta do projeto.",
  ),
  "apiError.taskFolderNotFound": dict("That folder doesn't exist.", "Essa pasta não existe."),
  "apiError.taskNotGitRepo": dict(
    "That folder isn't inside a git repository.",
    "Essa pasta não está dentro de um repositório git.",
  ),
  "apiError.taskBaseBranchRequired": dict(
    "A source branch is required.",
    "É necessário informar a branch de origem.",
  ),
  "apiError.taskBranchNameRequired": dict(
    "A branch name is required.",
    "É necessário informar o nome da branch.",
  ),
  "apiError.taskInvalidBranchName": dict(
    'Not a valid branch name (letters, numbers, "-", "_", "." and "/" only, must start with a ' +
      "letter or number).",
    'Nome de branch inválido (apenas letras, números, "-", "_", "." e "/", precisa começar com ' +
      "letra ou número).",
  ),
  "apiError.taskBaseBranchRefRequired": dict(
    "A resolved base branch is required.",
    "É necessário resolver a branch base primeiro.",
  ),
  "apiError.taskInvalidKey": dict(
    "That isn't a ticket key (e.g. PROJ-123) or a ticket link.",
    "Isso não é uma chave de ticket (ex.: PROJ-123) nem um link de ticket.",
  ),
  "apiError.taskRepoNotFound": dict(
    "That repo isn't part of this task.",
    "Esse repo não faz parte desta tarefa.",
  ),
  "apiError.taskBranchExists": dict("That branch already exists.", "Essa branch já existe."),
  "apiError.taskWorktreeExists": dict(
    "The worktree folder for this branch name is already in use — try a different branch name, or remove the worktree occupying it.",
    "A pasta de worktree para esse nome de branch já está em uso — tente outro nome de branch, ou remova o worktree que a está ocupando.",
  ),
  "apiError.taskWorktreePathRequired": dict(
    "A worktree path is required.",
    "É necessário informar o caminho do worktree.",
  ),
  "apiError.taskTestLinkRequired": dict("Paste the task's link.", "Cole o link da tarefa."),
  "apiError.taskTestSkillNotConfigured": dict(
    "No test skill is configured. Choose one in Settings or in the Skills window.",
    "Nenhuma skill de teste configurada. Escolha uma em Configurações ou na janela de Skills.",
  ),
  "apiError.taskTestSkillNotInstalled": dict(
    "The configured test skill isn't installed on this machine anymore. Choose another one or install it again.",
    "A skill de teste configurada não está mais instalada nesta máquina. Escolha outra ou instale de novo.",
  ),
  "apiError.malformedPreferences": dict(
    "Malformed preferences payload.",
    "Payload de preferências malformado.",
  ),
  "apiError.usageNoCredentials": dict(
    'Could not find Claude\'s login credentials — run "claude" and sign in first.',
    'Não foi possível encontrar as credenciais de login do Claude — rode "claude" e faça login primeiro.',
  ),
  "apiError.usageCredentialsUnreadable": dict(
    "Claude's credentials file is unreadable.",
    "O arquivo de credenciais do Claude está ilegível.",
  ),
  "apiError.usageNoToken": dict(
    'No Claude login token found — run "claude" and sign in first.',
    'Nenhum token de login do Claude encontrado — rode "claude" e faça login primeiro.',
  ),
  "apiError.usageEndpointUnreachable": dict(
    "Could not reach Anthropic's usage endpoint.",
    "Não foi possível acessar o endpoint de uso da Anthropic.",
  ),
  "apiError.usageTokenExpired": dict(
    'Claude\'s login token has expired — run "claude" once to refresh it.',
    'O token de login do Claude expirou — rode "claude" uma vez para renová-lo.',
  ),
  "apiError.usageFetchFailed": dict(
    "Could not fetch usage data.",
    "Não foi possível buscar os dados de uso.",
  ),
  "apiError.updateAlreadyRunning": dict(
    "An update is already in progress.",
    "Uma atualização já está em andamento.",
  ),
  "apiError.updateFetchFailed": dict(
    "Could not reach the remote repository.",
    "Não foi possível acessar o repositório remoto.",
  ),
  "apiError.updateUnexpectedGitOutput": dict(
    "Unexpected output while checking for updates.",
    "Saída inesperada ao verificar atualizações.",
  ),
  "apiError.updateGitPullFailed": dict(
    "Failed to pull the latest changes. If this keeps happening, open a terminal in the " +
      "project folder and run: git fetch origin && git reset --hard origin/main (this discards " +
      "any local changes in favor of the remote).",
    "Falha ao buscar as atualizações mais recentes. Se isso continuar acontecendo, abra um " +
      "terminal na pasta do projeto e rode: git fetch origin && git reset --hard origin/main " +
      "(isso descarta qualquer alteração local em favor do remoto).",
  ),
  "apiError.updateYarnInstallFailed": dict(
    "Failed to install dependencies.",
    "Falha ao instalar as dependências.",
  ),
  "apiError.cleanupMissingTarget": dict(
    "Missing worktree path or branch for this cleanup item.",
    "Faltam o caminho do worktree ou a branch para este item de limpeza.",
  ),
  "apiError.cleanupTargetGone": dict(
    "That folder no longer exists — refresh the list.",
    "Essa pasta não existe mais — atualize a lista.",
  ),
  "apiError.cleanupBranchNotMerged": dict(
    "That branch is no longer merged into the default branch — cancelled for safety.",
    "Essa branch não está mais mergeada na branch padrão — cancelado por segurança.",
  ),
  "apiError.cleanupUncommittedChanges": dict(
    "That folder now has uncommitted changes — cancelled for safety.",
    "Essa pasta agora tem alterações não commitadas — cancelado por segurança.",
  ),
  "apiError.malformedCleanupFinding": dict(
    "Malformed cleanup finding.",
    "Item de limpeza malformado.",
  ),
  "apiError.taskBaseBranchNotFound": dict(
    "That base branch wasn't found locally or on origin.",
    "Essa branch base não foi encontrada localmente nem no origin.",
  ),
  "apiError.notAGitWorktree": dict(
    "That folder is no longer a git worktree.",
    "Essa pasta não é mais um worktree do git.",
  ),
  "apiError.sessionNoWorkingDirectory": dict(
    "This session has no known working directory.",
    "Esta sessão não tem um diretório de trabalho conhecido.",
  ),
  "apiError.sessionDirectoryMissing": dict(
    "This session's original directory no longer exists. Recreate the folder (or a symlink) at " +
      "the old path to continue working with it.",
    "O diretório original desta sessão não existe mais. Recrie a pasta (ou um link simbólico) no " +
      "caminho antigo para continuar trabalhando com ela.",
  ),
  "apiError.directoryMissing": dict(
    "That directory no longer exists.",
    "Essa pasta não existe mais.",
  ),
  "apiError.vscodeCommandNotFound": dict(
    'Could not open VS Code — the "code" command wasn\'t found on PATH.',
    'Não foi possível abrir o VS Code — o comando "code" não foi encontrado no PATH.',
  ),
  "apiError.cursorCommandNotFound": dict(
    'Could not open Cursor — the "cursor" command wasn\'t found on PATH.',
    'Não foi possível abrir o Cursor — o comando "cursor" não foi encontrado no PATH.',
  ),
  "apiError.notAppWorktree": dict(
    "This session's directory doesn't look like one of this app's own worktrees.",
    "O diretório desta sessão não parece ser um worktree criado por este app.",
  ),
  "apiError.projectRootMissing": dict(
    "The project's root folder no longer exists either.",
    "A pasta raiz do projeto também não existe mais.",
  ),
  "apiError.terminalLaunchFailed": dict(
    "Could not open a terminal.",
    "Não foi possível abrir um terminal.",
  ),
  "apiError.worktreeNameRequired": dict(
    "A worktree name is required.",
    "É necessário informar o nome do worktree.",
  ),
  "apiError.notAWorktreeSession": dict(
    "This session isn't running in a git worktree.",
    "Esta sessão não está rodando em um worktree do git.",
  ),
  "apiError.protectedBranchDeleteForbidden": dict(
    "Refusing to delete that branch — it looks like the repo's primary branch.",
    "Não é possível excluir essa branch — ela parece ser a branch principal do repositório.",
  ),
  "apiError.repoRootUnresolved": dict(
    "Could not resolve the repo root for this session's directory.",
    "Não foi possível resolver a raiz do repositório para o diretório desta sessão.",
  ),
  "apiError.worktreeBranchUnknown": dict(
    "Could not determine the worktree's branch before removing it.",
    "Não foi possível determinar a branch do worktree antes de removê-lo.",
  ),
  "apiError.worktreeToRootCheckoutFailed": dict(
    "The worktree was removed, but checking out its branch in the root folder failed — the " +
      "branch's commits are safe, finish the checkout by hand from a terminal there.",
    "O worktree foi removido, mas o checkout da branch na pasta raiz falhou — os commits da " +
      "branch estão seguros, finalize o checkout manualmente por um terminal ali.",
  ),
  "apiError.importInvalidBundle": dict(
    "This file isn't a session exported by Claude Session Manager.",
    "Este arquivo não é uma sessão exportada pelo Claude Session Manager.",
  ),
  "apiError.importUnsupportedVersion": dict(
    "This session was exported by a newer version of the app — update it first.",
    "Esta sessão foi exportada por uma versão mais nova do app — atualize-o primeiro.",
  ),
  "apiError.importTargetRequired": dict(
    "Choose the folder to import the session into.",
    "Escolha a pasta para onde importar a sessão.",
  ),
  "apiError.importTargetMissing": dict(
    "That folder doesn't exist on this machine.",
    "Essa pasta não existe nesta máquina.",
  ),
  "apiError.importSessionExists": dict(
    "This session already exists here — choose whether to overwrite it or import a copy.",
    "Esta sessão já existe aqui — escolha entre sobrescrever ou importar uma cópia.",
  ),
  "apiError.importOverwriteActive": dict(
    "The local session is active in a terminal — close it before overwriting, or import a copy.",
    "A sessão local está ativa num terminal — feche-a antes de sobrescrever, ou importe uma cópia.",
  ),
  "apiError.importCheckoutBlockedActive": dict(
    "Another Claude session is active in that folder — close it before switching branches, or import without checking out.",
    "Outra sessão do Claude está ativa nessa pasta — feche-a antes de trocar de branch, ou importe sem fazer checkout.",
  ),
  "apiError.worktreeUncommittedChanges": dict(
    "That worktree still has uncommitted changes, so it wasn't removed — commit or discard them " +
      'first (or use "copy" mode instead, which doesn\'t require the worktree to be clean).',
    "Esse worktree ainda tem alterações não commitadas, então não foi removido — commite ou " +
      'descarte elas primeiro (ou use o modo "copiar", que não exige que o worktree esteja limpo).',
  ),

  "modal.closeAriaLabel": dict("Close", "Fechar"),
  "modal.confirmDefault": dict("Confirm", "Confirmar"),
  "modal.cancelDefault": dict("Cancel", "Cancelar"),

  "toast.closeAriaLabel": dict("Close notification", "Fechar notificação"),

  "nicknameModal.title": dict("Local nickname", "Apelido local"),
  "nicknameModal.save": dict("Save", "Salvar"),
  "nicknameModal.cancel": dict("Cancel", "Cancelar"),
  "nicknameModal.description": dict(
    "Only shown in this app's session list, alongside the session's real title — it won't rename the session or change what any terminal (including Warp) shows for it. Leave blank to remove the nickname.",
    "Aparece só na lista de sessões deste app, ao lado do título real da sessão — não renomeia a sessão nem muda o que qualquer terminal (incluindo o Warp) exibe para ela. Deixe em branco para remover o apelido.",
  ),
  "nicknameModal.placeholder": dict("Nickname", "Apelido"),

  "sessionBranchesModal.title": dict("Session branches", "Branches da sessão"),
  "sessionBranchesModal.description": dict(
    "Used by the Jenkins, preview and PR links. Saved only in this app — nothing is changed in git. Leave a field blank to go back to what the nickname or the session's transcript gives (shown in grey).",
    "Usadas nos links do Jenkins, das previews e do PR. Salvas só neste app — nada muda no git. Deixe um campo em branco para voltar ao que o apelido ou o histórico da sessão indica (mostrado em cinza).",
  ),
  "sessionBranchesModal.origin": dict(
    "Base (the branch the task was created from)",
    "Base (branch de onde a tarefa foi criada)",
  ),
  "sessionBranchesModal.destination": dict("Task branch", "Branch da tarefa"),
  "sessionBranchesModal.noFallback": dict("None", "Nenhuma"),

  "jenkinsLinksModal.title": dict("Jenkins", "Jenkins"),
  "jenkinsLinksModal.section.currentBranch": dict("Current branch", "Branch atual"),
  "jenkinsLinksModal.section.originBranch": dict("Branch it was created from", "Branch de origem"),
  "jenkinsLinksModal.section.envPreviews": dict("{branch} previews:", "Previews do {branch}:"),
  "jenkinsLinksModal.section.variants": dict(
    "Same ticket, other prefixes",
    "Mesmo ticket, outros prefixos",
  ),
  "jenkinsLinksModal.section.views": dict("Project", "Projeto"),
  "jenkinsLinksModal.project": dict("{project} (all branches)", "{project} (todas as branches)"),
  "jenkinsLinksModal.pullRequests": dict("Pull requests", "Pull requests"),
  "jenkinsLinksModal.tags": dict("Tags", "Tags"),

  "settings.title": dict("Settings", "Configurações"),
  "settings.intro": dict(
    "Everything this app remembers on this machine (userPreferences.json).",
    "Tudo o que este app guarda nesta máquina (userPreferences.json).",
  ),
  "settings.openFile": dict("Open file in VS Code", "Abrir arquivo no VS Code"),
  "settings.loading": dict("Loading settings…", "Carregando configurações…"),
  "settings.loadError": dict(
    "Could not load the settings.",
    "Não foi possível carregar as configurações.",
  ),
  "settings.saveError": dict(
    "Could not save the setting.",
    "Não foi possível salvar a configuração.",
  ),
  "settings.openFileError": dict(
    "Could not open the file in VS Code.",
    "Não foi possível abrir o arquivo no VS Code.",
  ),
  "settings.saved": dict("Setting saved.", "Configuração salva."),
  "settings.edit": dict("Edit", "Editar"),
  "settings.save": dict("Save", "Salvar"),
  "settings.cancel": dict("Cancel", "Cancelar"),
  "settings.preview.notSet": dict("Not set yet", "Ainda não configurado"),
  "settings.preview.emptyList": dict("(empty)", "(vazio)"),
  "settings.preview.emptyText": dict("(empty)", "(vazio)"),
  "settings.preview.text": dict("{firstLine} … ({lines} lines)", "{firstLine} … ({lines} linhas)"),
  "settings.list.add": dict("Add", "Adicionar"),
  "settings.list.remove": dict("Remove", "Remover"),
  "settings.list.moveUp": dict("Move up", "Mover para cima"),
  "settings.list.moveDown": dict("Move down", "Mover para baixo"),
  "settings.workspaceDirs.title": dict("Repository folders", "Pastas de repositórios"),
  "settings.workspaceDirs.description": dict(
    "Folders holding your repos (e.g. ~/git) — every repo directly inside them is known to the app, even ones you never used with Claude.",
    "Pastas onde ficam seus repos (ex.: ~/git) — todo repo direto dentro delas fica conhecido pelo app, mesmo os que você nunca usou com o Claude.",
  ),
  "settings.defaultPrompt.title": dict("Default prompt", "Prompt padrão"),
  "settings.defaultPrompt.description": dict(
    'Pre-filled instructions in the "New task" modal.',
    'Instruções que já vêm preenchidas no modal "Nova tarefa".',
  ),
  "settings.defaultSessionPrompt.title": dict("Default session prompt", "Prompt padrão de sessão"),
  "settings.defaultSessionPrompt.description": dict(
    'Pre-filled instructions in the "New session" modal.',
    'Instruções que já vêm preenchidas no modal "Nova sessão".',
  ),
  "settings.branchTypes.title": dict("Branch types", "Tipos de branch"),
  "settings.branchTypes.description": dict(
    'Options of the "New task" branch type select — the first one is the default.',
    'Opções do seletor de tipo de branch do "Nova tarefa" — a primeira é a padrão.',
  ),
  "settings.branchTypes.placeholder": dict("e.g. feature", "ex.: feature"),
  "settings.branchTypes.firstIsDefault": dict("default", "padrão"),
  "settings.recentProjectPaths.title": dict("Recent projects", "Projetos recentes"),
  "settings.recentProjectPaths.description": dict(
    'Repos used in "New task", most recent first — remove the ones that no longer exist.',
    'Repos usados no "Nova tarefa", mais recentes primeiro — remova os que não existem mais.',
  ),
  "settings.recentProjectPaths.placeholder": dict(
    "/absolute/path/to/repo",
    "/caminho/absoluto/do/repo",
  ),
  "settings.useWorktreeByDefault.title": dict(
    "Use a worktree by default",
    "Usar worktree por padrão",
  ),
  "settings.useWorktreeByDefault.description": dict(
    '"New task" fallback before a folder is chosen — once it is, the app suggests a worktree only if the repo root already has an active session.',
    'Padrão do "Nova tarefa" antes de escolher a pasta — depois de escolhida, o app sugere worktree só se a raiz do repo já tiver uma sessão ativa.',
  ),
  "settings.useAutoPermissionModeByDefault.title": dict(
    "Start tasks with --permission-mode auto",
    "Iniciar tarefas com --permission-mode auto",
  ),
  "settings.useAutoPermissionModeByDefault.description": dict(
    'Default state of that checkbox in "New task".',
    'Estado padrão dessa opção no "Nova tarefa".',
  ),
  "settings.keepRecentSessionsPerProject.title": dict(
    "Sessions kept by Cleanup",
    "Sessões mantidas pela Limpeza",
  ),
  "settings.keepRecentSessionsPerProject.description": dict(
    'How many of each project\'s most recent sessions the "old sessions" cleanup always keeps.',
    'Quantas das sessões mais recentes de cada projeto a limpeza de "sessões antigas" sempre mantém.',
  ),
  "settings.theme.title": dict("Theme", "Tema"),
  "settings.theme.description": dict(
    "Light or dark. Starts following the system until you pick one.",
    "Claro ou escuro. Segue o sistema até você escolher um.",
  ),

  "workspaceDirs.add": dict("Add", "Adicionar"),
  "workspaceDirs.remove": dict("Remove folder", "Remover pasta"),
  "workspaceDirs.empty": dict("No folder added yet.", "Nenhuma pasta adicionada ainda."),
  "workspaceDirs.placeholder": dict("/absolute/path or ~/folder", "/caminho/absoluto ou ~/pasta"),
  "workspaceDirs.loadingSuggestions": dict(
    "Looking for where your repos are…",
    "Procurando onde estão seus repos…",
  ),
  "workspaceDirs.suggestionsTitle": dict(
    "Suggestions, based on the repos you already use:",
    "Sugestões, com base nos repos que você já usa:",
  ),
  "workspaceDirs.status.repos": dict("{count} repo(s)", "{count} repo(s)"),
  "workspaceDirs.status.missing": dict("Folder doesn't exist", "Pasta não existe"),

  "setup.title": dict("Initial setup", "Configuração inicial"),
  "setup.intro": dict(
    "A few per-machine settings. Got a config file from your team? Import it — it fills everything it has.",
    "Algumas configurações desta máquina. Recebeu um arquivo de configuração do time? Importe — ele preenche tudo o que tiver.",
  ),
  "setup.workspaceDirs.label": dict("Where are your repos?", "Onde ficam seus repositórios?"),
  "setup.workspaceDirs.hint": dict(
    "The folder(s) where you keep your repos — the app uses them to know every project you work on.",
    "A(s) pasta(s) onde você guarda seus repos — o app usa isso para conhecer todos os seus projetos.",
  ),
  "setup.jenkins.label": dict("Jenkins base URL", "URL base do Jenkins"),
  "setup.jenkins.hint": dict(
    "Enables the Jenkins button on session cards. Leave empty if your team doesn't use Jenkins.",
    "Habilita o botão do Jenkins nos cards de sessão. Deixe vazio se o seu time não usa Jenkins.",
  ),
  "setup.skillsHub.label": dict(
    "Team skills repo (clone URL)",
    "Repo de skills do time (URL de clone)",
  ),
  "setup.skillsHub.hint": dict(
    "A git repo with a catalog/ folder of Claude skills, e.g. git@host:team/skills-repo.git. Leave empty if there's none.",
    "Um repo git com uma pasta catalog/ de skills do Claude, ex.: git@host:time/repo-de-skills.git. Deixe vazio se não houver.",
  ),
  "setup.laterHint": dict(
    "You can change all of this later in Settings (gear icon in the header).",
    "Dá para mudar tudo isso depois em Configurações (ícone de engrenagem no header).",
  ),
  "setup.save": dict("Save", "Salvar"),
  "setup.skip": dict("Not now", "Agora não"),
  "setup.saved": dict("Settings saved.", "Configurações salvas."),
  "preferencesFile.import": dict("Import settings", "Importar configurações"),
  "preferencesFile.export": dict("Export settings", "Exportar configurações"),
  "preferencesFile.confirmTitle": dict("Replace settings?", "Substituir configurações?"),
  "preferencesFile.confirmMessage": dict(
    "Every setting is replaced by the file's. Anything the file doesn't have goes back to its default.",
    "Todas as configurações são substituídas pelas do arquivo. O que o arquivo não tiver volta ao padrão.",
  ),
  "preferencesFile.confirm": dict("Replace", "Substituir"),
  "preferencesFile.cancel": dict("Cancel", "Cancelar"),
  "preferencesFile.imported": dict("Settings imported.", "Configurações importadas."),
  "preferencesFile.importError": dict(
    "Couldn't import the settings.",
    "Não foi possível importar as configurações.",
  ),
  "preferencesFile.invalid": dict(
    "That file isn't valid JSON.",
    "Esse arquivo não é um JSON válido.",
  ),
  "apiError.taskSessionHasNoBranch": dict(
    "This session isn't on a git branch, so it can't be linked to a task.",
    "Esta sessão não está numa branch git, então não dá para vinculá-la a uma tarefa.",
  ),
  "apiError.malformedPreferencesFile": dict(
    "That file isn't a settings file.",
    "Esse arquivo não é um arquivo de configurações.",
  ),

  "exportSessionModal.title": dict("Export session", "Exportar sessão"),
  "exportSessionModal.intro": dict(
    'Downloads this session as a single .claude-session.json.gz file. Send it to another dev (Teams, Slack, e-mail…) and they can import it with "Import session" in their own Claude Session Manager.',
    'Baixa esta sessão como um único arquivo .claude-session.json.gz. Envie para outro dev (Teams, Slack, e-mail…) e ele pode importar com "Importar sessão" no próprio Claude Session Manager.',
  ),
  "exportSessionModal.sensitiveWarning": dict(
    "The file holds the whole conversation, including the contents of every file Claude read and every command output it saw. Make sure it doesn't contain passwords, tokens or other secrets before sending it — you can review it with: zcat <file> | less",
    "O arquivo contém a conversa inteira, incluindo o conteúdo de todo arquivo que o Claude leu e toda saída de comando que ele viu. Confira se não há senhas, tokens ou outros segredos antes de enviar — dá pra revisar com: zcat <arquivo> | less",
  ),
  "exportSessionModal.recipientHint": dict(
    "Whoever imports it needs a clone of the same repository; the app finds it by the origin URL and rewrites the paths to theirs.",
    "Quem importar precisa ter um clone do mesmo repositório; o app encontra pelo URL do origin e reescreve os caminhos para os dele.",
  ),
  "exportSessionModal.confirm": dict("Download file", "Baixar arquivo"),
  "exportSessionModal.cancel": dict("Cancel", "Cancelar"),
  "exportSessionModal.success": dict("Session exported.", "Sessão exportada."),
  "exportSessionModal.error": dict(
    "Could not export the session.",
    "Não foi possível exportar a sessão.",
  ),

  "importSessionModal.title": dict("Import session", "Importar sessão"),
  "importSessionModal.intro": dict(
    "Pick a .claude-session.json.gz file exported from another machine. Nothing is written until you confirm.",
    "Escolha um arquivo .claude-session.json.gz exportado de outra máquina. Nada é gravado até você confirmar.",
  ),
  "importSessionModal.chooseFile": dict("Choose file…", "Escolher arquivo…"),
  "importSessionModal.chooseAnother": dict("Choose another file…", "Escolher outro arquivo…"),
  "importSessionModal.inspectError": dict(
    "Could not read this file.",
    "Não foi possível ler este arquivo.",
  ),
  "importSessionModal.importError": dict(
    "Could not import the session.",
    "Não foi possível importar a sessão.",
  ),
  "importSessionModal.success": dict("Session imported.", "Sessão importada."),
  "importSessionModal.successCopy": dict(
    "Session imported as a copy (it already existed here).",
    "Sessão importada como cópia (ela já existia aqui).",
  ),
  "importSessionModal.confirm": dict("Import", "Importar"),
  "importSessionModal.confirmOverwrite": dict("Overwrite and import", "Sobrescrever e importar"),
  "importSessionModal.successOverwrite": dict(
    "Session imported, replacing the local copy.",
    "Sessão importada, substituindo a cópia local.",
  ),
  "importSessionModal.cancel": dict("Cancel", "Cancelar"),
  "importSessionModal.field.title": dict("Title", "Título"),
  "importSessionModal.field.nickname": dict("Nickname", "Apelido"),
  "importSessionModal.field.branch": dict("Branch", "Branch"),
  "importSessionModal.field.remote": dict("Repository", "Repositório"),
  "importSessionModal.field.originalFolder": dict("Original folder", "Pasta original"),
  "importSessionModal.field.lastActivity": dict("Last activity", "Última atividade"),
  "importSessionModal.field.size": dict("Size", "Tamanho"),
  "importSessionModal.subagents": dict("{count} subagent(s)", "{count} subagente(s)"),
  "importSessionModal.conflict.title": dict(
    "This session already exists on this machine. Choose what to do:",
    "Esta sessão já existe nesta máquina. Escolha o que fazer:",
  ),
  "importSessionModal.conflict.local": dict("Here now", "Aqui agora"),
  "importSessionModal.conflict.incoming": dict("In the file", "No arquivo"),
  "importSessionModal.conflict.incomingNewer": dict(
    "The file is newer.",
    "O arquivo é mais recente.",
  ),
  "importSessionModal.conflict.incomingOlder": dict(
    "The file is older than the local copy.",
    "O arquivo é mais antigo que a cópia local.",
  ),
  "importSessionModal.conflict.incomingSame": dict(
    "Same version as the local copy.",
    "Mesma versão da cópia local.",
  ),
  "importSessionModal.conflict.copy.title": dict(
    "Import as a copy (new id)",
    "Importar como cópia (novo id)",
  ),
  "importSessionModal.conflict.copy.body": dict(
    "Both stay: the local session is untouched and the imported one gets a new id.",
    "As duas ficam: a sessão local não é alterada e a importada ganha um novo id.",
  ),
  "importSessionModal.conflict.overwrite.title": dict(
    "Overwrite the local session",
    "Sobrescrever a sessão local",
  ),
  "importSessionModal.conflict.overwrite.body": dict(
    "Replaces the local conversation (and its subagents) with the file's, keeping the same id. The local version is lost.",
    "Substitui a conversa local (e seus subagentes) pela do arquivo, mantendo o mesmo id. A versão local é perdida.",
  ),
  "importSessionModal.conflict.overwrite.blockedActive": dict(
    "Unavailable — the local session is active in a terminal. Close it first, or import a copy.",
    "Indisponível — a sessão local está ativa num terminal. Feche-a antes, ou importe uma cópia.",
  ),
  "importSessionModal.targetLabel": dict(
    "Import into this local clone",
    "Importar neste clone local",
  ),
  "importSessionModal.sameRepoOption": dict(
    "{path} (same repository)",
    "{path} (mesmo repositório)",
  ),
  "importSessionModal.otherFolderOption": dict("Other folder…", "Outra pasta…"),
  "importSessionModal.otherFolderPlaceholder": dict(
    "/absolute/path/to/your/clone",
    "/caminho/absoluto/do/seu/clone",
  ),
  "importSessionModal.subfolderHint": dict(
    "The session ran in a subfolder — it will be resumed from:",
    "A sessão rodou numa subpasta — ela será retomada a partir de:",
  ),
  "importSessionModal.remoteMismatch": dict(
    "This folder's origin doesn't match the exported session's repository — Claude may refer to files that don't exist here.",
    "O origin desta pasta não bate com o repositório da sessão exportada — o Claude pode citar arquivos que não existem aqui.",
  ),
  "importSessionModal.commitMissing": dict(
    "Commit {commit} (where the session left off) isn't in this clone yet — run git fetch, or the branch may not have been pushed.",
    "O commit {commit} (onde a sessão parou) ainda não está neste clone — rode git fetch, ou a branch pode não ter sido enviada (push).",
  ),
  "importSessionModal.checkoutLabel": dict(
    "Check out {branch} before importing",
    "Fazer checkout de {branch} antes de importar",
  ),
  "importSessionModal.checkoutHint": dict(
    "Fetched from origin if you don't have it locally. Uncommitted changes that would be overwritten block the checkout.",
    "Busca no origin se você não tiver localmente. Alterações não commitadas que seriam sobrescritas bloqueiam o checkout.",
  ),
  "importSessionModal.checkoutHintWithCurrent": dict(
    "This folder is on {current} now. Fetched from origin if you don't have it locally; uncommitted changes that would be overwritten block the checkout.",
    "Esta pasta está em {current} agora. Busca no origin se você não tiver localmente; alterações não commitadas que seriam sobrescritas bloqueiam o checkout.",
  ),
  "importSessionModal.checkoutBlocked": dict(
    "Unavailable — another Claude session is active in this folder.",
    "Indisponível — outra sessão do Claude está ativa nesta pasta.",
  ),
  "importSessionModal.alreadyOnBranch": dict(
    "This folder is already on {branch}.",
    "Esta pasta já está em {branch}.",
  ),

  "promptPreviewModal.loading": dict("Loading prompts…", "Carregando prompts…"),
  "promptPreviewModal.empty": dict(
    "No prompts found for this session.",
    "Nenhum prompt encontrado para esta sessão.",
  ),
  "promptPreviewModal.loadError": dict(
    "Couldn't load the full prompt text — showing a possibly truncated version.",
    "Não foi possível carregar o texto completo do prompt — mostrando uma versão possivelmente truncada.",
  ),

  "searchBar.placeholder": dict(
    "Search by title, project, branch, or ID...",
    "Buscar por título, projeto, branch ou ID...",
  ),
  "searchBar.clearLabel": dict("Clear search", "Limpar busca"),

  "projectFilter.ariaLabel": dict("Filter by project", "Filtrar por projeto"),
  "projectFilter.allProjects": dict("All projects", "Todos os projetos"),

  "pagination.previousLabel": dict("Previous page", "Página anterior"),
  "pagination.nextLabel": dict("Next page", "Próxima página"),
  "pagination.pageInfo": dict("Page {page} of {pageCount}", "Página {page} de {pageCount}"),

  "perPageSelect.ariaLabel": dict("Sessions per page", "Sessões por página"),
  "perPageSelect.all": dict("All", "Todas"),
  "perPageSelect.perPage": dict("{count} / page", "{count} / página"),

  "emptyState.noResultsTitle": dict("No sessions found", "Nenhuma sessão encontrada"),
  "emptyState.noSessionsTitle": dict(
    "No Claude sessions found",
    "Nenhuma sessão do Claude encontrada",
  ),
  "emptyState.noResultsMessage": dict(
    "Try adjusting your search terms.",
    "Tente ajustar os termos da sua busca.",
  ),
  "emptyState.noSessionsMessage": dict(
    "No sessions recorded yet in ~/.claude/projects.",
    "Ainda não há sessões registradas em ~/.claude/projects.",
  ),

  "errorState.title": dict("Error loading sessions", "Erro ao carregar sessões"),
  "errorState.retry": dict("Try again", "Tentar novamente"),

  "loadingState.message": dict("Loading sessions...", "Carregando sessões..."),
  "loadingState.scanning.title": dict(
    "Scanning your sessions for the first time — this can take a while with a lot of them.",
    "Fazendo a primeira varredura das suas sessões — isso pode demorar um pouco se houver muitas.",
  ),
  "loadingState.scanning.progress": dict(
    "{done} of {total} sessions processed",
    "{done} de {total} sessões processadas",
  ),

  "sessionSizeMeter.tooltip": dict("{size} session — {message}", "Sessão de {size} — {message}"),
  "sessionSizeMeter.label": dict("Session size: {size}", "Tamanho da sessão: {size}"),

  "sessionsPage.showingRange": dict(
    "Showing {start}–{end} of {total}",
    "Mostrando {start}–{end} de {total}",
  ),
  "sessionsPage.selectAllOnPage": dict("Select all on this page", "Selecionar todas nesta página"),
  "sessionsPage.selectedCount": dict("{count} selected", "{count} selecionada(s)"),
  "sessionsPage.clearSelection": dict("Clear", "Limpar"),
  "sessionsPage.deleteSelected": dict("Delete selected", "Excluir selecionadas"),
  "sessionsPage.refresh": dict("Refresh sessions", "Atualizar sessões"),
  "sessionsPage.delete": dict("Delete", "Excluir"),
  "sessionsPage.cancel": dict("Cancel", "Cancelar"),
  "sessionsPage.deleteConfirm.title": dict("Delete session", "Excluir sessão"),
  "sessionsPage.deleteConfirm.message": dict(
    "Are you sure you want to delete this session?",
    "Tem certeza de que deseja excluir esta sessão?",
  ),
  "sessionsPage.deleteConfirm.cleanupWorktree": dict(
    "Also clean up the worktree — removes its folder and the branch git created for it.",
    "Também limpar o worktree — remove sua pasta e a branch que o git criou para ele.",
  ),
  "sessionsPage.deleteConfirm.cleanupBranch": dict(
    'Also delete the local branch "{branch}".',
    'Também excluir a branch local "{branch}".',
  ),
  "sessionsPage.bulkDeleteConfirm.title": dict(
    "Delete selected sessions",
    "Excluir sessões selecionadas",
  ),
  "sessionsPage.bulkDeleteConfirm.message.one": dict(
    "Are you sure you want to delete {count} session? This cannot be undone.",
    "Tem certeza de que deseja excluir {count} sessão? Isso não pode ser desfeito.",
  ),
  "sessionsPage.bulkDeleteConfirm.message.many": dict(
    "Are you sure you want to delete {count} sessions? This cannot be undone.",
    "Tem certeza de que deseja excluir {count} sessões? Isso não pode ser desfeito.",
  ),

  "sessionCard.copyCommand.error": dict(
    "Could not copy the command.",
    "Não foi possível copiar o comando.",
  ),
  "sessionCard.branches.edit": dict(
    "Edit base and task branches",
    "Editar base e branch da tarefa",
  ),
  "sessionCard.branches.originLabel": dict("Base:", "Base:"),
  "taskModal.title": dict("Task", "Tarefa"),
  "taskModal.open": dict("Task: ticket, branches and repos", "Tarefa: ticket, branches e repos"),
  "taskModal.addRepoShortcut": dict("Add a repo to this task", "Adicionar um repo a esta tarefa"),
  "taskModal.taskSection": dict("Ticket", "Ticket"),
  "taskModal.inferredNote": dict(
    "This key was detected from the branch name — save it to keep it even if the branch changes.",
    "Esta chave foi deduzida do nome da branch — salve para mantê-la mesmo se a branch mudar.",
  ),
  "taskModal.keyLabel": dict("Ticket key (or link)", "Chave do ticket (ou link)"),
  "taskModal.linkLabel": dict("Ticket link", "Link do ticket"),
  "taskModal.saveTask": dict("Save ticket", "Salvar ticket"),
  "taskModal.inferTask": dict("Detect automatically", "Deduzir automaticamente"),
  "taskModal.taskSaved": dict("Task saved.", "Tarefa salva."),
  "taskModal.saveError": dict("Couldn't save the task.", "Não foi possível salvar a tarefa."),
  "taskModal.loadError": dict("Couldn't load the task.", "Não foi possível carregar a tarefa."),
  "taskModal.sessionSection": dict("This session", "Esta sessão"),
  "taskModal.nicknameLabel": dict("Local nickname", "Apelido local"),
  "taskModal.saveSession": dict("Save nickname and branches", "Salvar apelido e branches"),
  "taskModal.reposSection": dict("Repos of {key}", "Repos da {key}"),
  "taskModal.noRepos": dict("No repo linked yet.", "Nenhum repo vinculado ainda."),
  "taskModal.thisSession": dict("this session", "esta sessão"),
  "taskModal.sessionCount.one": dict("{count} session", "{count} sessão"),
  "taskModal.sessionCount.many": dict("{count} sessions", "{count} sessões"),
  "taskModal.copyAddDir": dict("Copy /add-dir", "Copiar /add-dir"),
  "taskModal.unlink": dict("Unlink", "Desvincular"),
  "taskModal.addRepo.open": dict("Add repo", "Adicionar repo"),
  "taskModal.addRepo.title": dict("Add a repo to this task", "Adicionar um repo a esta tarefa"),
  "taskModal.addRepo.hint": dict(
    "Creates the task's branch there and links it. Then paste the /add-dir command into the session working on the task.",
    "Cria a branch da tarefa lá e vincula. Depois cole o comando /add-dir na sessão que está trabalhando na tarefa.",
  ),
  "taskModal.addRepo.basePlaceholder": dict("Repo's default branch", "Branch padrão do repo"),
  "taskModal.addRepo.submit": dict("Add to task", "Adicionar à tarefa"),
  "taskModal.addRepo.error": dict("Couldn't add the repo.", "Não foi possível adicionar o repo."),
  "taskModal.addRepo.failedAt": dict("Failed at: {step}", "Falhou em: {step}"),
  "taskModal.addRepo.alreadyDone": dict(
    "Already done (kept): {steps}",
    "Já feito (mantido): {steps}",
  ),
  "taskModal.addRepo.done": dict("Added {branch} — at {path}", "Adicionado {branch} — em {path}"),
  "sessionCard.task.label": dict("Task:", "Tarefa:"),
  "sessionCard.task.filter": dict("Search for this task", "Buscar esta tarefa"),
  "sessionCard.task.inferred": dict("Detected from the branch name", "Deduzida do nome da branch"),
  "sessionCard.task.alsoIn": dict("also in:", "também em:"),
  "sessionCard.task.repoSessions.one": dict(
    "{branch} · {count} session — click to search for the task",
    "{branch} · {count} sessão — clique para buscar a tarefa",
  ),
  "sessionCard.task.repoSessions.many": dict(
    "{branch} · {count} sessions — click to search for the task",
    "{branch} · {count} sessões — clique para buscar a tarefa",
  ),
  "sessionCard.task.repoNoSession": dict(
    "{branch} · no session of its own — click to open the PR",
    "{branch} · sem sessão própria — clique para abrir o PR",
  ),
  "sessionCard.task.openPrError": dict(
    "Couldn't open a PR link for this repo.",
    "Não foi possível abrir um link de PR para este repo.",
  ),
  "sessionCard.branches.destinationLabel": dict("Task branch:", "Branch da tarefa:"),
  "sessionCard.nickname.edit": dict("Edit local nickname", "Editar apelido local"),
  "sessionCard.nickname.add": dict("Add local nickname", "Adicionar apelido local"),
  "sessionCard.nickname.localOnly": dict(
    "Local nickname — only shown in this app",
    "Apelido local — exibido apenas neste app",
  ),
  "sessionCard.continueDisabled.directoryMissing": dict(
    "Recreate the original folder (or a symlink to it) before resuming — the Claude CLI resolves sessions by working directory.",
    "Recrie a pasta original (ou um link simbólico pra ela) antes de retomar — o Claude CLI resolve sessões pela pasta de trabalho.",
  ),
  "sessionCard.resumeButton": dict("Resume (terminal)", "Retomar (terminal)"),
  "sessionCard.deleteButton": dict("Delete", "Excluir"),
  "sessionCard.cancelButton": dict("Cancel", "Cancelar"),
  "sessionCard.checkbox.select": dict("Select session", "Selecionar sessão"),
  "sessionCard.checkbox.deselect": dict("Deselect session", "Desmarcar sessão"),
  "sessionCard.status.activeTooltip": dict(
    "Active — a terminal currently has this session resumed",
    "Ativa — um terminal está com esta sessão retomada agora",
  ),
  "sessionCard.status.inactiveTooltip": dict(
    "Inactive — no terminal currently has this session resumed",
    "Inativa — nenhum terminal está com esta sessão retomada agora",
  ),
  "sessionCard.status.activeLabel": dict("Active session", "Sessão ativa"),
  "sessionCard.status.inactiveLabel": dict("Inactive session", "Sessão inativa"),
  "sessionCard.directoryMissing.title": dict("Original folder missing", "Pasta original ausente"),
  "sessionCard.directoryMissing.tooltipWithPath": dict(
    "Original directory no longer exists: {path}",
    "O diretório original não existe mais: {path}",
  ),
  "sessionCard.directoryMissing.tooltipNoPath": dict(
    "This session's original directory no longer exists",
    "O diretório original desta sessão não existe mais",
  ),
  "sessionCard.directoryMissing.removedWorktree": dict(
    "This looks like a removed worktree — the project's root folder is still here:",
    "Isso parece um worktree removido — a pasta raiz do projeto ainda está aqui:",
  ),
  "sessionCard.directoryMissing.openRootAriaLabel": dict(
    "Open the project root in VS Code",
    "Abrir a raiz do projeto no VS Code",
  ),
  "sessionCard.codeButton": dict("code .", "code ."),
  "sessionCard.directoryMissing.newSessionTooltip": dict(
    "The old transcript can't be resumed from a different folder — this starts a brand-new " +
      "conversation right here at the root, seeded with a recap of what the old session did.",
    "A transcrição antiga não pode ser retomada de uma pasta diferente — isso inicia uma " +
      "conversa totalmente nova aqui na raiz, alimentada com um resumo do que a sessão antiga " +
      "fez.",
  ),
  "sessionCard.newSessionAtRootButton": dict(
    "New session in this folder",
    "Nova sessão nesta pasta",
  ),
  "sessionCard.worktreeTooltip": dict("Git worktree — {path}", "Worktree do git — {path}"),
  "sessionCard.worktreeNameLabel": dict("Worktree name: {name}", "Nome do worktree: {name}"),
  "sessionCard.openInVSCodeTooltip": dict(
    "Open this folder in VS Code",
    "Abrir esta pasta no VS Code",
  ),
  "sessionCard.openInVSCodeAriaLabel": dict("Open in VS Code", "Abrir no VS Code"),
  "sessionCard.cursorButton": dict("cursor .", "cursor ."),
  "sessionCard.openInCursorTooltip": dict(
    "Open this folder in Cursor",
    "Abrir esta pasta no Cursor",
  ),
  "sessionCard.openInCursorAriaLabel": dict("Open in Cursor", "Abrir no Cursor"),
  "sessionCard.worktreeToRoot.ariaLabel": dict(
    "Sync worktree into the root folder",
    "Sincronizar worktree com a pasta raiz",
  ),
  "sessionCard.worktreeToRootButton": dict("worktree → root", "worktree → raiz"),
  "sessionCard.worktreeToRoot.tooltip": dict(
    "Sync this worktree's code into the project's root folder — copy files only, or remove the worktree and check out its branch there instead.",
    "Sincroniza o código deste worktree com a pasta raiz do projeto — copie só os arquivos, ou remova o worktree e faça checkout da branch dele ali.",
  ),
  "sessionCard.updatedPrefix": dict("Updated", "Atualizada"),
  "sessionCard.activeTimeTooltip": dict(
    "Actual time Claude spent processing this session, summed across turns",
    "Tempo real que o Claude gastou processando esta sessão, somado entre os turnos",
  ),
  "sessionCard.activeSuffix": dict("active", "ativa"),
  "sessionCard.previewTooltip": dict(
    "Preview prompts sent in this session",
    "Veja os prompts enviados nesta sessão",
  ),
  "sessionCard.previewAriaLabel": dict("Preview prompts", "Ver prompts"),
  "sessionCard.exportTooltip": dict("Export session as a file", "Exportar sessão como arquivo"),
  "sessionCard.exportAriaLabel": dict("Export session", "Exportar sessão"),
  "sessionCard.resetRootTooltip": dict(
    "Reset root — stashes (recoverable) then discards any uncommitted changes in the project's root folder, without touching this worktree. For the copy → test → reset → repeat loop, without opening the full worktree → root wizard each time.",
    "Reset root — guarda no stash (recuperável) e depois descarta as alterações não commitadas na pasta raiz do projeto, sem tocar neste worktree. Serve pro ciclo copiar → testar → resetar → repetir, sem abrir o assistente completo de worktree → root toda vez.",
  ),
  "sessionCard.resetRootAriaLabel": dict("Reset root folder", "Resetar pasta raiz"),
  "sessionCard.openJenkinsTooltip": dict(
    "Jenkins links for this project and branch",
    "Links do Jenkins deste projeto e branch",
  ),
  "sessionCard.openJenkinsAriaLabel": dict("Jenkins links", "Links do Jenkins"),
  "sessionCard.openPrTooltip": dict(
    "Open this branch's compare/PR page (GitHub or Bitbucket)",
    "Abrir a página de comparação/PR desta branch (GitHub ou Bitbucket)",
  ),
  "sessionCard.openPrAriaLabel": dict("Open PR page", "Abrir página de PR"),
  "sessionCard.openPr.error": dict(
    "Couldn't open a PR link for this session.",
    "Não foi possível abrir um link de PR para esta sessão.",
  ),
  "openPrBaseChoiceModal.title": dict(
    "Compare against which base?",
    "Comparar com qual branch base?",
  ),
  "openPrBaseChoiceModal.intro": dict(
    "This task's branch was created off {branch} instead of the repo's default. Choose which comparison to open.",
    "A branch desta tarefa foi criada a partir de {branch}, e não da branch padrão do repositório. Escolha qual comparação abrir.",
  ),
  "openPrBaseChoiceModal.useBase.title": dict("Compare against {branch}", "Comparar com {branch}"),
  "openPrBaseChoiceModal.useBase.body": dict(
    "Opens the compare/PR page against the actual branch this task started from — the accurate diff.",
    "Abre a página de comparação/PR contra a branch que esta tarefa realmente usou como base — o diff correto.",
  ),
  "openPrBaseChoiceModal.useBase.button": dict("Compare with {branch}", "Comparar com {branch}"),
  "openPrBaseChoiceModal.useDefault.title": dict(
    "Compare against the repo's default",
    "Comparar com a branch padrão do repositório",
  ),
  "openPrBaseChoiceModal.useDefault.body": dict(
    "Opens the compare/PR page against the repo's usual default branch (main/master) instead.",
    "Abre a página de comparação/PR contra a branch padrão do repositório (main/master).",
  ),
  "openPrBaseChoiceModal.useDefault.button": dict("Compare with default", "Comparar com a padrão"),
  "openPrBaseChoiceModal.cancel": dict("Cancel", "Cancelar"),
  "sessionCard.cleanupWorktree.disabledTooltip": dict(
    "Close this session in its terminal before cleaning up the worktree.",
    "Encerre esta sessão no terminal antes de limpar o worktree.",
  ),
  "sessionCard.cleanupWorktree.tooltip": dict(
    "Clean up this worktree — removes its folder and the branch git created for it. Doesn't touch the session transcript.",
    "Limpa este worktree — remove a pasta e a branch que o git criou pra ele. Não afeta a transcrição da sessão.",
  ),
  "sessionCard.cleanupWorktreeAriaLabel": dict("Clean up worktree", "Limpar worktree"),
  "sessionCard.deleteDisabledTooltip": dict(
    "Close this session in its terminal before deleting.",
    "Encerre esta sessão no terminal antes de excluir.",
  ),
  "sessionCard.deleteWorktreeConfirm.title": dict("Clean up worktree", "Limpar worktree"),
  "sessionCard.deleteWorktreeConfirm.message": dict(
    "This removes the worktree's folder and the worktree-<name> branch git created for it, freeing the disk space it used. Uncommitted changes there will block the deletion — commit or stash them first if you need to keep them. The session transcript itself isn't affected.",
    "Isso remove a pasta do worktree e a branch worktree-<name> que o git criou pra ele, liberando o espaço em disco usado. Alterações não commitadas ali vão bloquear a exclusão — faça commit ou stash delas antes se precisar mantê-las. A transcrição da sessão em si não é afetada.",
  ),

  "cleanupModal.title": dict("Cleanup", "Limpeza"),
  "cleanupModal.close": dict("Close", "Fechar"),
  "cleanupModal.howItWorks.label": dict("How it works:", "Como funciona:"),
  "cleanupModal.howItWorks.body": dict(
    "locally checks the worktrees of every project known to the app for these situations:",
    "verifica localmente os worktrees de todos os projetos conhecidos pelo app para estas situações:",
  ),
  "cleanupModal.finding.manualDelete.label": dict(
    "Worktree deleted manually",
    "Worktree excluído manualmente",
  ),
  "cleanupModal.finding.manualDelete.body": dict(
    "(folder removed directly on disk, outside the app) — git still keeps its record of it; the fix only cleans up that record, without deleting anything.",
    "(pasta removida direto no disco, fora do app) — o git ainda mantém o registro dele; a correção só limpa esse registro, sem deletar nada.",
  ),
  "cleanupModal.finding.mergedBranch.label": dict(
    "Worktree with an already-merged branch",
    "Worktree com uma branch já mergeada",
  ),
  "cleanupModal.finding.mergedBranch.body": dict(
    "into the repository's default branch, with no active session or pending changes — can be safely removed (worktree and local branch together).",
    "na branch padrão do repositório, sem sessão ativa ou mudanças pendentes — pode ser removido com segurança (worktree e branch local juntos).",
  ),
  "cleanupModal.finding.abandonedWorktree.label": dict("Abandoned worktree", "Worktree abandonado"),
  "cleanupModal.finding.abandonedWorktree.body": dict(
    '(created by Claude/"New task" under .claude/worktrees/ but never used by any session) with no pending changes and no commit of its own — removing it loses nothing.',
    '(criado pelo Claude/"Nova tarefa" em .claude/worktrees/ mas nunca usado por nenhuma sessão) sem mudanças pendentes e sem nenhum commit próprio — removê-lo não perde nada.',
  ),
  "cleanupModal.finding.oldSessions.label": dict("Old local sessions", "Sessões locais antigas"),
  "cleanupModal.finding.oldSessions.body": dict(
    "once a project has more sessions than the configured limit (10 by default — edit " +
      '"keepRecentSessionsPerProject" in userPreferences.json to change it), the oldest ones ' +
      "can be deleted to free disk space and speed up the session list. The active session is never " +
      "suggested.",
    "quando um projeto tem mais sessões do que o limite configurado (10 por padrão — edite " +
      '"keepRecentSessionsPerProject" no userPreferences.json para mudar isso), as mais antigas ' +
      "podem ser excluídas para liberar espaço em disco e acelerar a listagem de sessões. A " +
      "sessão ativa nunca é sugerida.",
  ),
  "cleanupModal.finding.oldSessions.title": dict(
    '{count} old session(s) in "{project}"',
    '{count} sessão(ões) antiga(s) em "{project}"',
  ),
  "cleanupModal.finding.oldSessions.description": dict(
    "Keeping the {keep} most recently updated session(s) in this project. These {count} older " +
      "session(s) can be deleted, freeing about {freed}.",
    "Mantendo a(s) {keep} sessão(ões) mais recente(s) deste projeto. Estas {count} sessão(ões) " +
      "mais antiga(s) podem ser excluídas, liberando cerca de {freed}.",
  ),
  "cleanupModal.finding.oldSessions.warning": dict(
    "This permanently deletes the session transcript(s) listed below. This cannot be undone.",
    "Isso exclui permanentemente a(s) transcrição(ões) de sessão listada(s) abaixo. Isso não pode ser desfeito.",
  ),
  "cleanupModal.finding.prune.title": dict(
    'Worktrees deleted manually in "{project}"',
    'Worktrees excluídos manualmente em "{project}"',
  ),
  "cleanupModal.finding.prune.description": dict(
    "{count} worktree(s) ({branches}) were deleted directly on disk, outside the app — git still keeps their record. This only cleans up that internal record, without deleting anything.",
    "{count} worktree(s) ({branches}) foram excluídos direto no disco, fora do app — o git ainda mantém o registro deles. Isso só limpa esse registro interno, sem deletar nada.",
  ),
  "cleanupModal.finding.merged.title": dict(
    'Worktree "{branch}" already merged',
    'Worktree "{branch}" já mergeada',
  ),
  "cleanupModal.finding.merged.description": dict(
    'Branch "{branch}" is already merged into "{defaultBranch}" and the worktree has no active session or pending changes. The worktree and local branch can be safely removed.',
    'A branch "{branch}" já está mergeada em "{defaultBranch}" e o worktree não tem sessão ativa nem alterações pendentes. O worktree e a branch local podem ser removidos com segurança.',
  ),
  "cleanupModal.finding.abandoned.title": dict(
    'Abandoned worktree "{branch}" in "{project}"',
    'Worktree abandonado "{branch}" em "{project}"',
  ),
  "cleanupModal.finding.abandoned.description": dict(
    'No session ever ran in this worktree, it has no pending changes, and branch "{branch}" has no commit that isn\'t on another branch, remote or tag. The worktree and local branch can be safely removed.',
    'Nenhuma sessão rodou neste worktree, ele não tem alterações pendentes e a branch "{branch}" não tem nenhum commit que já não esteja em outra branch, no remoto ou numa tag. O worktree e a branch local podem ser removidos com segurança.',
  ),
  "apiError.cleanupBranchHasCommits": dict(
    "That branch now has commits of its own — cancelled for safety.",
    "Essa branch agora tem commits próprios — cancelado por segurança.",
  ),
  "apiError.cleanupWorktreeHasSession": dict(
    "A session now exists in that worktree — cancelled for safety.",
    "Agora existe uma sessão nesse worktree — cancelado por segurança.",
  ),
  "cleanupModal.loading": dict("Loading...", "Carregando..."),
  "cleanupModal.loadError": dict(
    "Could not fetch cleanup items.",
    "Não foi possível buscar os itens de limpeza.",
  ),
  "cleanupModal.empty": dict("Nothing found to clean up.", "Nada encontrado para limpar."),
  "cleanupModal.run": dict("Run", "Executar"),
  "cleanupModal.resolved": dict("Item resolved successfully.", "Item resolvido com sucesso."),
  "cleanupModal.runError": dict(
    "Could not run this cleanup.",
    "Não foi possível executar essa limpeza.",
  ),
  "newTaskModal.title": dict("New task", "Nova tarefa"),
  "newTaskModal.confirm": dict("Create and open terminal", "Criar e abrir terminal"),
  "newTaskModal.cancel": dict("Cancel", "Cancelar"),
  "newTaskModal.clear": dict("Clear", "Limpar"),
  "newTaskModal.step.repo": dict(
    "Confirm the folder is a git repository",
    "Confirmar que a pasta é um repositório git",
  ),
  "newTaskModal.step.base": dict(
    "Fetch the latest version of the base branch",
    "Buscar a versão mais recente da branch base",
  ),
  "newTaskModal.step.worktree": dict(
    "Create the branch and isolated worktree",
    "Criar a branch e o worktree isolado",
  ),
  "newTaskModal.step.worktreeNoWorktree": dict(
    "Create the branch directly in the project folder (no worktree)",
    "Criar a branch diretamente na pasta do projeto (sem worktree)",
  ),
  "newTaskModal.step.extraRepo": dict(
    "Create the branch in {project} and link it to the task",
    "Criar a branch em {project} e vincular à tarefa",
  ),
  "newTaskModal.extraRepos.label": dict(
    "Other repos of this task (optional)",
    "Outros repos desta tarefa (opcional)",
  ),
  "newTaskModal.extraRepos.hint": dict(
    "Each gets the same branch ({branch}), off the base you type (blank = the repo's default), and joins the session via --add-dir. You can also add repos later from the card.",
    "Cada um recebe a mesma branch ({branch}), a partir da base indicada (vazio = padrão do repo), e entra na sessão via --add-dir. Também dá para adicionar depois, pelo card.",
  ),
  "newTaskModal.extraRepos.needsKey": dict(
    "Needs a ticket key in the link (e.g. PROJ-123) to group the repos into one task.",
    "Precisa de uma chave de ticket no link (ex.: PROJ-123) para agrupar os repos numa tarefa.",
  ),
  "newTaskModal.extraRepos.needsLinkFirst": dict(
    "First paste the ticket link (with its key, e.g. PROJ-123) — the extra repos are grouped by it.",
    "Primeiro cole o link do Jira (com a chave, ex.: PROJ-123) — os repos extras são agrupados por ela.",
  ),
  "newTaskModal.extraRepos.yes": dict("Yes", "Sim"),
  "newTaskModal.extraRepos.no": dict("No", "Não"),
  "newTaskModal.extraRepos.add": dict("+ Add a repo…", "+ Adicionar repo…"),
  "newTaskModal.extraRepos.remove": dict("Remove", "Remover"),
  "newTaskModal.extraRepos.promptNote": dict(
    "This task also spans these folders (already added with --add-dir): {dirs}",
    "Esta tarefa também envolve estas pastas (já adicionadas com --add-dir): {dirs}",
  ),
  "newTaskModal.extraRepos.partialFailure": dict(
    "The task started, but some repo couldn't be added — see the checklist.",
    "A tarefa foi iniciada, mas algum repo não pôde ser adicionado — veja a lista de passos.",
  ),
  "newTaskModal.step.launch": dict(
    "Open terminal and start Claude",
    "Abrir terminal e iniciar o Claude",
  ),
  "newTaskModal.jiraLinkLabel": dict("Task link (Jira)", "Link da tarefa (Jira)"),
  "newTaskModal.taskPrefix": dict("Task", "Tarefa"),
  "newTaskModal.projectLabel": dict("Project (folder)", "Projeto (pasta)"),
  "newTaskModal.loadingProjects": dict("Loading projects…", "Carregando projetos…"),
  "newTaskModal.selectProject": dict("Select a project", "Selecione um projeto"),
  "newTaskModal.recentProjectsGroup": dict("Recent", "Recentes"),
  "newTaskModal.workspaceProjectsGroup": dict(
    "Other repos (from your folders)",
    "Outros repositórios (das suas pastas)",
  ),
  "newTaskModal.otherFolder": dict("Other (paste folder path)", "Outro (cole o caminho da pasta)"),
  "newTaskModal.readingRepoInfo": dict(
    "Reading repository information…",
    "Lendo as informações do repositório…",
  ),
  "newTaskModal.repoInfoError": dict(
    "Could not read this repository's information.",
    "Não foi possível ler as informações deste repositório.",
  ),
  "newTaskModal.promptLabel": dict("Prompt", "Prompt"),
  "newTaskModal.saving": dict("Saving…", "Salvando…"),
  "newTaskModal.saveAsDefault": dict("Save as default", "Salvar como padrão"),
  "newTaskModal.promptSaved": dict("Default prompt saved.", "Prompt padrão salvo."),
  "newTaskModal.promptSaveError": dict(
    "Could not save the default prompt.",
    "Não foi possível salvar o prompt padrão.",
  ),
  "newTaskModal.loadingDefaultPrompt": dict(
    "Loading default prompt…",
    "Carregando o prompt padrão…",
  ),
  "newTaskModal.promptPlaceholder": dict("Instructions for Claude…", "Instruções para o Claude…"),
  "newTaskModal.baseBranchLabel": dict("Base branch", "Branch base"),
  "newTaskModal.useLocalBaseBranchLabel": dict(
    "Use the local branch instead of fetching the latest from the remote.",
    "Usar a branch local em vez de buscar a mais recente do remoto.",
  ),
  "newTaskModal.branchTypeLabel": dict("Branch type", "Tipo de branch"),
  "newTaskModal.otherBranchType": dict("Other", "Outro"),
  "newTaskModal.customPrefixPlaceholder": dict("custom prefix", "prefixo personalizado"),
  "newTaskModal.branchNameLabel": dict("Branch name", "Nome da branch"),
  "newTaskModal.branchPreview": dict("Preview:", "Pré-visualização:"),
  "newTaskModal.useWorktreeLabel": dict(
    "Use an isolated worktree — instead of switching the branch directly in the project folder.",
    "Usar um worktree isolado — em vez de trocar a branch diretamente na pasta do projeto.",
  ),
  "newTaskModal.useAsDefault": dict("Use as default", "Usar como padrão"),
  "newTaskModal.worktreePrefSaved": dict(
    "Worktree preference saved.",
    "Preferência de worktree salva.",
  ),
  "newTaskModal.worktreePrefSaveError": dict(
    "Could not save this preference.",
    "Não foi possível salvar essa preferência.",
  ),
  "newTaskModal.noWorktreeWarning": dict(
    "Without a worktree, the new branch is switched directly in the project's main folder — this can cause conflicts if another terminal or session is already active there.",
    "Sem um worktree, a nova branch é trocada diretamente na pasta principal do projeto — isso pode causar conflitos se outro terminal ou sessão já estiver ativo ali.",
  ),
  "newTaskModal.worktreeAutoExplanation": dict(
    "We only suggest an isolated worktree when this project's main folder already has an active session — otherwise the branch is switched directly there, which is simpler and doesn't leave an extra folder behind. You can always override this checkbox by hand.",
    "Só sugerimos um worktree isolado quando a pasta principal deste projeto já tem uma sessão ativa — caso contrário, a branch é trocada diretamente ali, o que é mais simples e não deixa uma pasta extra para trás. Você sempre pode sobrescrever essa opção manualmente.",
  ),
  "newTaskModal.checkingActiveSession": dict(
    "Checking whether this project already has an active session…",
    "Verificando se este projeto já tem uma sessão ativa…",
  ),
  "newTaskModal.activeSessionDetected": dict(
    "Active session detected in this project's main folder — suggesting an isolated worktree so this new task doesn't interfere with it.",
    "Sessão ativa detectada na pasta principal deste projeto — sugerindo um worktree isolado para essa nova tarefa não interferir nela.",
  ),
  "newTaskModal.noActiveSessionDetected": dict(
    "No active session detected in this project's main folder, so a worktree isn't needed.",
    "Nenhuma sessão ativa detectada na pasta principal deste projeto, então um worktree não é necessário.",
  ),
  "newTaskModal.permissionModeAutoLabel": dict(
    "Skip permission prompts (--permission-mode auto)",
    "Pular confirmações de permissão (--permission-mode auto)",
  ),
  "newTaskModal.permissionModeAutoExplanation": dict(
    "Starts the session with Claude Code's own \"auto\" permission mode, so it stops asking for approval before most actions. Useful here specifically because a background terminal window can't be brought to front on some setups (see the app's own notes on this) — if it's sitting at an unanswered prompt you never saw, this avoids that entirely. Remembered as whatever you last left it at.",
    'Inicia a sessão no modo de permissão "auto" do próprio Claude Code, então ele para de pedir aprovação antes da maioria das ações. Útil aqui especificamente porque a janela do terminal em segundo plano não pode ser trazida para frente em algumas configurações — se ela estiver parada num prompt que você nunca viu, isso evita esse problema por completo. Fica lembrado como você deixou da última vez.',
  ),
  "newTaskModal.progressLabel": dict("Progress:", "Progresso:"),
  "newTaskModal.whatWillHappen": dict(
    'What will happen when you click "Create and open terminal":',
    'O que vai acontecer quando você clicar em "Criar e abrir terminal":',
  ),
  "newTaskModal.explain.repo.pre": dict("Confirms that", "Confirma que"),
  "newTaskModal.explain.folderPlaceholder": dict("(chosen folder)", "(pasta escolhida)"),
  "newTaskModal.explain.repo.post": dict("is a git repository.", "é um repositório git."),
  "newTaskModal.explain.base.pre.remote": dict(
    "Fetches the latest version of the base branch",
    "Busca a versão mais recente da branch base",
  ),
  "newTaskModal.explain.base.pre.local": dict(
    "Uses the local base branch",
    "Usa a branch base local",
  ),
  "newTaskModal.explain.basePlaceholder": dict("(base branch)", "(branch base)"),
  "newTaskModal.explain.base.post.remote": dict(
    "directly from the remote — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "diretamente do remoto — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
  ),
  "newTaskModal.explain.base.post.local": dict(
    "as-is, without fetching from the remote first — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "como está, sem buscar do remoto primeiro — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
  ),
  "newTaskModal.explain.branch.pre": dict("Creates the new branch", "Cria a nova branch"),
  "newTaskModal.explain.branchPlaceholder": dict("(branch name)", "(nome da branch)"),
  "newTaskModal.explain.branch.post": dict(
    "from that updated version.",
    "a partir dessa versão atualizada.",
  ),
  "newTaskModal.explain.worktree.skip": dict(
    "Switches to that branch directly in the project's main folder — without a worktree, this can conflict with another terminal already open there.",
    "Troca para essa branch diretamente na pasta principal do projeto — sem um worktree, isso pode conflitar com outro terminal já aberto ali.",
  ),
  "newTaskModal.explain.worktree.create": dict(
    "Creates an isolated worktree (its own folder, separate from the main one) already on that branch — this is what lets you work on this task without interfering with another terminal open on the same project.",
    "Cria um worktree isolado (uma pasta própria, separada da principal) já naquela branch — é isso que permite trabalhar nessa tarefa sem interferir em outro terminal aberto no mesmo projeto.",
  ),
  "newTaskModal.explain.launch.pre": dict("Opens a new terminal", "Abre um novo terminal"),
  "newTaskModal.explain.launch.inProjectFolder": dict(
    "in the project folder",
    "na pasta do projeto",
  ),
  "newTaskModal.explain.launch.insideWorktree": dict(
    "inside that worktree",
    "dentro daquele worktree",
  ),
  "newTaskModal.explain.launch.and": dict("and starts", "e inicia o"),
  "newTaskModal.explain.launch.post": dict(
    "with the prompt above as the first message.",
    "com o prompt acima como primeira mensagem.",
  ),
  "newTaskModal.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Verifique a barra de tarefas se ele não veio para a frente.",
  ),
  "newTaskModal.unexpectedFailure": dict("Unexpected failure.", "Falha inesperada."),
  "newTaskModal.createFailed": dict(
    "Failed to create task: {message}",
    "Falha ao criar a tarefa: {message}",
  ),

  "newSessionModal.title": dict("New session", "Nova sessão"),
  "newSessionModal.intro": dict(
    "Starts Claude straight in the project's folder, on whatever branch it's on — no Jira link, branch or worktree.",
    "Inicia o Claude direto na pasta do projeto, na branch em que ela estiver — sem link do Jira, branch nem worktree.",
  ),
  "newSessionModal.confirm": dict("Start session", "Iniciar sessão"),
  "newSessionModal.promptPlaceholder": dict(
    "Instructions for Claude (optional — leave blank to just open Claude)…",
    "Instruções para o Claude (opcional — deixe em branco para só abrir o Claude)…",
  ),
  "newSessionModal.launchFailed": dict(
    "Failed to start the session: {message}",
    "Falha ao iniciar a sessão: {message}",
  ),
  "newSessionModal.activeSessionTitle": dict(
    "There's already a session in this repository",
    "Já existe uma sessão neste repositório",
  ),
  "newSessionModal.activeSessionMessage": dict(
    "A Claude session is already running in {folder}. Both sessions will work on the same files and branch at the same time. Start anyway?",
    "Já há uma sessão do Claude rodando em {folder}. As duas sessões vão mexer nos mesmos arquivos e na mesma branch ao mesmo tempo. Iniciar mesmo assim?",
  ),
  "newSessionModal.activeSessionConfirm": dict("Start anyway", "Iniciar mesmo assim"),

  "testTaskModal.title": dict("Test task", "Testar tarefa"),
  "testTaskModal.intro": dict(
    "Opens a terminal in {dir} running {command}. The skill does the rest: finds the project, plans and runs the test.",
    "Abre um terminal em {dir} rodando {command}. A skill faz o resto: acha o projeto, planeja e executa o teste.",
  ),
  "testTaskModal.linkLabel": dict("Task link", "Link da tarefa"),
  "testTaskModal.linkPlaceholder": dict(
    "https://company.atlassian.net/browse/PROJ-123",
    "https://company.atlassian.net/browse/PROJ-123",
  ),
  "testTaskModal.permissionModeAutoExplanation": dict(
    "On by default here: the test skill only reads code and the ticket, and its terminal usually sits in the background. Remembered as whatever you last left it at.",
    "Ligado por padrão aqui: a skill de teste só lê o código e o ticket, e o terminal dela costuma ficar em segundo plano. Fica lembrado como você deixou da última vez.",
  ),
  "testTaskModal.confirm": dict("Test", "Testar"),
  "testTaskModal.nickname": dict("Test - {link}", "Teste - {link}"),
  "testTaskModal.launchFailed": dict(
    "Failed to start the test: {message}",
    "Falha ao iniciar o teste: {message}",
  ),

  "taskTestSkill.title": dict("Task test skill", "Skill de teste da tarefa"),
  "taskTestSkill.description": dict(
    "The skill the header's \"Test task\" button runs with the task's link. The button only shows up once one is chosen.",
    'A skill que o botão "Testar tarefa" do header roda com o link da tarefa. O botão só aparece depois que uma é escolhida.',
  ),
  "taskTestSkill.none": dict("None (button hidden)", "Nenhuma (botão escondido)"),
  "taskTestSkill.missing": dict("{skill} (not installed)", "{skill} (não instalada)"),

  "useSessions.loadError": dict(
    "Could not load sessions.",
    "Não foi possível carregar as sessões.",
  ),
  "useSessions.worktreeDeleted": dict(
    "Worktree and its branch deleted.",
    "Worktree e sua branch excluídos.",
  ),
  "useSessions.cleanupWorktreeError": dict(
    "Could not clean up the worktree.",
    "Não foi possível limpar o worktree.",
  ),
  "useSessions.branchDeleted": dict('Branch "{branch}" deleted.', 'Branch "{branch}" excluída.'),
  "useSessions.deleteBranchError": dict(
    "Could not delete the branch.",
    "Não foi possível excluir a branch.",
  ),
  "useSessions.sessionDeleted": dict(
    "Session deleted successfully.",
    "Sessão excluída com sucesso.",
  ),
  "useSessions.deleteSessionError": dict(
    "Could not delete the session.",
    "Não foi possível excluir a sessão.",
  ),
  "useSessions.deleted.one": dict("Deleted 1 session.", "1 sessão excluída."),
  "useSessions.deleted.many": dict("Deleted {count} sessions.", "{count} sessões excluídas."),
  "useSessions.deleteFailed.one": dict(
    "Could not delete 1 session.",
    "Não foi possível excluir 1 sessão.",
  ),
  "useSessions.deleteFailed.many": dict(
    "Could not delete {count} sessions.",
    "Não foi possível excluir {count} sessões.",
  ),
  "useSessions.deletedPartial.one": dict(
    "Deleted 1 session, {failedCount} failed.",
    "1 sessão excluída, {failedCount} falharam.",
  ),
  "useSessions.deletedPartial.many": dict(
    "Deleted {count} sessions, {failedCount} failed.",
    "{count} sessões excluídas, {failedCount} falharam.",
  ),
  "useSessions.nicknameSaved": dict("Nickname saved.", "Apelido salvo."),
  "useSessions.nicknameRemoved": dict("Nickname removed.", "Apelido removido."),
  "useSessions.branchesSaved": dict("Branches saved.", "Branches salvas."),
  "useSessions.saveBranchesError": dict(
    "Could not save the branches.",
    "Não foi possível salvar as branches.",
  ),
  "useSessions.saveNicknameError": dict(
    "Could not save the nickname.",
    "Não foi possível salvar o apelido.",
  ),
  "useSessions.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Confira a barra de tarefas se ele não veio para frente.",
  ),
  "useSessions.resumeError": dict(
    "Could not resume the session.",
    "Não foi possível retomar a sessão.",
  ),
  "useSessions.stoppedAndResumed": dict(
    "Stopped the other terminal, checked out the branch, and opened a terminal here.",
    "O outro terminal foi parado, foi feito checkout da branch e um terminal foi aberto aqui.",
  ),
  "useSessions.switchSessionsError": dict(
    "Could not switch sessions.",
    "Não foi possível alternar entre as sessões.",
  ),
  "useSessions.openingVSCode": dict("Opening in VS Code…", "Abrindo no VS Code…"),
  "useSessions.openVSCodeError": dict(
    "Could not open VS Code.",
    "Não foi possível abrir o VS Code.",
  ),
  "useSessions.openingCursor": dict("Opening in Cursor…", "Abrindo no Cursor…"),
  "useSessions.openCursorError": dict("Could not open Cursor.", "Não foi possível abrir o Cursor."),
  "useSessions.openingRootVSCode": dict(
    "Opening the project root in VS Code…",
    "Abrindo a pasta raiz do projeto no VS Code…",
  ),
  "useSessions.newTerminalAtRoot": dict(
    "New terminal opened at the project root. Check your taskbar if it didn't come to the front.",
    "Novo terminal aberto na pasta raiz do projeto. Confira a barra de tarefas se ele não veio para frente.",
  ),
  "useSessions.startSessionError": dict(
    "Could not start a session there.",
    "Não foi possível iniciar uma sessão ali.",
  ),
  "useSessions.worktreeCreated": dict(
    "Worktree created. Terminal opened — check your taskbar if it didn't come to the front.",
    "Worktree criado. Terminal aberto — confira a barra de tarefas se ele não veio para frente.",
  ),
  "useSessions.createWorktreeError": dict(
    "Could not create the worktree.",
    "Não foi possível criar o worktree.",
  ),
  "useSessions.deleteWorktreeError": dict(
    "Could not delete the worktree.",
    "Não foi possível excluir o worktree.",
  ),
  "useUpdate.updateSuccess": dict(
    "Updated successfully. Restart the app to load the new version.",
    "Atualizado com sucesso. Reinicie o app para carregar a nova versão.",
  ),
  "useUpdate.updateError": dict(
    "Could not update the application.",
    "Não foi possível atualizar o aplicativo.",
  ),
  "useUpdate.timeoutError": dict(
    "Timed out waiting for the update to finish.",
    "Tempo esgotado esperando a atualização terminar.",
  ),
  "useUsageLimits.fetchError": dict(
    "Could not fetch usage limits.",
    "Não foi possível buscar os limites de uso.",
  ),
  "updateButton.checking": dict("Checking for updates…", "Verificando atualizações…"),
  "updateButton.updating": dict(
    "Updating — fetching the latest version and installing dependencies…",
    "Atualizando — buscando a versão mais recente e instalando dependências…",
  ),
  "updateButton.checkError": dict(
    "Could not check for updates.",
    "Não foi possível verificar atualizações.",
  ),
  "updateButton.upToDate": dict("Up to date", "Atualizado"),
  "updateButton.updateAvailable.one": dict(
    "1 new commit on {branch} — click to update",
    "1 novo commit em {branch} — clique para atualizar",
  ),
  "updateButton.updateAvailable.many": dict(
    "{count} new commits on {branch} — click to update",
    "{count} novos commits em {branch} — clique para atualizar",
  ),
  "updateButton.label": dict("Update app", "Atualizar app"),
  "updateOverlay.title": dict("Updating the app…", "Atualizando o aplicativo…"),
  "updateOverlay.subtitle": dict(
    "A new version was found and is being installed automatically. This should only take a moment — please don't close this window.",
    "Uma nova versão foi encontrada e está sendo instalada automaticamente. Isso deve levar só um instante — não feche esta janela.",
  ),
  "updateOverlay.errorTitle": dict("Automatic update failed", "Falha na atualização automática"),
  "updateOverlay.dismiss": dict("Continue anyway", "Continuar mesmo assim"),
  "usageLimitsBadge.compact.session": dict("5h", "5h"),
  "usageLimitsBadge.compact.weeklyAll": dict("7d", "7d"),
  "usageLimitsBadge.full.session": dict("Session (5h)", "Sessão (5h)"),
  "usageLimitsBadge.full.weeklyAll": dict("Weekly", "Semanal"),
  "usageLimitsBadge.full.weeklyOpus": dict("Weekly (Opus)", "Semanal (Opus)"),
  "usageLimitsBadge.full.weeklySonnet": dict("Weekly (Sonnet)", "Semanal (Sonnet)"),
  "usageLimitsBadge.resetsSoon": dict("resets soon ({absolute})", "reinicia em breve ({absolute})"),
  "usageLimitsBadge.lessThanOneMin": dict("less than 1min", "menos de 1min"),
  "usageLimitsBadge.resetsIn": dict(
    "resets in {relative} ({absolute})",
    "reinicia em {relative} ({absolute})",
  ),
  "usageLimitsBadge.unavailable": dict("Usage unavailable", "Uso indisponível"),
  "usageLimitsBadge.noData": dict("Usage —", "Uso —"),
  "usageLimitsBadge.title": dict("Claude usage limits", "Limites de uso do Claude"),
  "usageLimitsBadge.noLimits": dict(
    "No usage recorded yet — use Claude a bit, then click to refresh.",
    "Nenhum uso registrado ainda — use o Claude um pouco e depois clique para atualizar.",
  ),
  "usageLimitsBadge.extraUsage": dict(
    "Extra usage: {usedCredits} / {monthlyLimit} {currency}",
    "Uso extra: {usedCredits} / {monthlyLimit} {currency}",
  ),
  "usageLimitsBadge.clickToRefresh": dict("Click to refresh.", "Clique para atualizar."),
  "themeToggle.switchToLight": dict("Switch to light theme", "Mudar para o tema claro"),
  "themeToggle.switchToDark": dict("Switch to dark theme", "Mudar para o tema escuro"),

  "worktreeToRootModal.title": dict("Worktree → root", "Worktree → raiz"),
  "worktreeToRootModal.cancel": dict("Cancel", "Cancelar"),
  "worktreeToRootModal.back": dict("Back", "Voltar"),
  "worktreeToRootModal.keepCard": dict("Keep the card", "Manter o card"),
  "worktreeToRootModal.confirmContinue": dict("Continue", "Continuar"),
  "worktreeToRootModal.confirmYesDoIt": dict("Yes, do it", "Sim, pode fazer"),
  "worktreeToRootModal.confirmDeleteSession": dict("Delete this session", "Excluir esta sessão"),

  "worktreeToRootModal.steps.resetRoot": dict(
    "Discard uncommitted changes in the root folder",
    "Descartar alterações não commitadas na pasta raiz",
  ),
  "worktreeToRootModal.steps.copy": dict(
    "Copy the worktree's files into the root folder",
    "Copiar os arquivos do worktree para a pasta raiz",
  ),
  "worktreeToRootModal.steps.removeAndCheckout": dict(
    "Remove the worktree and check out its branch in the root folder",
    "Remover o worktree e fazer checkout da branch dele na pasta raiz",
  ),

  "worktreeToRootModal.fileListBox.none": dict("None", "Nenhum"),

  "worktreeToRootModal.choice.intro": dict(
    "Both options start by discarding any uncommitted changes currently in the root folder — pick which one, then you'll see exactly what will happen before confirming anything.",
    "As duas opções começam descartando qualquer alteração não commitada que exista agora na pasta raiz — escolha uma, e você vai ver exatamente o que vai acontecer antes de confirmar qualquer coisa.",
  ),
  "worktreeToRootModal.choice.copyTitle": dict("Copy files only", "Copiar apenas os arquivos"),
  "worktreeToRootModal.choice.copyBody": dict(
    "Copies the worktree's current files into the root folder. The worktree is left exactly as it is — nothing there is deleted or checked out. Root's branch doesn't change either; it just ends up with the worktree's files as uncommitted changes. No commits, no history — meant as a disposable preview you'll likely discard afterward.",
    "Copia os arquivos atuais do worktree para a pasta raiz. O worktree fica exatamente como está — nada nele é excluído ou passa por checkout. A branch da raiz também não muda; ela só acaba com os arquivos do worktree como alterações não commitadas. Sem commits, sem histórico — pensado como um preview descartável que você provavelmente vai jogar fora depois.",
  ),
  "worktreeToRootModal.choice.checkoutTitle": dict(
    "Remove worktree & checkout branch",
    "Remover worktree e fazer checkout da branch",
  ),
  "worktreeToRootModal.choice.checkoutBody": dict(
    "Deletes the worktree's folder and checks its branch out directly in the root folder instead — a real git checkout with full history preserved. The branch itself is never deleted. This session's transcript can no longer be resumed afterward, since it's tied to the worktree folder that just got removed.",
    "Exclui a pasta do worktree e faz checkout da branch dele direto na pasta raiz — um checkout de git real, com todo o histórico preservado. A branch em si nunca é excluída. A transcrição desta sessão não pode mais ser retomada depois, já que está vinculada à pasta do worktree que acabou de ser removida.",
  ),

  "worktreeToRootModal.preview.loading": dict(
    "Reading the worktree and root folder…",
    "Lendo o worktree e a pasta raiz…",
  ),
  "worktreeToRootModal.preview.errorFallback": dict(
    "Could not read the worktree/root folders.",
    "Não foi possível ler as pastas do worktree/raiz.",
  ),
  "worktreeToRootModal.preview.rootFolderLabel": dict("Root folder", "A pasta raiz"),
  "worktreeToRootModal.preview.currentlyOnBranch": dict(
    "is currently on branch",
    "está atualmente na branch",
  ),
  "worktreeToRootModal.preview.detachedHead": dict("(detached HEAD)", "(HEAD destacado)"),
  "worktreeToRootModal.preview.switchToPrefix": dict(
    "It will be switched to",
    "Ela vai ser trocada para",
  ),
  "worktreeToRootModal.preview.switchToSuffix": dict(
    "— the worktree's own branch.",
    "— a própria branch do worktree.",
  ),
  "worktreeToRootModal.preview.unknownBranch": dict("(unknown)", "(desconhecida)"),
  "worktreeToRootModal.preview.dirtyFilesNoneTitle": dict(
    "Uncommitted files in root (none — nothing will be lost there)",
    "Arquivos não commitados na raiz (nenhum — nada será perdido ali)",
  ),
  "worktreeToRootModal.preview.dirtyFilesTitle": dict(
    "Uncommitted files in root that will be discarded",
    "Arquivos não commitados na raiz que serão descartados",
  ),
  "worktreeToRootModal.preview.openInVSCode": dict(
    "Open the root folder in VS Code",
    "Abrir a pasta raiz no VS Code",
  ),
  "worktreeToRootModal.preview.addedTitle": dict("Added to root", "Adicionados à raiz"),
  "worktreeToRootModal.preview.modifiedTitle": dict("Modified in root", "Modificados na raiz"),
  "worktreeToRootModal.preview.removedTitle": dict("Removed from root", "Removidos da raiz"),
  "worktreeToRootModal.preview.checkoutWarning": dict(
    "The worktree's folder will be deleted (its branch and commits are kept). This session's transcript is tied to that exact folder, so it won't be resumable from this app afterward — the code itself isn't lost, it's just in the root folder now.",
    "A pasta do worktree será excluída (a branch e os commits dele são mantidos). A transcrição desta sessão está vinculada exatamente a essa pasta, então ela não poderá ser retomada a partir deste app depois — o código em si não é perdido, só que fica na pasta raiz agora.",
  ),
  "worktreeToRootModal.preview.rootActiveWarning": dict(
    "A session is currently active in the root folder — close its terminal before continuing.",
    "Uma sessão está ativa agora na pasta raiz — encerre o terminal dela antes de continuar.",
  ),
  "worktreeToRootModal.preview.worktreeActiveWarning": dict(
    "A session is still active in this worktree — close its terminal before removing it.",
    "Uma sessão ainda está ativa neste worktree — encerre o terminal dela antes de removê-lo.",
  ),

  "worktreeToRootModal.confirm.stashIntro": dict(
    "Root's current uncommitted changes will be stashed first (recoverable afterward via",
    "As alterações não commitadas atuais da raiz serão colocadas no stash primeiro (recuperáveis depois via",
  ),
  "worktreeToRootModal.confirm.stashIntroSuffix": dict(
    "), then cleared from the working tree.",
    "), e então removidas da working tree.",
  ),
  "worktreeToRootModal.confirm.checkoutWarning": dict(
    "After that, the worktree's folder will be permanently deleted (its branch and commits are kept) and root will switch to that branch.",
    "Depois disso, a pasta do worktree será excluída permanentemente (a branch e os commits dele são mantidos) e a raiz vai mudar para essa branch.",
  ),
  "worktreeToRootModal.confirm.copyWarning": dict(
    "The worktree itself is never touched by any of this.",
    "O worktree em si nunca é afetado por nada disso.",
  ),
  "worktreeToRootModal.confirm.doubleChecking": dict(
    "Double-checking the root folder hasn't changed since you opened this…",
    "Verificando de novo se a pasta raiz não mudou desde que você abriu isso…",
  ),
  "worktreeToRootModal.confirm.dirtyNoneTitle": dict(
    "Uncommitted files in root right now (none)",
    "Arquivos não commitados na raiz agora (nenhum)",
  ),
  "worktreeToRootModal.confirm.dirtyTitle": dict(
    "Uncommitted files in root right now — about to be stashed",
    "Arquivos não commitados na raiz agora — serão colocados no stash",
  ),

  "worktreeToRootModal.done.message": dict(
    "Done — the root folder is now on the worktree's branch, with full history preserved.",
    "Concluído — a pasta raiz agora está na branch do worktree, com todo o histórico preservado.",
  ),
  "worktreeToRootModal.done.explanation": dict(
    "This session's transcript was tied to the worktree folder that just got removed, so it can't be resumed from this app anymore — the code itself is safe, it's just in the root folder now. Delete this now-dead card, or keep it around as a record.",
    "A transcrição desta sessão estava vinculada à pasta do worktree que acabou de ser removida, então ela não pode mais ser retomada a partir deste app — o código em si está seguro, só que agora está na pasta raiz. Exclua este card agora inativo, ou mantenha-o como registro.",
  ),

  "worktreeToRootModal.toast.openingVSCode": dict(
    "Opening the root folder in VS Code…",
    "Abrindo a pasta raiz no VS Code…",
  ),
  "worktreeToRootModal.toast.openVSCodeError": dict(
    "Could not open VS Code.",
    "Não foi possível abrir o VS Code.",
  ),
  "worktreeToRootModal.toast.stashNote": dict(
    'Root\'s previous state is saved — recover it with "git stash apply {stashRef}".',
    'O estado anterior da raiz foi salvo — recupere com "git stash apply {stashRef}".',
  ),
  "worktreeToRootModal.toast.copySuccess": dict(
    "Copied the worktree's files into the root folder.",
    "Arquivos do worktree copiados para a pasta raiz.",
  ),
  "worktreeToRootModal.toast.checkoutSuccessWithPrevious": dict(
    'Worktree removed — root switched from "{previousBranch}" to "{newBranch}".',
    'Worktree removido — a raiz mudou de "{previousBranch}" para "{newBranch}".',
  ),
  "worktreeToRootModal.toast.checkoutSuccessNoPrevious": dict(
    'Worktree removed — root switched to "{newBranch}".',
    'Worktree removido — a raiz mudou para "{newBranch}".',
  ),
  "worktreeToRootModal.toast.unexpectedFailure": dict("Unexpected failure.", "Falha inesperada."),
  "worktreeToRootModal.toast.failedPrefix": dict("Failed: {message}", "Falhou: {message}"),
  "worktreeToRootModal.stashList.title": dict(
    "Previous resets, still recoverable:",
    "Resets anteriores, ainda recuperáveis:",
  ),
  "worktreeToRootModal.stashList.copyTooltip": dict(
    'Copy "git stash apply" for this one',
    'Copiar "git stash apply" para este',
  ),
  "worktreeToRootModal.stashList.copiedTooltip": dict("Copied!", "Copiado!"),
  "worktreeToRootModal.stashList.copyError": dict(
    "Could not copy to clipboard.",
    "Não foi possível copiar.",
  ),

  "resetRootConfirmModal.title": dict("Reset root", "Resetar raiz"),
  "resetRootConfirmModal.confirmLabel": dict("Reset root", "Resetar raiz"),
  "resetRootConfirmModal.cancel": dict("Cancel", "Cancelar"),
  "resetRootConfirmModal.warningIntro": dict(
    "Stashes (recoverable via",
    "Coloca no stash (recuperável via",
  ),
  "resetRootConfirmModal.warningMiddle": dict(
    ") then clears every uncommitted change in the root folder. The branch it's on doesn't change, and nothing gitignored (like",
    ") e então limpa todas as alterações não commitadas na pasta raiz. A branch em que ela está não muda, e nada ignorado pelo git (como",
  ),
  "resetRootConfirmModal.warningEnd": dict(") is touched.", ") é tocado."),
  "resetRootConfirmModal.loading": dict("Reading the root folder…", "Lendo a pasta raiz…"),
  "resetRootConfirmModal.statusErrorFallback": dict(
    "Could not read the root folder's status.",
    "Não foi possível ler o status da pasta raiz.",
  ),
  "resetRootConfirmModal.branchPrefix": dict(
    "Root folder is on branch",
    "A pasta raiz está na branch",
  ),
  "resetRootConfirmModal.detachedHead": dict("(detached HEAD)", "(HEAD destacado)"),
  "resetRootConfirmModal.dirtyNoneTitle": dict(
    "Uncommitted files right now (none)",
    "Arquivos não commitados agora (nenhum)",
  ),
  "resetRootConfirmModal.dirtyTitle": dict(
    "Uncommitted files right now — about to be stashed",
    "Arquivos não commitados agora — serão colocados no stash",
  ),
  "resetRootConfirmModal.toast.resetWithStash": dict(
    'Root folder reset. Previous changes saved — recover with "git stash apply {stashRef}".',
    'Pasta raiz resetada. As alterações anteriores foram salvas — recupere com "git stash apply {stashRef}".',
  ),
  "resetRootConfirmModal.toast.resetClean": dict(
    "Root folder was already clean — nothing to reset.",
    "A pasta raiz já estava limpa — nada para resetar.",
  ),
  "resetRootConfirmModal.toast.resetErrorFallback": dict(
    "Could not reset the root folder.",
    "Não foi possível resetar a pasta raiz.",
  ),

  "resumeConflictModal.title.selfConflict": dict(
    "This session is already open elsewhere",
    "Esta sessão já está aberta em outro lugar",
  ),
  "resumeConflictModal.title.otherConflict": dict(
    "Another session is active here",
    "Outra sessão está ativa aqui",
  ),
  "resumeConflictModal.intro.selfConflict": dict(
    "This exact session is already open in another terminal. Resuming it again here would start a second Claude process against the same transcript at once.",
    "Esta mesma sessão já está aberta em outro terminal. Retomá-la aqui de novo iniciaria um segundo processo do Claude contra a mesma transcrição ao mesmo tempo.",
  ),
  "resumeConflictModal.intro.otherConflictSuffix": dict(
    "is currently active in this project's folder. Resuming here too would put two Claude processes in the same working tree at once.",
    "está ativa agora nesta pasta do projeto. Retomar aqui também colocaria dois processos do Claude na mesma working tree ao mesmo tempo.",
  ),
  "resumeConflictModal.intro.pickOption": dict(
    "Pick one of the options below instead.",
    "Escolha uma das opções abaixo.",
  ),

  "resumeConflictModal.worktree.title": dict(
    "Create a worktree (recommended)",
    "Criar um worktree (recomendado)",
  ),
  "resumeConflictModal.worktree.bodyPrefix": dict("Starts a fresh", "Inicia uma conversa nova do"),
  "resumeConflictModal.worktree.bodyMiddle": dict(
    "conversation in a separate checkout of this project —",
    "em um checkout separado deste projeto —",
  ),
  "resumeConflictModal.worktree.selfTerminalLabel": dict(
    "the terminal that already has this session open",
    "o terminal que já tem esta sessão aberta",
  ),
  "resumeConflictModal.worktree.otherSessionLabel": dict(
    "the active session above",
    "a sessão ativa acima",
  ),
  "resumeConflictModal.worktree.bodySuffix": dict(
    "keeps running untouched. It won't resume this specific transcript (the CLI can't do that from a different folder), just a new one alongside it.",
    "continua rodando sem ser afetado. Isso não vai retomar esta transcrição específica (a CLI não consegue fazer isso a partir de uma pasta diferente), só inicia uma nova ao lado dela.",
  ),
  "resumeConflictModal.worktree.namePlaceholder": dict(
    "Worktree name, e.g. my-task",
    "Nome do worktree, ex.: minha-tarefa",
  ),
  "resumeConflictModal.worktree.createButton": dict("Create", "Criar"),

  "resumeConflictModal.stop.titleSelf": dict(
    "Stop the other terminal & continue here",
    "Parar o outro terminal e continuar aqui",
  ),
  "resumeConflictModal.stop.titleOther": dict(
    "Stop the other session & continue here",
    "Parar a outra sessão e continuar aqui",
  ),
  "resumeConflictModal.stop.bodySelf": dict(
    "Ends this session's other terminal process",
    "Encerra o outro processo de terminal desta sessão",
  ),
  "resumeConflictModal.stop.bodyOtherPrefix": dict("Ends", "Encerra o processo do terminal de"),
  "resumeConflictModal.stop.bodyOtherSuffix": dict("'s terminal process", ""),
  "resumeConflictModal.stop.bodyCommon": dict(
    ", checks out the branch below in this shared folder, then resumes this session there. Anything that terminal hadn't saved or committed yet can be lost — only do this if you're sure it's safe to interrupt.",
    ", faz checkout da branch abaixo nessa pasta compartilhada e então retoma esta sessão ali. Qualquer coisa que aquele terminal ainda não tivesse salvo ou commitado pode ser perdida — só faça isso se tiver certeza de que é seguro interromper.",
  ),
  "resumeConflictModal.stop.branchPlaceholder": dict(
    "Branch to check out",
    "Branch para fazer checkout",
  ),
  "resumeConflictModal.stop.confirmButton": dict("Stop & continue", "Parar e continuar"),
  "resumeConflictModal.cancel": dict("Cancel", "Cancelar"),

  "settings.jenkinsBaseUrl.title": dict("Jenkins base URL", "URL base do Jenkins"),
  "settings.jenkinsBaseUrl.description": dict(
    "Your team's Jenkins, used by the Jenkins button on session cards. Empty = button hidden.",
    "O Jenkins do seu time, usado pelo botão do Jenkins nos cards de sessão. Vazio = botão escondido.",
  ),
  "settings.envPreviews.title": dict("env/* preview links", "Links de preview de env/*"),
  "settings.envPreviews.description": dict(
    'Preview sites an env/* branch deploys, per project folder name, shown in the Jenkins modal. JSON: { "<project>": [{ "label": "BR", "url": "http://{env}.example.com/" }] } — {env} becomes the branch slug (env/PROJ-1 → env-proj-1).',
    'Sites de preview que uma branch env/* publica, por nome da pasta do projeto, mostrados no modal do Jenkins. JSON: { "<projeto>": [{ "label": "BR", "url": "http://{env}.example.com/" }] } — {env} vira o slug da branch (env/PROJ-1 → env-proj-1).',
  ),
  "settings.envPreviews.preview": dict(
    "{count} project(s): {projects}",
    "{count} projeto(s): {projects}",
  ),
  "settings.envPreviews.invalid": dict(
    "Invalid JSON or shape — expected an object of { label, url } lists.",
    "JSON ou formato inválido — esperado um objeto de listas { label, url }.",
  ),
  "settings.preview.notUsed": dict("not used", "não usado"),
  "settings.skillsHub.noRepo": dict("repo not configured", "repo não configurado"),
  "settings.skillsHub.title": dict("Team skills", "Skills do time"),
  "settings.skillsHub.description": dict(
    'Your team\'s shared Claude skills: for each skill you select in the repo, the app creates a shortcut (symlink) to it in {dir}, where Claude loads skills from. Updated by "Update now" and, if enabled, when the app starts.',
    'Skills do Claude compartilhadas pelo time: pra cada skill que você seleciona no repo, o app cria um atalho (link simbólico) dela em {dir}, que é de onde o Claude carrega as skills. Atualizadas pelo "Atualizar agora" e, se ligado, ao iniciar o app.',
  ),
  "settings.skillsHubAutoUpdate.title": dict(
    "Update team skills on start",
    "Atualizar skills do time ao iniciar",
  ),
  "settings.skillsHubAutoUpdate.description": dict(
    "Every time the app starts, updates the skills clone in the background (only a fast-forward when it's clean — never forces anything) and links new skills.",
    "Toda vez que o app inicia, atualiza o clone de skills em background (só fast-forward quando está limpo — nunca força nada) e linka as skills novas.",
  ),
  "settings.skillsHub.repoUrlTitle": dict("Team skills repo", "Repo das skills do time"),
  "settings.skillsHub.repoUrlDescription": dict(
    "Where your team's skills repo comes from (git URL) and where its clone lives on this machine. Leave the git URL empty if your team doesn't use one.",
    "De onde vem o repo de skills do time (URL git) e onde o clone dele fica nesta máquina. Deixe a URL git vazia se o seu time não usa.",
  ),
  "settings.skillsHub.repoUrlLabel": dict(
    "Git URL (the one you'd pass to git clone)",
    "URL git (a mesma que você passaria pro git clone)",
  ),
  "settings.skillsHub.pathLabel": dict("Local clone folder", "Pasta do clone nesta máquina"),
  "settings.skillsHub.pathHint": dict(
    "Empty = found automatically in your repos folder. It must be a clone of the repo above.",
    "Vazio = encontrado automaticamente na sua pasta de repositórios. Precisa ser um clone do repo acima.",
  ),
  "settings.skillsHub.pathDetected": dict(
    "Empty = auto-detect (currently found at {path}). It must be a clone of the repo above.",
    "Vazio = detectar automaticamente (encontrado agora em {path}). Precisa ser um clone do repo acima.",
  ),
  "settings.skillsHub.noCatalogs": dict("no catalogs chosen", "nenhum catálogo escolhido"),
  "settings.skillsHub.notInstalled": dict("not installed", "não instalado"),
  "skillsHub.manage.openFolder": dict("Open skills in file manager", "Abrir skills no explorador"),
  "skillsHub.manage.openHub": dict(
    "Team skills repo (git clone)",
    "Repo de skills do time (clone git)",
  ),
  "skillsHub.manage.openUserSkills": dict(
    "This machine's skills folder (where they're linked)",
    "Pasta de skills desta máquina (onde ficam linkadas)",
  ),
  "skillsHub.manage.openFolderError": dict(
    "Couldn't open the folder.",
    "Não deu pra abrir a pasta.",
  ),
  "skillsHub.autoDetect": dict("Auto-detect", "Detectar automaticamente"),
  "skillsHub.catalogsApplied": dict(
    "Selection applied: {linked} linked, {unlinked} removed.",
    "Seleção aplicada: {linked} linkadas, {unlinked} removidas.",
  ),
  "skillsHub.catalogsApplyError": dict(
    "Couldn't apply the selection.",
    "Não foi possível aplicar a seleção.",
  ),
  "skillsHub.cloned": dict(
    "Skills hub cloned. Now choose your catalogs.",
    "Hub de skills clonado. Agora escolha seus catálogos.",
  ),
  "skillsHub.cloneError": dict(
    "Couldn't clone the skills hub.",
    "Não foi possível clonar o hub de skills.",
  ),
  "skillsHub.configuredPathInvalid": dict(
    "The folder saved in the preferences isn't a clone of the skills hub anymore — clone it again or point to the right folder.",
    "A pasta salva nas preferências não é mais um clone do hub de skills — clone de novo ou aponte a pasta certa.",
  ),
  "skillsHub.copy": dict("Copy", "Copiar"),
  "skillsHub.copyFailed": dict("Couldn't copy to the clipboard.", "Não foi possível copiar."),
  "skillsHub.install.cloneButton": dict("Clone into {target}", "Clonar em {target}"),
  "skillsHub.install.cloneTitle": dict("Clone it with one click", "Clone com um clique"),
  "skillsHub.install.existingTitle": dict(
    "Already have it cloned somewhere else?",
    "Já tem clonado em outra pasta?",
  ),
  "skillsHub.install.manualBody": dict(
    "If the clone fails (e.g. no SSH key for the repo's host), run this in a terminal, then reopen this window:",
    "Se o clone falhar (ex.: sem chave SSH no host do repo), rode isto num terminal e depois reabra esta janela:",
  ),
  "skillsHub.install.manualTitle": dict("Or clone it by hand", "Ou clone na mão"),
  "skillsHub.install.openRepo": dict("Open the repo in the browser", "Abrir o repo no navegador"),
  "skillsHub.install.sshNote": dict(
    "Uses your own access (SSH key) to the repo's host.",
    "Usa o seu próprio acesso (chave SSH) ao host do repo.",
  ),
  "skillsHub.invite.body": dict(
    "The skills repo is where your team keeps reusable Claude skills. Once it's cloned, you pick which skills to use and the app creates a shortcut (symlink) for each selected skill from the repo into {dir} — so every Claude session on this machine can use them.",
    "O repo de skills é onde o seu time guarda skills reutilizáveis do Claude. Depois de clonado, você escolhe quais skills usar e o app cria um atalho (link simbólico) de cada skill selecionada do repo para {dir} — assim toda sessão do Claude nesta máquina pode usá-las.",
  ),
  "skillsHub.invite.optional": dict(
    "Optional — tasks work the same without it.",
    "Opcional — as tarefas funcionam igual sem ele.",
  ),
  "skillsHub.invite.title": dict("Use the team's Claude skills", "Use as skills do Claude do time"),
  "skillsHub.loadError": dict(
    "Couldn't read the skills status.",
    "Não foi possível ler o status das skills.",
  ),
  "skillsHub.loading": dict("Checking the skills hub…", "Verificando o hub de skills…"),
  "skillsHub.manage.ahead": dict(
    "{count} local commit(s) not pushed",
    "{count} commit(s) local(is) sem push",
  ),
  "skillsHub.manage.applyCatalogs": dict("Apply", "Aplicar"),
  "skillsHub.manage.behind": dict("{count} commit(s) behind", "{count} commit(s) atrás"),
  "skillsHub.manage.branch": dict("Branch:", "Branch:"),
  "skillsHub.manage.catalogsHelp": dict(
    "Check a catalog to take all of it (skills added to it later included), or click individual skills to pick just those. Everything picked is linked into {dir} and works in any repo/worktree.",
    "Marque um catálogo pra levar ele inteiro (incluindo skills adicionadas depois), ou clique em skills soltas pra pegar só elas. Tudo o que estiver marcado é linkado em {dir} e vale em qualquer repo/worktree.",
  ),
  "skillsHub.manage.catalogsInferred": dict(
    "Preselected from the skills you already have linked — click Apply to confirm.",
    "Pré-selecionado a partir das skills que você já tem linkadas — clique em Aplicar para confirmar.",
  ),
  "skillsHub.manage.catalogsNone": dict(
    "Check whole catalogs or click individual skills. Nothing is linked until you apply.",
    "Marque catálogos inteiros ou clique em skills soltas. Nada é linkado até você aplicar.",
  ),
  "skillsHub.manage.catalogsTitle": dict("Catalogs and skills", "Catálogos e skills"),
  "skillsHub.manage.changePath": dict("Change folder", "Trocar pasta"),
  "skillsHub.manage.changePathHint": dict(
    'The repo and the clone folder are changed in one place: the gear (Settings) in the header → "Team skills" → Edit.',
    'O repo e a pasta do clone são trocados num lugar só: na engrenagem (Configurações) do header → "Skills do time" → Editar.',
  ),
  "skillsHub.manage.detached": dict("(detached)", "(detached)"),
  "skillsHub.manage.dirty": dict("local changes", "mudanças locais"),
  "skillsHub.manage.duplicates": dict(
    "Same skill name in more than one checked catalog: {names} — only the first catalog's is linked.",
    "Mesmo nome de skill em mais de um catálogo marcado: {names} — só a do primeiro catálogo é linkada.",
  ),
  "skillsHub.manage.intro": dict(
    "For each skill selected below, the app creates a shortcut (symlink) from its folder in the skills repo to {dir}, which is where Claude looks for skills. Nothing is copied: updating the repo updates the linked skills too. The clone is never reset or forced — only fetch + fast-forward when it's clean.",
    "Pra cada skill selecionada abaixo, o app cria um atalho (link simbólico) da pasta dela no repo de skills para {dir}, que é onde o Claude procura as skills. Nada é copiado: atualizar o repo já atualiza as skills linkadas. O clone nunca é resetado nem forçado — só fetch + fast-forward quando está limpo.",
  ),
  "skillsHub.manage.newSessionsNote": dict(
    "Claude loads skills when a session starts — sessions already open only see new skills after a restart.",
    "O Claude carrega as skills quando a sessão começa — sessões já abertas só veem skills novas depois de reiniciar.",
  ),
  "skillsHub.manage.notDefaultBranch": dict(
    "The clone is not on {defaultBranch}: you get this branch's skills, and updates follow its own upstream.",
    "O clone não está na {defaultBranch}: você usa as skills desta branch, e as atualizações seguem o upstream dela.",
  ),
  "skillsHub.manage.syncNow": dict("Update now", "Atualizar agora"),
  "skillsHub.modal.title": dict("Team skills", "Skills do time"),
  "skillsHub.panel.choose": dict("Choose", "Escolher"),
  "skillsHub.panel.chooseCatalogs": dict(
    "Skills hub found — pick your team's catalog(s) or individual skills to use them in your tasks.",
    "Hub de skills encontrado — escolha catálogo(s) do seu time ou skills soltas pra usar nas tarefas.",
  ),
  "skillsHub.panel.conflicts": dict("{count} name conflict(s)", "{count} conflito(s) de nome"),
  "skillsHub.panel.inviteShort": dict(
    "Clone your team's skills repo and pick which skills to use — the app creates a shortcut to each one in {dir}.",
    "Clone o repo de skills do time e escolha quais skills usar — o app cria um atalho de cada uma em {dir}.",
  ),
  "skillsHub.panel.manage": dict("Manage", "Gerenciar"),
  "skillsHub.panel.offDefault": dict("hub on {branch}", "hub na {branch}"),
  "skillsHub.panel.pending": dict(
    "{count} new to link — update in Manage",
    "{count} nova(s) a linkar — atualize em Gerenciar",
  ),
  "skillsHub.panel.setup": dict("Set up", "Configurar"),
  "skillsHub.panel.summary": dict(
    "Skills: {count} linked ({catalogs})",
    "Skills: {count} linkadas ({catalogs})",
  ),
  "skillsHub.pathSaved": dict("Skills hub folder saved.", "Pasta do hub de skills salva."),
  "skillsHub.pathSaveError": dict("Couldn't use that folder.", "Não foi possível usar essa pasta."),
  "skillsHub.state.broken": dict("broken link", "link quebrado"),
  "skillsHub.state.conflict": dict("conflict", "conflito"),
  "skillsHub.state.linked": dict("linked", "linkada"),
  "skillsHub.state.missing": dict("new", "nova"),
  "skillsHub.sync.conflicts": dict(
    "not linked (name already taken): {names}",
    "não linkadas (nome já usado): {names}",
  ),
  "skillsHub.syncError": dict(
    "Couldn't update the skills.",
    "Não foi possível atualizar as skills.",
  ),
  "skillsHub.sync.fetchFailed": dict(
    "couldn't reach the repo's host (offline or no SSH access) — using the local version",
    "sem acesso ao host do repo (offline ou sem SSH) — usando a versão local",
  ),
  "skillsHub.sync.linked": dict("linked: {names}", "linkadas: {names}"),
  "skillsHub.sync.pulled": dict("updated (+{count} commit(s))", "atualizado (+{count} commit(s))"),
  "skillsHub.sync.skippedDirty": dict(
    "update available but not applied: the clone has local changes",
    "atualização disponível mas não aplicada: o clone tem mudanças locais",
  ),
  "skillsHub.sync.skippedDiverged": dict(
    "update available but not applied: the branch has local commits (diverged)",
    "atualização disponível mas não aplicada: a branch tem commits locais (divergiu)",
  ),
  "skillsHub.sync.skippedFailed": dict(
    "update available but the fast-forward failed",
    "atualização disponível mas o fast-forward falhou",
  ),
  "skillsHub.sync.upToDate": dict("already up to date", "já atualizado"),
  "skillsHub.usePath": dict("Use this folder", "Usar esta pasta"),
  "skillsHub.repoUrl.title": dict("Skills hub repo", "Repo do hub de skills"),
  "skillsHub.repoUrl.body": dict(
    "Clone URL of your team's skills repo (a git repo with a catalog/ folder). Stored only in your local userPreferences.json.",
    "URL de clone do repo de skills do seu time (um repo git com uma pasta catalog/). Fica só no seu userPreferences.json local.",
  ),
  "skillsHub.repoUrl.detected": dict(
    "Detected from your existing clone — save to confirm.",
    "Detectado do clone que você já tem — salve para confirmar.",
  ),
  "skillsHub.repoUrl.save": dict("Save", "Salvar"),
  "skillsHub.repoUrl.saved": dict("Skills hub repo saved.", "Repo do hub de skills salvo."),
  "skillsHub.repoUrl.saveError": dict(
    "Couldn't save the repo URL.",
    "Não foi possível salvar a URL do repo.",
  ),
  "apiError.skillsHubRepoUrlMissing": dict(
    "The skills hub repo URL isn't set.",
    "A URL do repo do hub de skills não está configurada.",
  ),
  "apiError.skillsFolderOpenFailed": dict(
    "Couldn't open the folder in the file manager (xdg-open not available?).",
    "Não deu pra abrir a pasta no explorador de arquivos (xdg-open indisponível?).",
  ),
  "apiError.skillsHubNotFound": dict(
    "Skills hub clone not found.",
    "Clone do hub de skills não encontrado.",
  ),
  "apiError.skillsHubInvalidPath": dict(
    "That folder isn't a clone of the configured skills hub (needs a catalog/ folder and the configured repo as origin).",
    "Essa pasta não é um clone do hub de skills configurado (precisa ter a pasta catalog/ e o repo configurado como origin).",
  ),
  "apiError.skillsHubCloneParentMissing": dict(
    "The destination folder doesn't exist.",
    "A pasta de destino não existe.",
  ),
  "apiError.skillsHubCloneTargetExists": dict(
    "There's already a folder with that name there (and it isn't the hub).",
    "Já existe uma pasta com esse nome ali (e ela não é o hub).",
  ),
  "apiError.skillsDirUnwritable": dict(
    "Couldn't create Claude's skills folder (~/.claude/skills).",
    "Não foi possível criar a pasta de skills do Claude (~/.claude/skills).",
  ),
  "skillsHub.manage.syncHelp": dict(
    '"Update now" runs git fetch, fast-forwards the clone when it\'s clean, and creates shortcuts in {dir} for new skills. It also runs on its own when the app starts, if enabled in Settings.',
    '"Atualizar agora" roda git fetch, avança o clone (fast-forward) quando está limpo e cria os atalhos das skills novas em {dir}. Também roda sozinho quando o app inicia, se estiver ligado na Configuração.',
  ),
  "skillsHub.panel.behind": dict(
    "hub {count} commit(s) behind — update it in Manage",
    "hub {count} commit(s) atrás — atualize em Gerenciar",
  ),
  "skillsHub.manage.wholeCatalog": dict(
    "whole catalog · {count} skill(s), new ones included",
    "catálogo inteiro · {count} skill(s), incluindo as novas",
  ),
  "skillsHub.manage.pickedCount": dict(
    "{picked} of {count} skill(s)",
    "{picked} de {count} skill(s)",
  ),
  "skillsHub.preview.open": dict("Show the content of {name}", "Ver o conteúdo de {name}"),
  "skillsHub.preview.noDescription": dict("No description.", "Sem descrição."),
  "skillsHub.preview.whenUsed": dict("When Claude uses it", "Quando o Claude usa"),
  "skillsHub.preview.requires": dict("Depends on:", "Depende de:"),
  "skillsHub.preview.files": dict("Files that come with it", "Arquivos que vêm junto"),
  "skillsHub.preview.loadError": dict(
    "Couldn't read this skill.",
    "Não foi possível ler esta skill.",
  ),
  "apiError.skillNotFound": dict(
    "Skill not found in the skills hub (maybe removed by the last update).",
    "Skill não encontrada no hub de skills (talvez removida na última atualização).",
  ),
} satisfies Record<string, Dict>;

export type TranslationKey = keyof typeof translations;

/** `params` fills `{name}` placeholders — plain substitution, no plural rules (use separate
 *  keys for singular/plural). */
export function t(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = translations[key][language];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}
