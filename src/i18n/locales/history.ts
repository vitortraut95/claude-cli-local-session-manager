import { dict } from "../dict";

export const history = {
  "history.open": dict("History of this task", "Histórico desta tarefa"),
  "history.title": dict("History — {name}", "Histórico — {name}"),
  "history.close": dict("Close", "Fechar"),
  "history.loading": dict("Loading the history…", "Carregando o histórico…"),
  "history.loadError": dict("Couldn't load the history.", "Não foi possível carregar o histórico."),
  "history.timeline": dict("Timeline ({count} events)", "Linha do tempo ({count} eventos)"),
  "history.errors": dict("Problems ({count})", "Problemas ({count})"),
  "history.footnote": dict(
    "From the local history.jsonl, recorded since the history was turned on. Claude's working time vs. time waiting on you comes in a next version.",
    "Do history.jsonl local, gravado desde que o histórico foi ligado. O tempo do Claude trabalhando × esperando você vem numa próxima versão.",
  ),
  "history.queueBlocks": dict(
    "While in line, the scheduler waited for: {blocks}",
    "Enquanto estava na fila, o agendador esperou por: {blocks}",
  ),
  "history.reason.paused": dict("paused queue", "fila pausada"),
  "history.reason.maxSessions": dict("session limit", "limite de sessões"),
  "history.reason.recentLaunch": dict("spacing between launches", "intervalo entre aberturas"),
  "history.reason.lowMemory": dict("free RAM", "RAM livre"),
  "history.reason.memoryPressure": dict("memory pressure", "pressão de memória"),
  "history.reason.usageLimit": dict("Claude plan usage", "uso do plano Claude"),
  "history.stat.total": dict("Until done", "Até concluir"),
  "history.stat.queued": dict("Waiting in line", "Esperando na fila"),
  "history.stat.inStatus": dict("In “{status}”", "Em “{status}”"),
  "history.stat.tests": dict("Heavy runs", "Testes pesados"),
  "history.stat.testsValue": dict(
    "{runs} ({failed} failed) · {duration}",
    "{runs} ({failed} falharam) · {duration}",
  ),
  "history.stat.testWait": dict("Tests waiting for a slot/RAM", "Testes esperando vaga/RAM"),
  "history.stat.overCap": dict("Over the memory cap", "Estouros de memória"),
  "history.stat.hookBlocks": dict("Blocked by the hook", "Barrados pelo hook"),
  "history.stat.rootHeld": dict("Holding the root", "Ocupando a raiz"),
  "history.stat.rootRefused": dict("Root refusals", "Recusas da raiz"),
  "history.event.queueAdded": dict(
    "Added to the queue (prefix {prefix})",
    "Entrou na fila (prefixo {prefix})",
  ),
  "history.event.queueUpdated": dict(
    "Repos or prefix changed in the queue",
    "Repos ou prefixo alterados na fila",
  ),
  "history.event.queueRetry": dict(
    "Retry (previous error: {error})",
    "Nova tentativa (erro anterior: {error})",
  ),
  "history.event.queueRemoved": dict("Removed from the queue", "Removida da fila"),
  "history.event.launchStarted": dict("Launch started", "Lançamento iniciado"),
  "history.event.launched": dict(
    "Session opened in {duration} — {queued} in line — branch {branch}",
    "Sessão aberta em {duration} — {queued} na fila — branch {branch}",
  ),
  "history.event.launchFailed": dict("Launch failed: {error}", "Falha ao lançar: {error}"),
  "history.event.status": dict("Status: {from} → {to}", "Status: {from} → {to}"),
  "history.event.statusByScheduler": dict(
    "Status: {from} → {to} (scheduler)",
    "Status: {from} → {to} (agendador)",
  ),
  "history.event.rootCopy": dict(
    "Took the root (files copied)",
    "Ocupou a raiz (arquivos copiados)",
  ),
  "history.event.rootCheckout": dict(
    "Took the root (branch moved there)",
    "Ocupou a raiz (branch movida)",
  ),
  "history.event.rootReleased": dict(
    "Released the root after {held}",
    "Liberou a raiz após {held}",
  ),
  "history.event.rootRefused": dict(
    "Root refused: in use by {holder}",
    "Raiz recusada: em uso pela {holder}",
  ),
  "history.event.cleanupExecuted": dict("Worktree cleaned up", "Worktree removido na limpeza"),
  "history.event.cleanupFailed": dict("Cleanup failed: {error}", "Falha na limpeza: {error}"),
  "history.event.sessionStarted": dict("Session started", "Sessão iniciada"),
  "history.event.sessionResumed": dict("Session resumed", "Sessão retomada"),
  "history.event.resumeOpen": dict(
    "Resumed by “Open grid” / “Resume open tasks”",
    "Retomada pelo “Abrir grade” / “Retomar não concluídas”",
  ),
  "history.event.heavyRun": dict(
    "{command} — waited {wait}, ran {duration}, exit {status}",
    "{command} — esperou {wait}, rodou {duration}, saída {status}",
  ),
  "history.event.heavyBlocked": dict("Hook blocked: {command}", "Hook barrou: {command}"),
  "history.event.heavyWaiting": dict("Waiting to run: {command}", "Esperando pra rodar: {command}"),
  "history.event.heavyTimeout": dict(
    "Gave up after waiting {wait}: {command}",
    "Desistiu depois de esperar {wait}: {command}",
  ),
  "history.event.heavyPreview": dict(
    "Preview: {command} — waited {wait}, exit {status}",
    "Preview: {command} — esperou {wait}, saída {status}",
  ),
};
