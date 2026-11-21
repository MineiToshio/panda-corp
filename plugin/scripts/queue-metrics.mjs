#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function validateEvent(e) {
  if (!e || Array.isArray(e) || e.v !== 1 || !['event', 'branch', 'project', 'attempt', 'ts'].every(k => typeof e[k] === 'string' && e[k])) {
    throw new Error('invalid v1 event fields');
  }
  const at = Date.parse(e.ts);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== e.ts) throw new Error('invalid timestamp');
  const check = (key, predicate) => {
    if (!predicate(e[key])) throw new Error(`invalid ${e.event}.${key}`);
  };
  const string = value => typeof value === 'string';
  const nonempty = value => string(value) && value.length > 0;
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const integer = value => Number.isInteger(value) && value >= 0;
  const status = value => integer(value) && value <= 255;
  const flag = value => typeof value === 'boolean' || value === 0 || value === 1;
  const sha = value => string(value) && (value === '' || /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value));
  const choice = (...values) => value => values.includes(value);
  const load = () => { check('load', number); check('ncpu', value => integer(value) && value > 0); };
  switch (e.event) {
    case 'start':
      check('head', sha); check('launched', flag); check('owner_release_ok', flag);
      check('pid', value => integer(value) && value > 0); break;
    case 'lock_wait': case 'lock_acquired': check('waited_s', number); break;
    case 'slot_acquired': check('slot', nonempty); check('waited_s', number); break;
    case 'slot_released': check('slot', nonempty); break;
    case 'rebase':
      check('result', choice('ok', 'conflict')); check('base', sha); check('head', sha);
      check('duration_s', number); break;
    case 'env_step': check('result', choice('ok', 'failed')); check('duration_s', number); break;
    case 'stamp_check': check('result', choice('match', 'miss')); check('reason', string); break;
    case 'gate_start': load(); break;
    case 'gate_end':
      load(); check('rc', status); check('duration_s', number); check('report', string); break;
    case 'order_check': check('launched', flag); check('order_present', flag); break;
    case 'ff': check('sha', sha); check('result', choice('ok', 'failed')); break;
    case 'push': check('sha', sha); check('result', choice('ok', 'failed', 'unknown')); break;
    case 'reconcile': check('rc', status); break;
    case 'end': check('exit', status); break;
    case 'archive_error': check('path', nonempty); check('reason', nonempty); break;
    case 'ready': break;
    default: throw new Error(`unknown v1 event: ${e.event}`);
  }
  return at;
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    n,
    median: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null,
    p90: n ? sorted[Math.ceil(n * 0.9) - 1] : null,
  };
}

export function queueMetrics(text) {
  const projects = new Map();
  const attempts = new Map();
  const active = new Map();
  const ready = new Map();
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const [index, line] of lines.entries()) {
    try {
      const e = JSON.parse(line);
      const at = validateEvent(e);
      let project = projects.get(e.project);
      if (!project) {
        project = { project: e.project, episodes: [], exits: {}, certified_tree_skips: 0, full_gates: 0 };
        projects.set(e.project, project);
      }
      const key = JSON.stringify([e.project, e.branch]);
      if (e.event === 'ready') {
        const episode = active.get(key);
        if (episode) episode.ready ??= at;
        else if (!ready.has(key)) ready.set(key, at);
        continue;
      }
      if (e.event === 'start') {
        if (attempts.has(e.attempt)) throw new Error('duplicate attempt start');
        let episode = active.get(key);
        if (!episode) {
          episode = { branch: e.branch, rounds: 0, start: at, ready: ready.get(key), landed: null, pending: new Set() };
          ready.delete(key);
          project.episodes.push(episode);
          active.set(key, episode);
        }
        episode.rounds++;
        episode.pending.add(e.attempt);
        attempts.set(e.attempt, { key, episode, ended: false, ff: null });
      }
      const attempt = attempts.get(e.attempt);
      if (!attempt || attempt.key !== key) throw new Error('event without matching start');
      if (attempt.ended) throw new Error('event after terminal end');
      if (e.event === 'stamp_check') {
        if (e.result === 'match') project.certified_tree_skips++;
      }
      if (e.event === 'gate_start') project.full_gates++;
      if (e.event === 'ff') {
        if (e.result === 'ok') attempt.ff = at;
      }
      if (e.event === 'end') {
        attempt.ended = true;
        attempt.episode.pending.delete(e.attempt);
        project.exits[e.exit] = (project.exits[e.exit] ?? 0) + 1;
        // A late overlapping attempt belongs to its original episode, whose landing is immutable.
        if (e.exit === 0 && attempt.episode.landed === null) {
          attempt.episode.landed = attempt.ff ?? at;
          if (active.get(key) === attempt.episode) active.delete(key);
        }
      }
    } catch (error) {
      throw new Error(`queue log line ${index + 1}: ${error.message}`);
    }
  }
  return {
    v: 1,
    projects: [...projects.values()].map(project => {
      const episodes = project.episodes.map(e => ({
        branch: e.branch, rounds: e.rounds, open: e.landed === null,
        pending_attempts: [...e.pending],
        Q_s: e.landed === null ? null : (e.landed - e.start) / 1000,
        R_s: e.landed === null ? null : (e.landed - Math.min(e.ready ?? e.start, e.start)) / 1000,
      }));
      const closed = episodes.filter(e => !e.open);
      return {
        project: project.project,
        done_to_main: {
          Q_s: stats(closed.map(e => e.Q_s)),
          R_s: stats(closed.map(e => e.R_s)),
        },
        rounds: {
          ...stats(episodes.map(e => e.rounds)),
          at_least_3: episodes.filter(e => e.rounds >= 3).length,
          share_at_least_3: episodes.length ? episodes.filter(e => e.rounds >= 3).length / episodes.length : null,
        },
        exits: project.exits,
        certified_tree_skips: project.certified_tree_skips,
        full_gates: project.full_gates,
        episodes,
      };
    }),
  };
}

export function humanTable(result) {
  const rows = [['Project', 'n landed', 'Q median/p90 (s)', 'R median/p90 (s)', 'rounds median/p90', '>=3 rounds', 'skip/full', 'exits']];
  const pair = value => `${value.median ?? '-'} / ${value.p90 ?? '-'}`;
  for (const p of result.projects) {
    rows.push([p.project, p.done_to_main.Q_s.n, pair(p.done_to_main.Q_s), pair(p.done_to_main.R_s), pair(p.rounds),
      `${p.rounds.at_least_3}/${p.rounds.n} (${p.rounds.share_at_least_3 === null ? '-' : (100 * p.rounds.share_at_least_3).toFixed(1)}%)`,
      `${p.certified_tree_skips}/${p.full_gates}`, JSON.stringify(p.exits)]);
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map(row => String(row[i]).length)));
  return rows.map(row => row.map((cell, i) => String(cell).padEnd(widths[i])).join(' | ')).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('usage: queue-metrics.mjs <project queue-log.jsonl>');
    const result = queueMetrics(readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(result, null, 2));
    console.error(humanTable(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
