// 🐻 토닥곰 코어 — 단일 캐릭터 스펙 (의존성 없음, Node/브라우저 공용)
// 이 파일이 곰 우주의 "심장". 터미널·GitHub·데스크톱이 전부 여기서 같은 곰을 가져간다.
//
// 차별점: 경쟁작 펫은 "잘못하면 화내는" 다그치는 캐릭터.
//         토닥곰은 정반대 — 막히면 토닥이고, 새벽이면 재워주는 "위로하는 곰".
//
// 핵심 API
//   pickMood(signals) -> moodKey      // 세션 상태 → 기분 키
//   getMood(moodKey)  -> { face, palette, line(lang) }
//   renderAscii(moodKey, opts)        // 3줄 ASCII 곰 (statusline 호환)

'use strict';

// ── 팔레트: 기분별 의미색 (ANSI + hex 둘 다 제공해 터미널/SVG/데스크톱 공용) ──
const PALETTE = {
  warm:   { ansi: '\x1b[33m', hex: '#E8A33D', name: 'honey' },   // 따뜻함/주의
  calm:   { ansi: '',          hex: '#9C8A7A', name: 'fur'   },   // 평온/기본
  happy:  { ansi: '\x1b[32m', hex: '#6FB36F', name: 'leaf'  },   // 신남/완료
  tender: { ansi: '\x1b[36m', hex: '#6FA8C7', name: 'sky'   },   // 위로/토닥
  sleepy: { ansi: '\x1b[2m',  hex: '#7A6E8A', name: 'dusk'  },   // 졸림/심야
  alert:  { ansi: '\x1b[31m', hex: '#D2683E', name: 'amber' },   // 임박/에러
};

// ── 기분 사전: face는 눈, paws는 앞발 동작, line은 곰이 건네는 한 마디 ──
// 메시지는 전부 "위로/응원" 톤. 절대 혼내지 않는다. (ko/en 동시 제공)
const MOODS = {
  cheerful: {
    face: '◕ᴥ◕', paws: '( ﾉ ﾉ )', palette: 'happy',
    ko: '좋아, 오늘 컨디션 최고야! 🐾', en: "We're on a roll today! 🐾",
  },
  content: {
    face: '•ᴥ•', paws: '( u u )', palette: 'calm',
    ko: '잘 하고 있어, 천천히 가보자.', en: 'Steady and good. No rush.',
  },
  cozy: {
    face: '˘ᴥ˘', paws: '( ᵕ ᵕ )', palette: 'warm',
    ko: '따뜻한 차 한 잔 어때? ☕', en: 'How about a warm cup of tea? ☕',
  },
  pat: { // 막혔을 때 — 토닥토닥
    face: 'ᵔᴥᵔ', paws: '( ╹ ╹ )', palette: 'tender',
    ko: '괜찮아, 막힐 수도 있지. 같이 해보자. 🐾', en: "It's okay to get stuck. Let's try together. 🐾",
  },
  cheer: { // 완료 — 박수 대신 손 흔들며 응원
    face: '≧ᴥ≦', paws: '٩( ᴗ )۶', palette: 'happy',
    ko: '해냈다! 정말 잘했어! 👏', en: 'You did it! Well done! 👏',
  },
  sleepy: { // 한도 임박이 아니라 심야 — 재워주는 곰
    face: '-ᴥ-', paws: '( ˘ ˘ )', palette: 'sleepy',
    ko: '늦었네… 이제 자도 괜찮아. 🌙', en: "It's late… it's okay to rest now. 🌙",
  },
  worried: { // 한도/비용 임박 — 다그치지 않고 살짝 걱정
    face: 'ᵕᴥᵕ', paws: '( ⹁ ⹁ )', palette: 'alert',
    ko: '조금만 아껴 쓰자, 무리하지 말고. 💛', en: "Let's pace ourselves, no overdoing it. 💛",
  },
  hug: { // 에러 — 혼내는 게 아니라 안아줌
    face: 'ᴗᴥᴗ', paws: '\\( ´ ` )/', palette: 'tender',
    ko: '에러 났구나. 자, 안아줄게. 다시 가보자. 🤗', en: "An error, huh. Here's a hug. Let's go again. 🤗",
  },
};

