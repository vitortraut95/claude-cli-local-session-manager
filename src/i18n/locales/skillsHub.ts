import { dict } from "../dict";

export const skillsHub = {
  "skillsHub.deps.addTitle": dict(
    "Select its dependencies too?",
    "Selecionar as dependências também?",
  ),
  "skillsHub.deps.addMessage": dict(
    "{subject} needs other skills to work. They'll be selected along with it.",
    "{subject} precisa de outras skills para funcionar. Elas vão ser selecionadas junto.",
  ),
  "skillsHub.deps.addGroup": dict("Selected along", "Vão ser selecionadas junto"),
  "skillsHub.deps.addConfirm": dict("Select all", "Selecionar todas"),
  "skillsHub.deps.dependencyOf": dict("dependency of {names}", "dependência de {names}"),
  "skillsHub.deps.dependentsTitle": dict(
    "Other skills depend on it",
    "Outras skills dependem dela",
  ),
  "skillsHub.deps.dependentsMessage": dict(
    "Selected skills use {subject}. To remove it they have to go too — otherwise it stays linked as their dependency.",
    "Skills selecionadas usam {subject}. Para removê-la elas também precisam sair — senão ela continua linkada como dependência delas.",
  ),
  "skillsHub.deps.dependentsGroup": dict("Removed too", "Também vão ser removidas"),
  "skillsHub.deps.dependentsConfirm": dict("Remove all", "Remover todas"),
  "skillsHub.deps.orphansTitle": dict(
    "Remove the dependencies nothing else uses?",
    "Remover as dependências que ficam sem uso?",
  ),
  "skillsHub.deps.orphansMessage": dict(
    "{subject} used skills that no other selected skill needs.",
    "{subject} usava skills que nenhuma outra skill selecionada usa.",
  ),
  "skillsHub.deps.orphansGroup": dict("No longer used", "Ficam sem uso"),
  "skillsHub.deps.orphansConfirm": dict("Remove them too", "Remover também"),
  "skillsHub.deps.orphansKeep": dict("Keep them", "Manter"),
  "skillsHub.plan.title": dict("Apply the selection?", "Aplicar a seleção?"),
  "skillsHub.plan.message": dict(
    "These links change in {dir}. Nothing outside the hub is touched.",
    "Estes links mudam em {dir}. Nada fora do hub é mexido.",
  ),
  "skillsHub.plan.link": dict("Linked", "Vão ser linkadas"),
  "skillsHub.plan.unlink": dict("Removed", "Vão ser removidas"),
  "skillsHub.plan.confirm": dict("Apply", "Aplicar"),
  "skillsHub.issues.title": dict("Actions needed ({count})", "Ações necessárias ({count})"),
  "skillsHub.issues.unlinked": dict(
    "Selected but not linked yet: {names}.",
    "Selecionadas mas ainda sem link: {names}.",
  ),
  "skillsHub.issues.linkNow": dict("Link now", "Linkar agora"),
  "skillsHub.issues.linkTitle": dict("Link the selected skills?", "Linkar as skills selecionadas?"),
  "skillsHub.issues.unknownDependency": dict(
    "{skill} needs {dependency}, which the hub doesn't have — tell whoever maintains the skill.",
    "{skill} precisa de {dependency}, que não existe no hub — avise quem mantém a skill.",
  ),
  "skillsHub.issues.dependencyConflict": dict(
    "{skill} needs {dependency}, but {path} already takes that name — move or rename it so the hub's one can be linked.",
    "{skill} precisa de {dependency}, mas {path} já ocupa esse nome — mova ou renomeie para a do hub entrar.",
  ),
  "skillsHub.issues.preferenceMissing": dict(
    "{preference} uses {skill}, which isn't installed.",
    "{preference} usa {skill}, que não está instalada.",
  ),
  "skillsHub.issues.preferenceMissingNoHub": dict(
    "{preference} uses {skill}, which isn't installed and isn't in the hub — pick another one below.",
    "{preference} usa {skill}, que não está instalada nem existe no hub — escolha outra abaixo.",
  ),
  "skillsHub.issues.install": dict("Install", "Instalar"),
  "skillsHub.issues.installTitle": dict("Install {skill}?", "Instalar {skill}?"),
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
  "skillsHub.manage.authorFilter": dict("Filter by author", "Filtrar por autor"),
  "skillsHub.manage.allAuthors": dict("All authors", "Todos os autores"),
  "skillsHub.manage.sort": dict("Sort skills", "Ordenar skills"),
  "skillsHub.manage.sortName": dict("Alphabetical", "Alfabética"),
  "skillsHub.manage.sortRecent": dict("Recently updated", "Atualizadas recentemente"),
  "skillsHub.manage.updatedAt": dict("updated {date}", "atualizada {date}"),
  "skillsHub.manage.changePath": dict("Change folder", "Trocar pasta"),
  "skillsHub.manage.changePathHint": dict(
    'The repo and the clone folder are changed in one place: the gear (Settings) in the header → "Team skills" → Edit.',
    'O repo e a pasta do clone são trocados num lugar só: na engrenagem (Configurações) do header → "Skills do time" → Editar.',
  ),
  "skillsHub.manage.detached": dict("(detached)", "(detached)"),
  "skillsHub.manage.dirty": dict("local changes", "mudanças locais"),
  "skillsHub.manage.requiredBy": dict(
    "Linked as a dependency of: {names}",
    "Linkada como dependência de: {names}",
  ),
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
  "skillsHub.modal.title": dict("Skills", "Skills"),
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
  "skillsHub.manage.syncHelp": dict(
    '"Update now" runs git fetch, fast-forwards the clone when it\'s clean, and creates shortcuts in {dir} for new skills. It also runs on its own when the app starts, if enabled in Settings.',
    '"Atualizar agora" roda git fetch, avança o clone (fast-forward) quando está limpo e cria os atalhos das skills novas em {dir}. Também roda sozinho quando o app inicia, se estiver ligado na Configuração.',
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
  "skillsHub.preview.author": dict("Author:", "Autor:"),
  "skillsHub.preview.version": dict("Version:", "Versão:"),
  "skillsHub.preview.updatedAt": dict("Last update:", "Última atualização:"),
  "skillsHub.preview.files": dict("Files that come with it", "Arquivos que vêm junto"),
  "skillsHub.preview.loadError": dict(
    "Couldn't read this skill.",
    "Não foi possível ler esta skill.",
  ),
};
