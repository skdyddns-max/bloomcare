#!/usr/bin/env node
// 시트(또는 로컬 CSV) → data/programs.js 재생성 + 캐시버스터 자동 증가
//
// 사용법:
//   node pipeline/build.mjs                      # pipeline/programs.csv 로 빌드
//   node pipeline/build.mjs path/to.csv          # 특정 CSV 파일로 빌드
//   node pipeline/build.mjs --url "<게시 CSV URL>"  # 구글 시트 '웹에 게시' CSV URL로 빌드
//   node pipeline/build.mjs --check              # 빌드 없이 검증만
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseCSV, rowsToPrograms, toProgramsJS, validate } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const urlFlag = args.indexOf('--url');

async function loadCSV() {
  if (urlFlag !== -1) {
    const url = args[urlFlag + 1];
    if (!url) throw new Error('--url 뒤에 게시 CSV URL을 넣으세요.');
    console.log('🌐 시트 게시 CSV 내려받는 중…');
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`시트 요청 실패: HTTP ${res.status}`);
    return await res.text();
  }
  const file = args.find(a => a.endsWith('.csv')) || join(here, 'programs.csv');
  return readFileSync(file, 'utf8');
}

const csv = await loadCSV();
const rows = rowsToPrograms(parseCSV(csv));
const { errors, warnings } = validate(rows);

console.log(`\n📋 ${rows.length}건 파싱`);
if (warnings.length) { console.log(`\n⚠️  경고 ${warnings.length}건:`); warnings.slice(0, 30).forEach(w => console.log('  ', w)); }
if (errors.length) {
  console.log(`\n❌ 오류 ${errors.length}건 — 빌드 중단:`);
  errors.forEach(e => console.log('  ', e));
  process.exit(1);
}
console.log('✅ 검증 통과 (오류 0건)');

if (checkOnly) { console.log('\n(--check: 파일을 쓰지 않았습니다.)'); process.exit(0); }

// 1) data/programs.js 재생성
const js = toProgramsJS(rows);
writeFileSync(join(root, 'data', 'programs.js'), js);
console.log(`\n💾 data/programs.js 갱신 (${rows.length}건)`);

// 2) 캐시버스터 = 건수 + 내용 해시 6자리 (내용이 바뀌면 무조건 버전이 바뀜)
const hash = createHash('sha1').update(js).digest('hex').slice(0, 6);
const version = `${rows.length}-${hash}`;
const idxPath = join(root, 'index.html');
let html = readFileSync(idxPath, 'utf8');
const re = /(data\/programs\.js\?v=)[\w-]+/;
if (!re.test(html)) {
  console.log('⚠️  index.html 에서 캐시버스터 패턴(data/programs.js?v=…)을 못 찾음 — 수동 확인 필요');
} else {
  const newHtml = html.replace(re, `$1${version}`);
  if (newHtml !== html) { writeFileSync(idxPath, newHtml); console.log(`🔖 캐시버스터 → ?v=${version}`); }
  else console.log(`🔖 캐시버스터 유지 (내용 동일): ?v=${version}`);
}

console.log('\n다음: git add -A && git commit && git push  → 몇 분 뒤 라이브 반영');
