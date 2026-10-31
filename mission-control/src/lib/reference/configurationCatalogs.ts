import { cache } from "react";
import { readDecisionRuleCatalog } from "@/lib/registry/registry";
import { readStandardCatalog } from "@/lib/standards/standards";
import { modelTier } from "./modelTier";
import { readAgentCatalog, readSkillCatalog } from "./reference";

/** Read once per server request and derive facts shared by every configuration view. */
export const loadConfigurationCatalogs = cache(() => {
  const skills = readSkillCatalog();
  const agents = readAgentCatalog();
  const rules = readDecisionRuleCatalog();
  const standards = readStandardCatalog();
  const skillData = skills.ok ? skills.data : [];
  const agentData = agents.ok ? agents.data : [];
  const ruleData = rules.ok ? rules.data : [];
  const standardData = standards.ok ? standards.data : [];
  const ownerCommands = skillData.filter((skill) => !skill.internal);
  const skillsByAgent = new Map<string, string[]>();
  for (const skill of skillData) {
    for (const agent of skill.agents ?? []) {
      const linked = skillsByAgent.get(agent) ?? [];
      linked.push(skill.slug);
      skillsByAgent.set(agent, linked);
    }
  }
  const tiers = { opus: 0, sonnet: 0, haiku: 0, unknown: 0 };
  for (const agent of agentData) tiers[modelTier(agent.model)] += 1;
  const domains = [...new Set(standardData.map((standard) => standard.domain))]
    .sort()
    .map((domain) => ({
      domain,
      count: standardData.filter((standard) => standard.domain === domain).length,
    }));
  return {
    skills,
    agents,
    rules,
    standards,
    ownerCommands,
    skillsByAgent: Object.fromEntries(skillsByAgent),
    domains,
    counts: {
      skills: skillData.length,
      agents: agentData.length,
      rules: ruleData.length,
      standards: standardData.length,
      owner: ownerCommands.length,
      internal: skillData.length - ownerCommands.length,
      tiers,
      human: ruleData.filter((rule) => rule.requiereHumano).length,
      auto: ruleData.filter((rule) => !rule.requiereHumano).length,
      must: standardData.filter((standard) => standard.severity === "MUST").length,
      should: standardData.filter((standard) => standard.severity === "SHOULD").length,
    },
  };
});
/** Serializable server-to-client catalog DTO. */
export type ConfigurationCatalogs = ReturnType<typeof loadConfigurationCatalogs>;
