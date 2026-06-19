#!/usr/bin/env node
// bear-core(todak.js) 복사 + 포즈 3종 압축 → docs/play/assets/
// 런타임 의존성 아님: 이 스크립트는 에셋을 한 번 만들고, 산출물(PNG/JS)만 커밋된다.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const here = __dirname;                       // docs/play
const repoRoot = path.join(here, '..', '..'); // todak-bear/
const assets = path.join(here, 'assets');
const posesOut = path.join(assets, 'poses');
const posesSrc = path.join(repoRoot, 'apps/desktop/ui/poses');

fs.mkdirSync(posesOut, { recursive: true });

// 1) bear-core 복사 (브라우저에서 window.Todak 사용)
fs.copyFileSync(
  path.join(repoRoot, 'packages/bear-core/todak.js'),
  path.join(assets, 'todak.js'),
);

// 2) 포즈 3종 압축: 긴 변 256px 이내, PNG 최대 압축
(async () => {
  for (const key of ['content', 'cheer', 'hug']) {
    await sharp(path.join(posesSrc, key + '.png'))
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9 })
      .toFile(path.join(posesOut, key + '.png'));
    const kb = (fs.statSync(path.join(posesOut, key + '.png')).size / 1024).toFixed(0);
    console.log(`${key}.png → ${kb}KB`);
  }
  console.log('🐻 assets 빌드 완료');
})();
