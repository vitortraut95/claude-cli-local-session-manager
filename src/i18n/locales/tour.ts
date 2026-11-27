import { dict } from "../dict";

/** The welcome tour. */
export const tour = {
  "tour.label": dict("Welcome tour", "Tour de boas-vindas"),
  "tour.step": dict("{current} of {total}", "{current} de {total}"),
  "tour.next": dict("Next", "Próximo"),
  "tour.back": dict("Back", "Voltar"),
  "tour.skip": dict("Skip tour", "Pular o tour"),
  "tour.done": dict("Done", "Concluir"),
  "tour.show": dict("Show me", "Mostrar"),
  "tour.welcome.title": dict("Welcome to the Session Manager", "Boas-vindas ao Session Manager"),
  "tour.welcome.body": dict(
    "Your Claude CLI sessions, tasks and automations in one place, with navigation on the left. This one-minute tour shows where everything is.",
    "Suas sessões do Claude CLI, tarefas e automações num lugar só, com a navegação à esquerda. Este tour de um minuto mostra onde fica cada coisa.",
  ),
  "tour.sessions.title": dict("What needs you comes first", "O que precisa de você vem primeiro"),
  "tour.sessions.body": dict(
    "Sessions are grouped: needs you, running, stopped; the done ones fold at the end. Click a title to open its panel with every action, without leaving the list.",
    "As sessões vêm agrupadas: precisa de você, rodando, paradas; as concluídas ficam recolhidas no fim. Clique num título para abrir o painel com todas as ações, sem sair da lista.",
  ),
  "tour.newTask.title": dict("Every task starts in the queue", "Toda tarefa começa pela fila"),
  "tour.newTask.body": dict(
    "“+ New task” (or N) opens the task queue's form: paste the Jira links and pick the repo. The queue creates the branch and the worktree and opens Claude with the team's prompt.",
    "“+ Nova tarefa” (ou N) abre o formulário da fila de tarefas: cole os links do Jira e escolha o repo. A fila cria a branch e o worktree e abre o Claude com o prompt do time.",
  ),
  "tour.queue.title": dict("Queue the ready tasks", "Enfileire as tarefas prontas"),
  "tour.queue.body": dict(
    "Paste several tasks and the scheduler opens one at a time when there's room: sessions, memory and plan usage.",
    "Cole várias tarefas e o agendador abre uma de cada vez quando houver vaga: sessões, memória e uso do plano.",
  ),
  "tour.board.title": dict("The Board watches the sprint", "O Board acompanha a sprint"),
  "tour.board.body": dict(
    "A beta: reviews PRs, takes tests and moves tasks, each automation on or off. Open the Board and the guided setup walks you through connecting it.",
    "Beta: revisa PRs, assume testes e move tarefas, com cada automação ligada ou desligada. Abra o Board e a configuração guiada mostra como conectar.",
  ),
  "tour.tools.title": dict("Cleanup, skills and settings", "Limpeza, skills e configurações"),
  "tour.tools.body": dict(
    "Skills sits with the pages: what Claude knows how to do on every session. Below: New session, Refine tasks and Cleanup; at the bottom, plan usage, updates and Settings.",
    "Skills fica junto das páginas: o que o Claude sabe fazer em cada sessão. Abaixo: Nova sessão, Refinar tarefas e Limpeza; no rodapé, uso do plano, atualizações e Configurações.",
  ),
};
