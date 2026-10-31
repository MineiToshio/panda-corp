import { cache } from "react";
import { readIdeas } from "@/lib/ideas/ideas";
import {
  getIdeaNavigation,
  getProjectNavigation,
  resolveIdeaNavigation,
} from "@/lib/navigation/identities";
import { navigationHref } from "@/lib/navigation/urls";
import { readCardProject } from "./readCardProject";

/** One request-scoped source for the open idea, project artifacts and canonical workspace link. */
export const readIdeaPage = cache((token: string) => {
  const cards = readIdeas();
  const slug = resolveIdeaNavigation(token, cards);
  const card = cards.find((entry) => entry.slug === slug);
  if (!card) return null;
  const project = readCardProject(card);
  const status = project.projectStatus?.present ? project.projectStatus.status : undefined;
  const navigationSlug = getIdeaNavigation(card.slug).slug;
  const projectSlug = card.project
    ? getProjectNavigation(card.project, status?.project ?? card.title).slug
    : undefined;
  const forgeHref = projectSlug
    ? navigationHref("/portfolio", { project: projectSlug, tab: "summary" })
    : undefined;
  return {
    ...project,
    card,
    navigationSlug,
    forgeHref,
    navigationBaseHref: forgeHref?.replace(/\/summary$/u, ""),
    phase: status?.phase,
    isRunning: status?.running === true,
    targetPlatforms: status?.targetPlatforms,
    constructionStarted: status?.phase === "implementation" || status?.phase === "release",
  };
});

/** Serializable result of the idea resolver, consumed by the client page frame. */
export type IdeaPageData = NonNullable<ReturnType<typeof readIdeaPage>>;
