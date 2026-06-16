#!/usr/bin/env bash
# Deterministic schema check for factory/memory/ lessons — the backbone of the
# DR-047 eval-gate. Validates each LESSON-*.md frontmatter: required keys, valid
# type/status/confidence enums, a well-formed id, and a non-empty evidence anchor
# (context + source) — enforcing LESSON-0001 (no lesson without concrete evidence).
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
REQ    = %w[id type domain tags context source provenance created status promotion confidence times_applied links]
errors = []
counts = Hash.new(0)
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
  errors << "#{base}: empty context (retrieval anchor)"         if fm['context'].to_s.strip.empty?
  errors << "#{base}: empty source (evidence anchor, LESSON-0001)" if fm['source'].to_s.strip.empty?
  counts[fm['type']] += 1            if TYPES.include?(fm['type'])
  counts["status:#{fm['status']}"] += 1 if STATUS.include?(fm['status'])
end
puts "Checked #{files.size} lesson(s) in #{dir}"
puts("By type/status: " + counts.sort.map { |k, v| "#{k}=#{v}" }.join(', ')) unless counts.empty?
if errors.empty?
  puts "OK - all lessons valid"
  exit 0
else
  warn "INVALID - #{errors.size} problem(s):"
  errors.each { |e| warn "  - #{e}" }
  exit 1
end
RUBY
