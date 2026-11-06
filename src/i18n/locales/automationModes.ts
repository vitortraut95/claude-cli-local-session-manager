import { dict } from "../dict";

/** The automations as cards, each on or off (`AutomationModesEditor`). */
export const automationModes = {
  "automationModes.title": dict("Automations", "Automações"),
  "automationModes.intro": dict(
    "Each automation is on or off. On, it acts for real, in your name, and tells you on Teams.",
    "Cada automação está ligada ou desligada. Ligada, ela age de verdade, no seu nome, e avisa no Teams.",
  ),
  "automationModes.on": dict("On", "Ligado"),
  "automationModes.off": dict("Off", "Desligado"),
  "automationModes.unavailable": dict("Not available: {reason}", "Indisponível: {reason}"),

  "automationModes.codeReview.title": dict(
    "Code review of colleagues' PRs",
    "Code review dos PRs de colegas",
  ),
  "automationModes.codeReview.description": dict(
    "Reviews each colleague's PR once with AI when its ticket reaches Code Review, whoever is listed as reviewer. The first teammate's automation to get there posts a marker comment, and nobody's automation reviews that PR again. It posts the findings and approves when nothing blocks.",
    "Revisa com IA cada PR de colega uma vez, quando a tarefa chega em Code Review, independente de quem está como revisor. A automação do primeiro colega a chegar lá posta um comentário marcador, e nenhuma automação revisa esse PR de novo. Posta os achados e aprova quando nada bloqueia.",
  ),
  "automationModes.codeReview.note": dict(
    "In your name. Style details and small suggestions are never posted. No approval if the PR got a push after the review.",
    "No seu nome. Detalhes de estilo e sugestões pequenas nunca são postados. Não aprova se o PR recebeu push depois do review.",
  ),
  "automationModes.codeReview.unapproved": dict(
    "Also PRs with no approval in Validation / Wait Deploy",
    "Também PRs sem aprovação em Validation / Wait Deploy",
  ),
  "automationModes.codeReview.unapproved.help": dict(
    "Colleagues' PRs nobody approved whose ticket is already past Code Review.",
    "PRs de colegas que ninguém aprovou e cuja tarefa já passou do Code Review.",
  ),

  "automationModes.devQueue.title": dict("My To Do tasks", "Minhas tarefas de To Do"),
  "automationModes.devQueue.description": dict(
    "Puts your To Do tasks with a good description in the app's development queue, one at a time.",
    "Coloca as suas tarefas de To Do com boa descrição na fila de desenvolvimento do app, uma de cada vez.",
  ),
  "automationModes.devQueue.note": dict(
    "Adds them to the app's queue (only you see it) and moves the one you started to In Progress on the board. Only one of your tasks is In Progress at a time; the others wait in To Do. With no repo in the task, it waits for you to pick one.",
    "Adiciona na fila do app (só você vê) e move pra In Progress no board a que você começou. Só uma tarefa sua fica em In Progress por vez; as outras esperam em To Do. Sem repositório citado na tarefa, espera você escolher.",
  ),

  "automationModes.testQueue.title": dict("Tests in Wait Test", "Testes em Wait Test"),
  "automationModes.testQueue.description": dict(
    "Picks up colleagues' Wait Test tasks that have a test plan and puts them in the test queue.",
    "Pega tarefas de colegas em Wait Test com plano de teste e coloca na fila de teste.",
  ),
  "automationModes.testQueue.note": dict(
    "Moves the card from Wait Test to Testing in Jira when it picks the test up (the team sees it).",
    "Move o card de Wait Test pra Testing no Jira quando pega o teste (o time vê).",
  ),

  "automationModes.rebuild.title": dict("Run a build again", "Rodar build de novo"),
  "automationModes.rebuild.description": dict(
    "When a preview build of yours (or of a test it picked up) fails, it reads the Jenkins log. If it's an infra failure (agent down, network or registry timeout, cache, no disk space) or the cause isn't clear, it runs the build again. A code failure (test, lint, types) isn't run again: you only get the diagnosis.",
    "Quando um build de preview seu (ou de um teste que ele pegou) falha, ele lê o log do Jenkins. Se for falha de infra (agente fora, timeout de rede ou registry, cache, falta de espaço) ou a causa não estiver clara, roda o build de novo. Falha de código (teste, lint, tipos) não roda de novo: você só recebe o diagnóstico.",
  ),
  "automationModes.rebuild.note": dict(
    "Runs it again in Jenkins at most once per commit. If it fails again on the same commit, it stops and tells you.",
    "Roda de novo no Jenkins no máximo uma vez por commit. Se falhar de novo no mesmo commit, ele para e te avisa.",
  ),

  "automationModes.notices.title": dict("Notices on Teams", "Avisos no Teams"),
  "automationModes.notices.description": dict(
    "Messages to you on Teams.",
    "Mensagens pra você no Teams.",
  ),
  "automationModes.notices.instant": dict("Right away", "Na hora"),
  "automationModes.notices.instant.help": dict(
    "Test finished, a review with no approval, failures, a pause.",
    "Teste terminado, review sem aprovação, falhas, pausa.",
  ),
  "automationModes.notices.digest": dict(
    "Digest when business hours start and 10 minutes before they end",
    "Resumo no começo do horário e 10 minutos antes de ele acabar",
  ),
};
