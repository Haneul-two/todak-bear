#!/usr/bin/env node
// dist/ 조립: Tauri(frontendDist=../dist)가 통째로 띄울 수 있게
// ui/index.html + 곰 코어를 한 폴더로 모으고, 코어 경로를 ./todak.js 로 고정한다.
const fs = require('fs');
const path = require('path');

const here = __dirname;
const dist = path.join(here, 'dist');
fs.mkdirSync(dist, { recursive: true });

// 1) 곰 코어(기분 로직) 복사
fs.copyFileSync(path.join(here, '../../packages/bear-core/todak.js'), path.join(dist, 'todak.js'));

// 2) 캐릭터 포즈 이미지 폴더 복사 (사용자 AI 도우미 곰)
const posesSrc = path.join(here, 'ui/poses');
const posesDst = path.join(dist, 'poses');
fs.mkdirSync(posesDst, { recursive: true });
for (const f of fs.readdirSync(posesSrc)) {
  if (f.endsWith('.png')) fs.copyFileSync(path.join(posesSrc, f), path.join(posesDst, f));
}

// 3) index.html 의 코어 경로를 dist 기준(./)으로 바꿔 복사
let html = fs.readFileSync(path.join(here, 'ui/index.html'), 'utf8');
html = html.replace('../../../packages/bear-core/todak.js', './todak.js');
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

console.log('🐻 dist 조립 완료 →', dist);
