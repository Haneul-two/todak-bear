// 🐻 토닥곰 상태 파일 IO (Node 전용) — 모든 신호원이 이 모듈로 ~/.todak/state.json 을 갱신.
// 곰(Tauri 백엔드/프런트)은 이 파일을 읽어 기분을 정한다. 신호원과 곰은 파일로만 만난다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = process.env.TODAK_HOME || path.join(os.homedir(), '.todak');
const STATE_PATH = path.join(DIR, 'state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8').replace(/^﻿/, ''));
  } catch {
    return {}; // 없으면 빈 상태
  }
}

// 여러 신호원이 거의 동시에 갱신하면 read-modify-write 경합으로 서로의 필드를
// 덮어쓸 수 있다(예: 훅의 event 를 statusline 의 usage 쓰기가 날림).
// mkdir 은 원자적 연산이라 디렉터리를 락으로 써서 쓰기를 직렬화한다.
const LOCK_PATH = STATE_PATH + '.lock';
const _sab = new Int32Array(new SharedArrayBuffer(4));
const sleepMs = (ms) => { Atomics.wait(_sab, 0, 0, ms); }; // 짧은 동기 대기(단명 CLI라 무방)

function withLock(fn) {
  const start = Date.now();
  let held = false;
  while (Date.now() - start < 1500) {
    try { fs.mkdirSync(LOCK_PATH); held = true; break; }
    catch {
      // 크래시로 남은 stale 락(2초 초과)은 회수하고 재시도
      try { if (Date.now() - fs.statSync(LOCK_PATH).mtimeMs > 2000) { fs.rmdirSync(LOCK_PATH); continue; } } catch {}
      sleepMs(8);
    }
  }
  try { return fn(); }       // 락을 못 잡아도(드묾) 진행 — 영구 블록보다 드문 유실이 낫다
  finally { if (held) { try { fs.rmdirSync(LOCK_PATH); } catch {} } }
}

// 부분 갱신(merge). 락으로 직렬화 + 원자적 쓰기(temp→rename)로
// 곰이 반쪽 파일을 읽지도, 동시 쓰기로 필드가 사라지지도 않게 함.
function writeState(patch) {
  fs.mkdirSync(DIR, { recursive: true });
  return withLock(() => {
    const next = { ...readState(), ...patch, updatedAt: Date.now() };
    const tmp = STATE_PATH + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next), 'utf8');
    fs.renameSync(tmp, STATE_PATH);
    return next;
  });
}

// ── 신호원이 쓰는 의미 단위 헬퍼 ──
const setUsage = (pct, cost) =>
  writeState({ usage: Math.max(0, Math.min(100, Math.round(pct))),
               ...(cost != null ? { cost } : {}) });
const touchActivity = (activity) =>
  writeState({ lastActivityAt: Date.now(), ...(activity ? { activity } : {}) });
const markEvent = (type) => // 'error' | 'done'
  writeState({ event: { type, at: Date.now() }, lastActivityAt: Date.now() });

module.exports = { DIR, STATE_PATH, readState, writeState, setUsage, touchActivity, markEvent };
