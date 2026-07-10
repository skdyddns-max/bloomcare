#!/usr/bin/env node
// 현재 data/programs.js → pipeline/programs.csv
// (구글 시트에 처음 import 할 시작 파일을 만들 때 1회 사용)
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { toCSV } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'data', 'programs.js'), 'utf8');
const PROGRAMS = new Function(src + '; return PROGRAMS;')();

const out = join(here, 'programs.csv');
writeFileSync(out, toCSV(PROGRAMS));
console.log(`✅ ${PROGRAMS.length}건 → ${out}`);
console.log('   구글 시트에서 [파일 → 가져오기 → 업로드]로 이 CSV를 올리세요.');
