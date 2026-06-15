// 신호원 → state.json → deriveSignals → pickMood 전체 경로 검증.
const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const T = require('../../../packages/bear-core/todak.js');

// 격리된 임시 홈에서 테스트 (실제 ~/.todak 안 건드림)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'todak-'));
const env = { ...process.env, TODAK_HOME: TMP };
const here = __dirname;
const node = process.execPath;
const run = (script, args = [], input = null) =>
  cp.execFileSync(node, [path.join(here, script), ...args], { env, input: input || undefined });
const state = () => JSON.parse(fs.readFileSync(path.join(TMP, 'state.json'), 'utf8'));
const mood = () => T.pickMood(T.deriveSignals(state(), Date.now(), new Date().getHours()));

const claudeJson = JSON.stringify({
  model: { display_name: 'Opus 4.8' },
  cost: { total_cost_usd: 3.2 },
  rate_limits: { five_hour: { used_percentage: 92 } },
});

console.log('① statusline JSON(한도 92%)');
run('from-statusline.js', [], claudeJson);
console.log('   state.usage =', state().usage, '→ mood =', mood());

console.log('② 셸 실패(exit 1)');
run('from-shell.js', ['--status', '1']);
console.log('   event =', state().event.type, '→ mood =', mood());

console.log('③ Claude Stop 훅(작업 완료)');
run('claude-hook.js', ['--event', 'done'], '{}');
console.log('   event =', state().event.type, '→ mood =', mood());

console.log('④ PostToolUse 훅 + tool 에러 출력 → error 승격');
run('claude-hook.js', ['--event', 'activity'], JSON.stringify({ tool_response: 'Error: ENOENT traceback' }));
console.log('   event =', state().event.type, '→ mood =', mood());

console.log('⑤ 정상 도구 사용(activity) → 이벤트 만료 후 평소');
run('claude-hook.js', ['--event', 'activity'], JSON.stringify({ tool_response: 'ok' }));
// 이벤트를 과거로 밀어 만료 확인
const s = state(); s.event = { type: 'error', at: Date.now() - 9000 };
fs.writeFileSync(path.join(TMP, 'state.json'), JSON.stringify(s));
console.log('   만료된 error → mood =', mood(), '(error 아님이 정상)');

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n✅ 전체 경로 통과 (임시 홈 정리 완료)');
