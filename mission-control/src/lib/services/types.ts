/** Public recipe; private identities never enter the Manual projection. */
export interface ServiceProvider {
  id: string;
  name: string;
  type: string;
  purpose: string;
  adoption: string;
  dashboardUrl: string;
  reusePolicy: string;
  environmentPolicy: string;
  automation: { methods: string[]; status: string; steps: string[] };
  quotaNotes: string;
  variableExamples: {
    name: string;
    source: string;
    targets: string[];
    secret: boolean;
    purpose: string;
    note: string | null;
  }[];
  sources: { url: string; checkedAt: string }[];
}
/** Whitelisted private identity, excluding credentials and unknown fields. */
export interface ServiceAccount {
  id: string;
  providerId: string;
  loginEmail: string | null;
  displayName: string;
  dashboardUrl: string | null;
  accessStatus: string;
  observedAt: string | null;
  plan: string | null;
  acceptingNewProjects: boolean;
  automationStatus: string;
  nextStep: string | null;
  notes: string | null;
  quotaSnapshot: {
    metric: string;
    unit: string;
    scope: string;
    period: string | null;
    limit: number | null;
    usage: number | null;
    remaining: number | null;
    observedAt: string | null;
    source: string;
  } | null;
}
/** Derived project allocation; secret references deliberately omitted. */
export interface ServiceAllocation {
  integrationId: string;
  projectId: string;
  projectName: string;
  projectHref: string;
  providerId: string;
  accountRef: string | null;
  status: string;
  resources: {
    environment: string;
    resourceName: string | null;
    nativeResourceId: string | null;
  }[];
}
/** Safe reader error, never includes file contents or parser exception values. */
export interface ServiceIssue {
  code: "missing" | "unreadable" | "invalid" | "duplicate" | "dangling" | "productionAsDev";
  source:
    | "factory/services/catalog.yaml"
    | "services/accounts.yaml"
    | `projects/${string}/.pandacorp/accounts/services.yaml`;
}
/** One read model shared by the global and project-scoped directories. */
export interface ServicesDirectoryData {
  providers: ServiceProvider[];
  accounts: ServiceAccount[];
  allocations: ServiceAllocation[];
  issues: ServiceIssue[];
}
