#!/usr/bin/env bash
# Deterministic retrieval measurement for the self-learning loop (DR-047, loop v2).
# Greps a project's build artifacts for `LESSON-NNNN` citations and updates the
# cited lessons in factory/memory/: appends the project to `applied_in` (idempotent),
# recomputes `times_applied` (= applied_in length — the citation IS the evidence of
# retrieval; agents cite in artifacts they already write, a script does the counting,
# never agent self-report), and auto-queues `promotion: proposed` when a lesson has
# been cited by >= 3 distinct projects and is still `promotion: none` (the escalator
# that feeds /pandacorp:learn — proposing is low-risk; promoting stays owner-gated).
# Usage: bash count-lesson-citations.sh <project-dir> [memory-dir]
#   <project-dir>  the built project's root (its docs/ + .pandacorp/comms are scanned)
#   [memory-dir]   the factory memory store (default: factory/memory of the cwd)
# Exit 0 = ran (even with zero citations); 1 = bad invocation; 2 = store not found.
set -euo pipefail
proj="${1:?usage: count-lesson-citations.sh <project-dir> [memory-dir]}"
mem="${2:-factory/memory}"
[ -d "$proj" ] || { echo "project dir not found: $proj" >&2; exit 1; }
[ -d "$mem" ]  || { echo "memory dir not found: $mem" >&2; exit 2; }
exec ruby -EUTF-8 - "$proj" "$mem" <<'RUBY'
# encoding: utf-8
proj_dir, mem_dir = ARGV[0], ARGV[1]
# Project identity = folder basename (stable, matches portfolio rows).
proj = File.basename(File.expand_path(proj_dir))

# 1) Collect distinct LESSON-NNNN citations from the build's durable artifacts.
scan_globs = [
  File.join(proj_dir, 'docs', '**', '*.md'),          # blueprints, FRDs, WOs, reviews, ADRs
  File.join(proj_dir, '.pandacorp', 'comms', '*.md'), # build log (progress.md)
]
cited = {}
scan_globs.each do |g|
  Dir.glob(g).each do |f|
    next unless File.file?(f)
    File.read(f).scan(/LESSON-\d{4}/) { |id| (cited[id] ||= []) << f }
  end
end
if cited.empty?
  puts "No LESSON citations found in #{proj} artifacts (0 lessons updated)."
  exit 0
end

# 2) Update each cited lesson's frontmatter, idempotently and textually
#    (preserve formatting; only touch the three fields we own).
updated, proposed, missing = [], [], []
cited.keys.sort.each do |id|
  file = Dir.glob(File.join(mem_dir, "#{id}-*.md")).first
  (missing << id; next) unless file
  text = File.read(file)
  m = text.match(/\A(---\s*\n)(.*?)(\n---\s*\n)(.*)\z/m)
  (missing << id; next) unless m
  head, fm, tail, body = m[1], m[2], m[3], m[4]

  # applied_in: inline list, created after times_applied if absent
  applied = []
  if fm =~ /^applied_in:\s*\[(.*)\]\s*$/
    applied = $1.split(',').map(&:strip).reject(&:empty?)
  end
  already = applied.include?(proj)
  applied << proj unless already
  applied_line = "applied_in: [#{applied.join(', ')}]"
  if fm =~ /^applied_in:.*$/
    fm = fm.sub(/^applied_in:.*$/, applied_line)
  else
    fm = fm.sub(/^(times_applied:.*)$/) { "#{$1}\n#{applied_line}" }
  end

  # times_applied = applied_in length (single source of truth: the citation record)
  fm = fm.sub(/^times_applied:.*$/, "times_applied: #{applied.size}")

  # escalator: >= 3 distinct citing projects and never proposed -> queue it
  did_propose = false
  if applied.size >= 3 && fm =~ /^promotion:\s*none\s*$/
    fm = fm.sub(/^promotion:\s*none\s*$/, 'promotion: proposed')
    note = "\n**Auto-proposed for promotion** (#{Time.now.strftime('%Y-%m-%d')}): cited by #{applied.size} projects (#{applied.join(', ')}) — measured by count-lesson-citations.sh. Target/rationale to be refined by the next `/pandacorp:memory review`; approval is `/pandacorp:learn` + the owner (DR-047 high-risk gate).\n"
    body = body.rstrip + "\n" + note
    did_propose = true
  end

  File.write(file, head + fm + tail + body)
  updated << "#{id}: times_applied=#{applied.size}#{already ? ' (already counted)' : " (+#{proj})"}"
  proposed << id if did_propose
end

puts "Scanned #{proj}: #{cited.size} distinct lesson(s) cited."
updated.each { |u| puts "  - #{u}" }
proposed.each { |id| puts "  ! #{id} auto-queued promotion: proposed (>=3 projects)" }
missing.each  { |id| puts "  ? #{id} cited but not found in #{mem_dir} (typo or deprecated?)" }
RUBY
