// Durable certification guard for wo-revert. Read committed history only: a
// certified FRD is fix-forward until a newer dispatch invalidates its certificate.
// Git paths and blob reads are repository-relative, including nested projects.
export function usableCertification({ g, head, frd, workOrders, blob, statusOf, prefix = '' }) {
  let sha = null
  for (const line of String(blob(head, `${prefix}.pandacorp/track.jsonl`) || '').split('\n')) {
    let row = null
    try { row = JSON.parse(line) } catch { /* Non-certification journal lines are ignored. */ }
    if (row && row.kind === 'build_usable' && row.frd === frd && typeof row.sha === 'string' && /^[0-9a-f]{7,40}$/i.test(row.sha)) sha = row.sha
  }
  const isAncestor = (a, b) => g.run(['merge-base', '--is-ancestor', a, b]).ok
  if (!sha || !g.run(['rev-parse', '--verify', '-q', `${sha}^{commit}`]).ok || !isAncestor(sha, head) || !workOrders.length) return null
  const statusAt = (rev, rel) => {
    const text = blob(rev, rel)
    return statusOf(text === null ? null : text.toString('utf8'))
  }
  const statuses = workOrders.map((rel) => statusAt(head, rel))
  if (!statuses.every((s) => ['VERIFIED', 'IN_REVIEW', 'BLOCKED'].includes(s)) || statuses.every((s) => s === 'VERIFIED')) return null
  for (const rel of workOrders) {
    // Full history keeps dispatch stamps from merged branches visible. Latest
    // means ancestry, never wall-clock time or rev-list traversal order.
    const shas = g.must(['rev-list', '--full-history', '--no-merges', head, '--', rel]).split('\n').filter(Boolean)
    const stamps = shas.filter((commit) => {
      if (statusAt(commit, rel) !== 'IN_PROGRESS') return false
      const parent = g.run(['rev-parse', '--verify', '-q', `${commit}^`])
      return !parent.ok || statusAt(parent.out.trim(), rel) !== 'IN_PROGRESS'
    })
    const latest = stamps.filter((s) => !stamps.some((other) => s !== other && isAncestor(s, other)))
    if (latest.some((s) => !isAncestor(s, sha))) return null
  }
  return { frd, sha }
}
