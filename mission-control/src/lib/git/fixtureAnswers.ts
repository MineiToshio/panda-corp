/** Serialized branch facts in the prototype oracle. */
export interface FixtureBranch {
  name: string;
  lastCommitAt: string;
  ahead: number;
  subject: string;
  filesChanged: number;
  worktree: string | null;
  uncommitted: number;
}
/** Serialized repository facts; root is a display path, never the repository lookup key. */
export interface FixtureRepo {
  root: string;
  commits: number;
  pluginUncommitted?: number;
  branches: FixtureBranch[];
  extraWorktrees: { path: string; detached?: boolean; locked?: boolean }[];
}
const changedFiles = (count: number, file: string) =>
  Array.from({ length: count }, (_, i) => ` M ${file}${i + 1}.ts`).join("\n");

/** Answer the base read families; undefined means this fixture has no answer. */
export function fixtureAnswer(
  repo: FixtureRepo,
  args: readonly string[],
  cwd: string,
): string | undefined {
  const command = args.join(" ");
  const defaultBranch = "main";
  const answers: Record<string, () => string> = {
    "symbolic-ref --quiet --short refs/remotes/origin/HEAD": () => `origin/${defaultBranch}`,
    "rev-list --count HEAD": () => String(repo.commits),
    [`branch --no-merged ${defaultBranch} --format=%(refname:short)`]: () =>
      repo.branches.map((b) => b.name).join("\n"),
    "status --porcelain -- plugin": () => changedFiles(repo.pluginUncommitted ?? 0, "plugin/file-"),
    "status --porcelain": () =>
      changedFiles(repo.branches.find((b) => b.worktree === cwd)?.uncommitted ?? 0, "src/file-"),
    "worktree list --porcelain": () =>
      [
        `worktree ${repo.root}\nHEAD ${"0".repeat(40)}\nbranch refs/heads/${defaultBranch}`,
        ...repo.branches
          .filter((b) => b.worktree)
          .map(
            (b) => `worktree ${b.worktree}\nHEAD ${"1".repeat(40)}\nbranch refs/heads/${b.name}`,
          ),
        ...repo.extraWorktrees.map((w) =>
          [
            `worktree ${w.path}`,
            `HEAD ${"2".repeat(40)}`,
            ...(w.detached ? ["detached"] : []),
            ...(w.locked ? ["locked"] : []),
          ].join("\n"),
        ),
      ].join("\n\n"),
  };
  if (answers[command]) return answers[command]();
  for (const branch of repo.branches) {
    const branchAnswers: Record<string, string> = {
      [`rev-list --count main..${branch.name}`]: String(branch.ahead),
      [`log -1 --format=%ct ${branch.name}`]: String(
        Math.floor(Date.parse(branch.lastCommitAt) / 1000),
      ),
      [`log -1 --format=%s ${branch.name}`]: branch.subject,
      [`log -1 --format=%ct|%s ${branch.name}`]: `${Math.floor(Date.parse(branch.lastCommitAt) / 1000)}|${branch.subject}`,
      [`diff --shortstat main...${branch.name}`]: ` ${branch.filesChanged} files changed, ${branch.filesChanged * 9} insertions(+), ${branch.filesChanged * 2} deletions(-)`,
    };
    if (command in branchAnswers) return branchAnswers[command];
  }
  return undefined;
}
