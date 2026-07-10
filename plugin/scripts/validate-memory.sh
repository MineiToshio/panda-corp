#!/usr/bin/env bash
# Deterministic schema check for factory/memory/ lessons — the backbone of the
# DR-047 eval-gate. Validates each LESSON-*.md frontmatter: required keys, valid
# type/status/confidence enums, a well-formed id, and an ANCHORED evidence source
# (context + a `source:` naming a checkable locator) — enforcing MEM-1
# (factory/standards/memory-harvesting.md, from LESSON-0001: no lesson without evidence).
# Skips _lesson-template.md and README.md by globbing LESSON-*.md only.
# Usage: bash validate-memory.sh [factory/memory]    Exit 0 = all valid, 1 = invalid.
dir="${1:-factory/memory}"
exec ruby -EUTF-8 - "$dir" <<'RUBY'
# encoding: utf-8
require 'yaml'
require 'date'
dir = ARGV[0]
unless Dir.exist?(dir)
  warn "memory dir not found: #{dir}"; exit 2
end
TYPES  = %w[problem-solution library-verdict pattern gotcha anti-pattern]
STATUS = %w[candidate active deprecated]
CONF   = %w[low medium high]
PROV   = %w[owner-stated ci-verified agent-inferred]
PROMO  = %w[none proposed approved rejected]
REQ    = %w[id type domain tags context trigger source provenance created status promotion confidence times_applied links]
# MEM-1 (factory/standards/memory-harvesting.md): a `source:` must name a LOCATOR a third
# party can go and check — a date, a factory/project id, a build-run id, a file, a commit
# sha, or a URL. Free prose ("the agent reflected that…") carries no anchor: it is
# reject-at-harvest, never a low-confidence candidate (LESSON-0001, ExpeL arXiv:2308.10144).
ANCHOR = /
  (?: \b\d{4}-\d{2}-\d{2}\b )                                  # a date
 |(?: \b(?:LESSON|WO|FRD|BL|DR|ADR)-\d )                       # a factory or project id
 |(?: \bwf_[a-z0-9]{4,} )                                      # a build-run id
 |(?: \b[\w.@-]+ (?: \/ [\w.@-]+ )* \.
      (?:md|ts|tsx|js|mjs|sh|ya?ml|json|toml|css|sql|py)\b )   # a file
 |(?: \b[0-9a-f]{7,40}\b )                                     # a commit sha
 |(?: https?: | arXiv: )                                       # a source URL
/xi
ANCHOR_MIN = 12
errors = []
counts = Hash.new(0)
ids    = Hash.new { |h, k| h[k] = [] }   # id => [files] — for the uniqueness check (BL-0013)
applied_in_union = []                    # union of every lesson's applied_in — for the S8 prune-freeze verdict
files  = Dir.glob(File.join(dir, 'LESSON-*.md')).sort
files.each do |f|
  base = File.basename(f)
  m = File.read(f).match(/\A---\s*\n(.*?)\n---\s*\n/m)
  (errors << "#{base}: no YAML frontmatter"; next) unless m
  begin
    fm = YAML.safe_load(m[1], permitted_classes: [Date, Time], aliases: false)
  rescue => e
    errors << "#{base}: frontmatter parse error: #{e.message}"; next
  end
  (errors << "#{base}: frontmatter is not a mapping"; next) unless fm.is_a?(Hash)
  REQ.each { |k| errors << "#{base}: missing key '#{k}'" unless fm.key?(k) }
  errors << "#{base}: invalid type '#{fm['type']}'"             unless TYPES.include?(fm['type'])
  errors << "#{base}: invalid status '#{fm['status']}'"         unless STATUS.include?(fm['status'])
  errors << "#{base}: invalid confidence '#{fm['confidence']}'" unless CONF.include?(fm['confidence'])
  errors << "#{base}: invalid provenance '#{fm['provenance']}'" unless PROV.include?(fm['provenance'])
  errors << "#{base}: invalid promotion '#{fm['promotion']}'" unless PROMO.include?(fm['promotion'])
  errors << "#{base}: id must match LESSON-NNNN"                unless fm['id'].to_s =~ /\ALESSON-\d+\z/
  ids[fm['id'].to_s] << base if fm['id']
  fn = base[/\ALESSON-(\d+)/, 1]
  idn = fm['id'].to_s[/\ALESSON-(\d+)\z/, 1]
  errors << "#{base}: filename number #{fn} != id #{fm['id']}" if fn && idn && fn != idn
  errors << "#{base}: empty context (retrieval anchor)"         if fm['context'].to_s.strip.empty?
  errors << "#{base}: empty trigger ('use this when …' retrieval condition, loop v2)" if fm['trigger'].to_s.strip.empty?
  src = fm['source'].to_s.strip
  if src.empty?
    errors << "#{base}: empty source (evidence anchor, LESSON-0001)"
  elsif src.length < ANCHOR_MIN || src !~ ANCHOR
    errors << "#{base}: source has no evidence anchor — cite a date, an id (WO-/FRD-/LESSON-/BL-/DR-), " \
              "a build-run id, a file, a commit sha or a URL; a reflection is not a lesson (MEM-1, LESSON-0001)"
  end
  counts[fm['type']] += 1            if TYPES.include?(fm['type'])
  counts["status:#{fm['status']}"] += 1 if STATUS.include?(fm['status'])
  if fm['applied_in'].is_a?(Array)
    fm['applied_in'].each { |p| applied_in_union << p.to_s.strip unless p.to_s.strip.empty? }
  end
end
# id uniqueness across the store (BL-0013) — a keyed store must reject collisions
ids.each { |id, fs| errors << "duplicate id #{id} in: #{fs.sort.join(', ')}" if fs.size > 1 }
puts "Checked #{files.size} lesson(s) in #{dir}"
puts("By type/status: " + counts.sort.map { |k, v| "#{k}=#{v}" }.join(', ')) unless counts.empty?
# S8: deterministic prune-freeze verdict — the union of every lesson's `applied_in` array is the
# ONLY authoritative count of distinct MEASURED projects (count-lesson-citations.sh is the only writer
# of applied_in — never hand-counted). The "never retrieved" deprecation criterion stays FROZEN until
# this reaches >= 3 distinct projects (loop v2); below that, times_applied: 0 means "never measured",
# not "useless". Printed unconditionally (informational — independent of schema validity above) so
# `/pandacorp:memory review`'s prune-freeze step can assert against this line instead of agent counting.
distinct_projects = applied_in_union.uniq
verdict = distinct_projects.size < 3 ? 'ACTIVE' : 'INACTIVE'
cmp = distinct_projects.size < 3 ? '<' : '>='
puts "applied_in union: #{distinct_projects.size} distinct project(s): #{distinct_projects.sort.join(', ')}"
puts "prune-freeze: #{verdict} (#{distinct_projects.size} distinct measured projects #{cmp} 3)"
if errors.empty?
  puts "OK - all lessons valid"
  exit 0
else
  warn "INVALID - #{errors.size} problem(s):"
  errors.each { |e| warn "  - #{e}" }
  exit 1
end
RUBY
