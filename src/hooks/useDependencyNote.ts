import { expandSelection, type HubCatalog, type SkillsSelection } from "../../shared/skillsHub";
import { useLanguage } from "./useLanguage";

/** "dependency of A, B" for a skill `selection` links only because others need it. */
export function useDependencyNote(catalogs: HubCatalog[]) {
  const { t } = useLanguage();
  return (selection: SkillsSelection, id: string): string | undefined => {
    const by = expandSelection(catalogs, selection).get(id);
    return by && by.length > 0
      ? t("skillsHub.deps.dependencyOf", { names: by.join(", ") })
      : undefined;
  };
}
