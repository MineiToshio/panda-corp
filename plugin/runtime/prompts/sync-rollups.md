Run the sole governed rollup writer exactly once:
`node "${CLAUDE_PLUGIN_ROOT}/scripts/pandacorp-build-state.mjs" sync-rollups --project "{{PROJECT_DIR}}" --token "{{LEASE_TOKEN}}" --epoch "{{LEASE_EPOCH}}"`.
Do not edit FRD/blueprint rollups or work-order counters yourself. The command re-derives them from work-order frontmatter, advances producer freshness, validates the lease fence inside the mutation mutex, and fails closed. Return its JSON `corrected` value.
