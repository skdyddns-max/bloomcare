// 블룸케어 시트 파이프라인 공용 라이브러리
// 컬럼 스키마 — 이 순서가 CSV/시트의 열 순서가 됩니다.
export const COLUMNS = [
  'id', 'scope', 'variant_of', 'name', 'agency', 'target_age',
  'age_min_months', 'age_max_months',
  'requires_disability_reg', 'requires_sped', 'requires_parent_disability',
  'excludes_child_disability', 'excludes_sped',
  'income_limit_pct', 'income_limit_text',
  'benefit', 'how_to_apply', 'note', 'link', 'verified',
];

// 필드 타입 힌트
const NUM_FIELDS = new Set(['age_min_months', 'age_max_months', 'income_limit_pct']);
const BOOL_FIELDS = new Set(['requires_sped', 'requires_parent_disability', 'excludes_child_disability', 'excludes_sped']);
// requires_disability_reg 는 문자열 'yes'|'no'|'partial'

// ---------- CSV 직렬화 ----------
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export function toCSV(rows) {
  const lines = [COLUMNS.map(csvCell).join(',')];
  for (const p of rows) {
    lines.push(COLUMNS.map(c => {
      let v = p[c];
      if (BOOL_FIELDS.has(c)) v = v === true ? 'TRUE' : v === false ? 'FALSE' : '';
      return csvCell(v);
    }).join(','));
  }
  return lines.join('\n') + '\n';
}

// ---------- CSV 파싱 (따옴표·개행·콤마 안전) ----------
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  // 빈 행 제거
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// CSV 행 → 프로그램 객체 (타입 복원)
export function rowsToPrograms(rows) {
  const header = rows[0].map(h => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const p = {};
    for (const c of COLUMNS) {
      const raw = idx[c] != null ? (row[idx[c]] ?? '').trim() : '';
      if (raw === '') {
        // null 명시가 필요한 숫자 필드는 null, 나머지는 생략
        if (NUM_FIELDS.has(c)) p[c] = null;
        continue;
      }
      if (NUM_FIELDS.has(c)) p[c] = Number(raw);
      else if (BOOL_FIELDS.has(c)) p[c] = /^(true|1|y|yes)$/i.test(raw);
      else p[c] = raw;
    }
    out.push(p);
  }
  return out;
}

// ---------- JS 데이터 파일 생성 ----------
function jsValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  return JSON.stringify(v); // 문자열: 따옴표·이스케이프 안전
}
export function toProgramsJS(rows) {
  const body = rows.map(p => {
    const fields = COLUMNS
      .filter(c => c in p && !(p[c] === null && c === 'variant_of'))
      .map(c => `    ${c}: ${jsValue(p[c])}`)
      .join(',\n');
    return `  {\n${fields}\n  }`;
  }).join(',\n');
  return `// 블룸케어(BloomCare) — 지원제도 데이터
// ⚠️ 이 파일은 시트 파이프라인이 자동 생성합니다. 직접 수정하지 말고 시트에서 편집 후 build 하세요.
// 생성: pipeline/build.mjs  (스키마·절차는 pipeline/SHEET_SETUP.md)
const PROGRAMS = [
${body}
];
`;
}

// ---------- 검증 (내 audit과 동일 규칙) ----------
export function validate(rows) {
  const errors = [], warnings = [];
  const ids = new Set();
  const REQUIRED = ['id', 'scope', 'name', 'agency', 'benefit', 'how_to_apply', 'link', 'verified'];
  const validReg = new Set(['yes', 'no', 'partial', '']);
  for (const p of rows) {
    for (const f of REQUIRED) if (!p[f]) errors.push(`[${p.id || '?'}] 필수 필드 누락: ${f}`);
    if (ids.has(p.id)) errors.push(`[${p.id}] id 중복`);
    ids.add(p.id);
    if (p.age_min_months != null && p.age_max_months != null && p.age_min_months > p.age_max_months)
      errors.push(`[${p.id}] 연령 역전: ${p.age_min_months} > ${p.age_max_months}`);
    if (p.requires_disability_reg != null && !validReg.has(p.requires_disability_reg))
      errors.push(`[${p.id}] requires_disability_reg 값 오류: ${p.requires_disability_reg} (yes|no|partial 만)`);
    for (const f of ['benefit', 'note', 'how_to_apply']) {
      const s = p[f] || '';
      if ((s.match(/<b>/g) || []).length !== (s.match(/<\/b>/g) || []).length)
        errors.push(`[${p.id}] <b> 태그 짝 불일치: ${f}`);
    }
    if (p.link && !/^https?:\/\//.test(p.link)) warnings.push(`[${p.id}] 링크 형식 확인: ${p.link}`);
    if (!/20\d\d/.test(p.verified || '')) warnings.push(`[${p.id}] verified 연도 표기 없음: ${p.verified}`);
  }
  // variant_of 참조 무결성
  for (const p of rows) if (p.variant_of && !ids.has(p.variant_of))
    errors.push(`[${p.id}] variant_of 참조 없음: ${p.variant_of}`);
  return { errors, warnings };
}
