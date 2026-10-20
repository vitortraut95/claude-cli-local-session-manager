import { dict } from "../dict";

export const taskQueue = {
  "header.taskQueue": dict("Task queue", "Fila de tarefas"),
  "taskQueueModal.title": dict("Task queue", "Fila de tarefas"),
  "taskQueueModal.intro": dict(
    'Paste the tasks that are ready to be worked on and pick the repo of each one (the first is the main one; any other joins the same session). Once saved, each task is launched like "New task" — its own worktree, the default prompt, a new terminal — one at a time while there\'s room.',
    'Cole as tarefas que já podem ser feitas e escolha o repo de cada uma (o primeiro é o principal; os outros entram na mesma sessão). Depois de salvar, cada tarefa é lançada como na "Nova tarefa" — worktree próprio, prompt padrão, terminal novo — uma por vez enquanto houver espaço.',
  ),
  "taskQueueModal.pasteLabel": dict(
    "Tasks (links or keys, one per line)",
    "Tarefas (links ou chaves, uma por linha)",
  ),
  "taskQueueModal.pastePlaceholder": dict(
    "https://your-company.atlassian.net/browse/PROJ-123\nPROJ-124",
    "https://sua-empresa.atlassian.net/browse/PROJ-123\nPROJ-124",
  ),
  "taskQueueModal.pasteRepo": dict(
    "Repo for the pasted tasks (optional)",
    "Repo das tarefas coladas (opcional)",
  ),
  "taskQueueModal.pasteRepoNone": dict("Choose later, per task", "Escolher depois, por tarefa"),
  "taskQueueModal.add": dict("Add to the list", "Adicionar à lista"),
  "taskQueueModal.added": dict("{count} task(s) added.", "{count} tarefa(s) adicionada(s)."),
  "taskQueueModal.noneFound": dict(
    "No task key found in the pasted text.",
    "Nenhuma chave de tarefa encontrada no texto colado.",
  ),
  "taskQueueModal.alreadyListed": dict(
    "Already in the list: {keys}",
    "Já estavam na lista: {keys}",
  ),
  "taskQueueModal.listTitle": dict("Tasks ({count})", "Tarefas ({count})"),
  "taskQueueModal.empty": dict("No task in the queue yet.", "Nenhuma tarefa na fila ainda."),
  "taskQueueModal.loading": dict("Loading the queue…", "Carregando a fila…"),
  "taskQueueModal.loadError": dict("Couldn't load the queue.", "Não foi possível carregar a fila."),
  "taskQueueModal.missingRepo": dict("Choose a repo", "Escolha um repo"),
  "taskQueueModal.missingSetupCount": dict(
    "{count} task(s) still without a repo or branch prefix — they won't launch.",
    "{count} tarefa(s) ainda sem repo ou prefixo de branch — não serão lançadas.",
  ),
  "taskQueueModal.pastePrefix": dict(
    "Branch prefix for the pasted tasks",
    "Prefixo da branch das tarefas coladas",
  ),
  "taskQueueModal.prefixAriaLabel": dict("Branch prefix", "Prefixo da branch"),
  "taskQueueModal.prefixUnset": dict("Choose a prefix…", "Escolha o prefixo…"),
  "taskQueueModal.prefixNone": dict("No prefix (just the key)", "Sem prefixo (só a chave)"),
  "taskQueueModal.branchLabel": dict("Branch:", "Branch:"),
  "taskQueueModal.missingPrefix": dict("Choose the prefix", "Escolha o prefixo"),
  "taskQueueModal.mainRepo": dict("main", "principal"),
  "taskQueueModal.addRepo": dict("+ repo", "+ repo"),
  "taskQueueModal.removeRepo": dict("Remove repo", "Remover repo"),
  "taskQueueModal.removeTask": dict("Remove from the queue", "Remover da fila"),
  "taskQueueModal.clear": dict("Clear list", "Limpar lista"),
  "taskQueueModal.state.waiting": dict("In line", "Na fila"),
  "taskQueueModal.state.launching": dict("Opening…", "Abrindo…"),
  "taskQueueModal.state.launched": dict("Launched {time}", "Lançada {time}"),
  "taskQueueModal.state.failed": dict("Failed", "Falhou"),
  "taskQueueModal.retry": dict("Try again", "Tentar de novo"),
  "taskQueueModal.extraRepoFailed": dict(
    "Launched without an extra repo: {message}",
    "Lançada sem um repo extra: {message}",
  ),
  "taskQueueModal.removeLaunched": dict("Remove launched ({count})", "Remover lançadas ({count})"),
  "scheduler.title.running": dict("Automatic launch on", "Lançamento automático ligado"),
  "scheduler.title.paused": dict("Automatic launch paused", "Lançamento automático pausado"),
  "scheduler.pause": dict("Pause", "Pausar"),
  "scheduler.resume": dict("Resume", "Retomar"),
  "scheduler.runNow": dict("Check now", "Verificar agora"),
  "scheduler.idle": dict("Nothing waiting in the queue.", "Nada esperando na fila."),
  "scheduler.ready": dict(
    "{count} task(s) ready — launching as soon as there's room.",
    "{count} tarefa(s) pronta(s) — lançando assim que houver espaço.",
  ),
  "scheduler.launching": dict("Opening {key}…", "Abrindo {key}…"),
  "scheduler.blocked.paused": dict(
    "Paused — nothing new starts until you resume.",
    "Pausado — nada novo começa até você retomar.",
  ),
  "scheduler.blocked.maxSessions": dict(
    "Waiting: the session limit is reached — close a finished session to free a slot.",
    "Aguardando: limite de sessões atingido — feche uma sessão terminada pra liberar vaga.",
  ),
  "scheduler.blocked.lowMemory": dict(
    "Waiting: free RAM is below the minimum.",
    "Aguardando: RAM livre abaixo do mínimo.",
  ),
  "scheduler.blocked.memoryPressure": dict(
    "Waiting: the machine is under memory pressure right now.",
    "Aguardando: a máquina está sob pressão de memória agora.",
  ),
  "scheduler.blocked.usageLimit": dict(
    "Waiting: the Claude plan usage is above the limit.",
    "Aguardando: o uso do plano Claude está acima do limite.",
  ),
  "scheduler.metric.sessions": dict("Sessions: {active}/{max}", "Sessões: {active}/{max}"),
  "scheduler.metric.memory": dict(
    "Free RAM: {free}% (min. {min}%)",
    "RAM livre: {free}% (mín. {min}%)",
  ),
  "scheduler.metric.usage": dict(
    "Plan usage: {used}% (max. {max}%)",
    "Uso do plano: {used}% (máx. {max}%)",
  ),
  "scheduler.setting.maxSessions": dict("Max sessions at once", "Máx. de sessões simultâneas"),
  "scheduler.setting.minFreeMemory": dict("Min. free RAM (%)", "RAM livre mínima (%)"),
  "scheduler.setting.maxUsage": dict("Max. plan usage (%)", "Uso máx. do plano (%)"),
  "scheduler.explanation": dict(
    "Every live claude session counts, including ones you opened by hand. Tasks always run in their own worktree; bringing one to the root to test locally is done from its card, one task per repo at a time.",
    "Toda sessão claude ativa conta, inclusive as que você abriu à mão. As tarefas sempre rodam em worktree próprio; levar uma pra raiz pra testar localmente é feito pelo card dela, uma tarefa por repo de cada vez.",
  ),
  "scheduler.saveError": dict(
    "Couldn't save the scheduler settings.",
    "Não foi possível salvar as configurações do agendador.",
  ),
  "taskQueueModal.save": dict("Save queue", "Salvar fila"),
  "taskQueueModal.saved": dict("Queue saved.", "Fila salva."),
  "taskQueueModal.saveError": dict(
    "Couldn't save the queue: {message}",
    "Não foi possível salvar a fila: {message}",
  ),
};
