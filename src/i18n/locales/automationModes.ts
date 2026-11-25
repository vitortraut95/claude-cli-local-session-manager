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
  "reviewSkillModal.title": dict("Choose the code review skill", "Escolha a skill de code review"),
  "reviewSkillModal.intro": dict(
    "The code review automation is on, but no code review skill is chosen (or it isn't installed anymore). Each review the Board queues runs this skill, so they fail to launch without it. Choose one; a hub skill not installed yet is installed on the spot.",
    "A automação de code review está ligada, mas nenhuma skill de code review está escolhida (ou ela não está mais instalada). Cada review que o Board coloca na fila roda essa skill, então sem ela eles falham ao abrir. Escolha uma; uma skill do hub ainda não instalada é instalada na hora.",
  ),
  "automationModes.codeReview.skillRequired": dict(
    "Choose the code review skill to turn code review on: each review runs it in a session of the task queue.",
    "Escolha a skill de code review pra ligar o code review: cada review roda ela numa sessão da fila de tarefas.",
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
    "Digest when business hours start and shortly before they end (see Times)",
    "Resumo no começo do horário e pouco antes de ele acabar (ver Tempos)",
  ),

  "automationModes.rules": dict(
    "What holds it back (uncheck to drop the wait)",
    "O que segura (desmarque para tirar a espera)",
  ),
  "automationModes.rule.reviewWaitsForCodeReviewColumn": dict(
    "Only once the task is in Code Review",
    "Só quando a tarefa estiver em Code Review",
  ),
  "automationModes.rule.reviewWaitsForCodeReviewColumn.help": dict(
    "Off: every colleague's PR is reviewed as soon as it shows up, whatever column its task is in.",
    "Desligado: todo PR de colega é revisado assim que aparece, em qualquer coluna da tarefa.",
  ),
  "automationModes.rule.reviewWaitsForCi": dict("Wait for CI to finish", "Esperar o CI terminar"),
  "automationModes.rule.reviewWaitsForCi.help": dict(
    "Off: the review starts while CI is still running.",
    "Desligado: o review começa com o CI ainda rodando.",
  ),
  "automationModes.rule.reviewSkipsFailedCi": dict(
    "Skip PRs with failed CI",
    "Pular PR com CI falhando",
  ),
  "automationModes.rule.reviewSkipsFailedCi.help": dict(
    "Off: PRs with a red CI are reviewed too.",
    "Desligado: PR com CI vermelho também é revisado.",
  ),
  "automationModes.rule.reviewSkipsDrafts": dict("Skip drafts", "Pular rascunhos"),
  "automationModes.rule.reviewSkipsDrafts.help": dict(
    "Off: draft PRs are reviewed too.",
    "Desligado: PR em rascunho também é revisado.",
  ),
  "automationModes.rule.reviewSkipsConflicts": dict(
    "Skip PRs with conflicts",
    "Pular PR com conflitos",
  ),
  "automationModes.rule.reviewSkipsConflicts.help": dict(
    "Off: PRs with merge conflicts are reviewed too.",
    "Desligado: PR com conflito de merge também é revisado.",
  ),
  "automationModes.rule.reviewSkipsChangesRequested": dict(
    "Skip when another reviewer requested changes",
    "Pular quando outro revisor pediu mudanças",
  ),
  "automationModes.rule.reviewSkipsChangesRequested.help": dict(
    'Off: reviewed even with someone else\'s "changes requested".',
    'Desligado: revisa mesmo com "mudanças solicitadas" de outra pessoa.',
  ),
  "automationModes.rule.reviewBusinessHoursOnly": dict(
    "Only in business hours",
    "Só no horário comercial",
  ),
  "automationModes.rule.reviewBusinessHoursOnly.help": dict(
    "Off: reviews (comments and approvals included) also run outside business hours; the board is looked at then too.",
    "Desligado: reviews (com comentários e aprovações) rodam também fora do horário; o board passa a ser olhado nesse período.",
  ),
  "automationModes.rule.devBusinessHoursOnly": dict(
    "Only in business hours",
    "Só no horário comercial",
  ),
  "automationModes.rule.devBusinessHoursOnly.help": dict(
    "Off: your To Do tasks go to the queue and to In Progress outside business hours too.",
    "Desligado: suas tarefas de To Do entram na fila e vão pra In Progress também fora do horário.",
  ),
  "automationModes.rule.devOneInProgress": dict(
    "Only one task In Progress at a time",
    "Só uma tarefa em In Progress por vez",
  ),
  "automationModes.rule.devOneInProgress.help": dict(
    "Off: every task you started is moved to In Progress, one per look.",
    "Desligado: toda tarefa que você começou vai pra In Progress, uma por olhada.",
  ),
  "automationModes.rule.testBusinessHoursOnly": dict(
    "Only in business hours",
    "Só no horário comercial",
  ),
  "automationModes.rule.testBusinessHoursOnly.help": dict(
    "Off: tests are picked up and run outside business hours too.",
    "Desligado: testes são pegos e rodam também fora do horário.",
  ),
  "automationModes.rule.testSkipsOwnTickets": dict(
    "Skip tasks you developed",
    "Pular tarefas que você desenvolveu",
  ),
  "automationModes.rule.testSkipsOwnTickets.help": dict(
    "Off: your own tasks in Wait Test are tested too.",
    "Desligado: suas próprias tarefas em Wait Test também são testadas.",
  ),
  "automationModes.rule.testRequiresPlan": dict(
    "Needs a test plan in the comments",
    "Exigir plano de teste nos comentários",
  ),
  "automationModes.rule.testRequiresPlan.help": dict(
    "Off: tasks without a plan are tested from the description.",
    "Desligado: tarefa sem plano é testada pela descrição.",
  ),
  "automationModes.rule.testSkipsUntestable": dict(
    "Leave hard plans to a person",
    "Deixar plano difícil para uma pessoa",
  ),
  "automationModes.rule.testSkipsUntestable.help": dict(
    "Plans with commands, a release tag, admin access, a real purchase or no link. Off: tried anyway.",
    "Plano com comando, tag de release, acesso de admin, compra real ou sem link. Desligado: tenta mesmo assim.",
  ),
  "automationModes.rule.testWaitsForPreview": dict(
    "Wait for the preview build",
    "Esperar o build do preview",
  ),
  "automationModes.rule.testWaitsForPreview.help": dict(
    "Doesn't test while the task's env/ preview is building, failed or hasn't started. Off: tests right away.",
    "Não testa enquanto o preview env/ da tarefa está buildando, falhou ou não começou. Desligado: testa na hora.",
  ),
  "automationModes.rule.retestAfterFix": dict(
    "Test again after a fix push",
    "Testar de novo depois do push de correção",
  ),
  "automationModes.rule.retestAfterFix.help": dict(
    "A task whose test failed is tested again once its PR gets a new push.",
    "Tarefa com teste reprovado é testada de novo quando o PR recebe push novo.",
  ),
};
