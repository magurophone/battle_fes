#!/usr/bin/env node
// Stop hook: blocks turn end if production code was changed without codex review.
// Detection:
//   1. Transcript scan -- find last production-code-touching tool_use and last Skill(codex) call.
//      If a code change exists with no codex call after it -> block.
//   2. Git working-tree fallback -- if git status shows dirty production files but
//      transcript didn't catch a tool_use (e.g. Bash mutation), require codex anywhere in turn.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let raw = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw || '{}');

    // Avoid loops if Stop hook is re-triggered.
    if (data.stop_hook_active) {
      process.exit(0);
    }

    const transcriptPath = data.transcript_path;
    const cwd = data.cwd || process.cwd();
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      process.exit(0);
    }

    const isProdCode = (rel) => {
      rel = String(rel || '').replace(/\\/g, '/');
      if (!rel) return false;
      if (rel.startsWith('node_modules/')) return false;
      if (rel.startsWith('.claude/')) return false;
      if (rel.startsWith('.git/')) return false;
      if (rel.startsWith('deploy-check/')) return false;
      if (rel.startsWith('public/assets/')) return false;
      if (/\.(md|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i.test(rel)) return false;
      if (rel === 'battlefes.html') return true;
      if (rel.startsWith('public/') && /\.(html|js|mjs|cjs|css|json|ts|tsx)$/i.test(rel)) return true;
      if (rel.startsWith('functions/')) return true;
      if (rel.startsWith('src/')) return true;
      return false;
    };

    // Parse transcript JSONL.
    const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter((l) => l.trim());
    const events = [];
    for (const line of lines) {
      try { events.push(JSON.parse(line)); } catch { /* skip */ }
    }

    // Find latest real user message (turn boundary).
    let turnStart = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.type !== 'user') continue;
      const content = ev.message && ev.message.content;
      if (typeof content === 'string') { turnStart = i; break; }
      if (Array.isArray(content)) {
        const hasText = content.some((b) => b && b.type === 'text');
        if (hasText) { turnStart = i; break; }
      }
    }
    if (turnStart < 0) process.exit(0);

    // Walk turn, track latest code-mod and latest codex invocation indices.
    let lastCodeModIdx = -1;
    let lastCodexIdx = -1;

    for (let i = turnStart; i < events.length; i++) {
      const ev = events[i];
      if (ev.type !== 'assistant') continue;
      const content = ev.message && ev.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || block.type !== 'tool_use') continue;
        const name = block.name;
        const input = block.input || {};
        if (name === 'Skill' && (input.skill === 'codex' || input.skill === 'codex:codex')) {
          lastCodexIdx = i;
        }
        if (name === 'Write' || name === 'Edit' || name === 'MultiEdit' || name === 'NotebookEdit') {
          const fp = input.file_path || input.notebook_path || '';
          const rel = path.relative(cwd, fp).replace(/\\/g, '/');
          if (isProdCode(rel)) lastCodeModIdx = i;
        }
      }
    }

    // Git working-tree state on production paths.
    let gitDirty = false;
    try {
      const out = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        // porcelain: XY <space> path  (rename: -> dest)
        const fileField = line.slice(3);
        const filePath = fileField.includes(' -> ') ? fileField.split(' -> ').pop() : fileField;
        if (isProdCode(filePath.trim())) { gitDirty = true; break; }
      }
    } catch { /* ignore */ }

    let needsReview = false;
    let reasonHint = '';
    if (lastCodeModIdx >= 0 && lastCodexIdx < lastCodeModIdx) {
      needsReview = true;
      reasonHint = '本番コード(' + 'battlefes.html / public/ / functions/ / src/' + ')への変更後に codex レビューが実行されていない。';
    } else if (gitDirty && lastCodeModIdx < 0 && lastCodexIdx < 0) {
      needsReview = true;
      reasonHint = 'git working tree に未レビューの本番コード変更がある (Bash 経由など)。';
    }

    if (needsReview) {
      const payload = {
        decision: 'block',
        reason:
          reasonHint +
          ' Skill ツールで codex を呼び出しレビューを取得し、指摘の採否を判断して必要なら追加修正を行うこと。' +
          ' その後ジャーゴンを使わず日本語で要点をチャットに記載してから応答を完了すること。' +
          ' (この運用は user 指示で固定済み。レビュー不要と user が明示した場合のみスキップ可)'
      };
      process.stdout.write(JSON.stringify(payload));
      process.exit(0);
    }

    process.exit(0);
  } catch (err) {
    // Fail open -- never block on hook crash.
    try { process.stderr.write('[stop-codex-guard] ' + (err && err.message) + '\n'); } catch {}
    process.exit(0);
  }
});