// ── 세션 신호 → 기분 선택 ──
// signals: { usage, error, done, stuckMinutes, hour, activity }
//   usage: 0~100 한도%   error: bool   done: bool
//   stuckMinutes: 마지막 변화 이후 멈춘 시간(분)   hour: 0~23 로컬시각
//   activity: 'high'|'low' (선택)
function pickMood(signals = {}) {
  const { usage = 0, error = false, done = false,
          stuckMinutes = 0, hour = new Date().getHours(), activity } = signals;
  if (error) return 'hug';                 // 위로 최우선
  if (done) return 'cheer';
  if (stuckMinutes >= 10) return 'pat';    // 오래 막힘 → 토닥
  if (usage >= 90) return 'worried';
  if (hour >= 1 && hour < 6) return 'sleepy'; // 새벽
  if (usage >= 70) return 'cozy';          // 슬슬 쉬어가자(주의지만 따뜻하게)
  if (activity === 'high') return 'cheerful';
  if (activity === 'low') return 'content';
  return 'content';
}

function getMood(key) {
  const m = MOODS[key] || MOODS.content;
  return { ...m, paletteObj: PALETTE[m.palette] };
}

function line(key, lang = 'ko') {
  const m = MOODS[key] || MOODS.content;
  return lang.startsWith('en') ? m.en : m.ko;
}

// ── 3줄 ASCII 곰 (기존 statusline과 같은 결, 앞발은 기분따라 동작) ──
function renderAscii(key, { color = true } = {}) {
  const m = getMood(key);
  const c = color ? m.paletteObj.ansi : '';
  const r = color ? '\x1b[0m' : '';
  const ears = ` ∩${'─'.repeat(m.face.length + 2)}∩`;
  const face = `ʕ  ${m.face}  ʔ`;
  const paws = ` ${m.paws}`;
  return [`${c}${ears}${r}`, `${c}${face}${r}`, `${c}${paws}${r}`].join('\n');
}

// ── 원시 상태 파일 → pickMood 신호 변환 (순수 함수, 프런트/노드 공용) ──
// state: { usage, lastActivityAt, event:{type,at}, activity }  (state.js가 기록)
// 이벤트(error/done)는 순간 신호라 EVENT_TTL_MS 동안만 살아있다 → 곰이 잠깐 반응 후 평소로.
const EVENT_TTL_MS = 8000;
function deriveSignals(state = {}, nowMs = Date.now(), hour = new Date().getHours()) {
  const ev = state.event || {};
  const fresh = ev.at && nowMs - ev.at < EVENT_TTL_MS;
  const stuckMinutes = state.lastActivityAt
    ? Math.floor((nowMs - state.lastActivityAt) / 60000) : 0;
  return {
    usage: state.usage || 0,
    error: fresh && ev.type === 'error',
    done: fresh && ev.type === 'done',
    stuckMinutes,
    hour,
    activity: state.activity || undefined,
  };
}

// ── 부드러운 뽀모도로(휴식 넛지) — 누적 집중시간이 임계 넘으면 한 번 넛지 (순수 함수) ──
// 다그치지 않고 "한참 했네, 쉬어갈까?" 톤. 신호의 lastActivityAt(최근 활동)로 집중중 판단.
// st: { workStartAt, nudgedAt }  활동중이면 집중 누적 / 충분히 쉬면 사이클 리셋.
function tickBreakNudge(st = {}, lastActivityAt = 0, nowMs = Date.now(), opts = {}) {
  const focusMs = opts.focusMs || 50 * 60 * 1000;        // 50분 집중하면 휴식 권유
  const idleResetMs = opts.idleResetMs || 5 * 60 * 1000; // 5분 이상 쉬면 사이클 리셋
  const activeWindowMs = opts.activeWindowMs || 90 * 1000; // 최근 90초 내 활동=집중중
  const active = !!lastActivityAt && nowMs - lastActivityAt < activeWindowMs;
  let workStartAt = st.workStartAt || null;
  let nudgedAt = st.nudgedAt || 0;
  let nudge = false;
  if (active) {
    if (!workStartAt) workStartAt = nowMs;               // 새 집중 시작점
    if (nowMs - workStartAt >= focusMs) {                // 임계 도달 → 한 번 넛지 후 다음 사이클
      nudge = true; workStartAt = nowMs; nudgedAt = nowMs;
    }
  } else if (lastActivityAt && nowMs - lastActivityAt > idleResetMs) {
    workStartAt = null;                                  // 충분히 쉼 → 리셋
  }
  return { st: { workStartAt, nudgedAt }, nudge };
}

const TODAK = {
  name: { ko: '토닥곰', en: 'Todak' },
  tagline: { ko: '혼내지 않고 토닥이는 곰', en: 'The bear that comforts, never scolds' },
};

const api = { TODAK, PALETTE, MOODS, pickMood, getMood, line, renderAscii, deriveSignals, EVENT_TTL_MS, tickBreakNudge };

// CommonJS + ESM 동시 지원 (Node 스크립트와 Tauri 프런트 둘 다에서 import)
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Todak = api;
