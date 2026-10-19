import { dict } from "../dict";

export const settings = {
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
};
