#!/usr/bin/env bash
# Deterministic schema check for factory/backlog/ items — the plane-3 counterpart of
# validate-memory.sh (DR-103). Validates each BL-*.md frontmatter: required keys, valid
# type/status/severity enums, a well-formed id, filename-number↔id consistency, and
# id uniqueness across the store (the collision class that hit BL-0010/BL-0011 on
# 2026-07-01 — same failure BL-0013 fixed for LESSONs). Also prints the next free id
# so filing skills/sessions can allocate without scanning by hand.
# Skips _item-template.md and README.md by globbing BL-*.md only.
# Usage: bash validate-backlog.sh [factory/backlog]    Exit 0 = all valid, 1 = invalid.
dir="${1:-factory/backlog}"
exec ruby -EUTF-8 - "$dir" <<'RUBY'
# encoding: utf-8
require 'yaml'
require 'date'
dir = ARGV[0]
unless Dir.exist?(dir)
  warn "backlog dir not found: #{dir}"; exit 2
end
TYPES  = %w[bug change]
STATUS = %w[open doing done]
SEV    = %w[p0 p1 p2]
REQ    = %w[id type area title status severity opened]
errors = []
counts = Hash.new(0)
ids    = Hash.new { |h, k| h[k] = [] }   # id => [files] — uniqueness across the store
maxid  = 0
files  = Dir.glob(File.join(dir, 'BL-*.md')).sort
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
  errors << "#{base}: invalid type '#{fm['type']}'"         unless TYPES.include?(fm['type'])
  errors << "#{base}: invalid status '#{fm['status']}'"     unless STATUS.include?(fm['status'])
  errors << "#{base}: invalid severity '#{fm['severity']}'" unless SEV.include?(fm['severity'])
  errors << "#{base}: id must match BL-NNNN"                unless fm['id'].to_s =~ /\ABL-\d+\z/
  errors << "#{base}: status done requires a closed: date"  if fm['status'] == 'done' && fm['closed'].to_s.strip.empty?
  ids[fm['id'].to_s] << base if fm['id']
  fn  = base[/\ABL-(\d+)/, 1]
  idn = fm['id'].to_s[/\ABL-(\d+)\z/, 1]
  errors << "#{base}: filename number #{fn} != id #{fm['id']}" if fn && idn && fn != idn
  maxid = [maxid, idn.to_i].max if idn
  counts["status:#{fm['status']}"] += 1 if STATUS.include?(fm['status'])
  counts["sev:#{fm['severity']}"]  += 1 if SEV.include?(fm['severity'])
end
# id uniqueness across the store — a keyed store must reject collisions
ids.each { |id, fs| errors << "duplicate id #{id} in: #{fs.sort.join(', ')}" if fs.size > 1 }
puts "Checked #{files.size} item(s) in #{dir}"
puts("By status/severity: " + counts.sort.map { |k, v| "#{k}=#{v}" }.join(', ')) unless counts.empty?
puts format("Next free id: BL-%04d", maxid + 1)
if errors.empty?
  puts "OK - all items valid"
  exit 0
else
  warn "INVALID - #{errors.size} problem(s):"
  errors.each { |e| warn "  - #{e}" }
  exit 1
end
RUBY
