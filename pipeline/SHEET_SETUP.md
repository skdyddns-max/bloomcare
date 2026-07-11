# 📊 블룸케어 시트 파이프라인

제도 데이터를 **구글 시트에서 편집** → 스크립트가 검증하고 `data/programs.js`를 자동 생성합니다.
이제 금액 하나 고치려고 5,600줄짜리 코드 파일을 뒤질 필요가 없어요.

```
구글 시트(편집)  →  웹에 게시(CSV)  →  node build.mjs  →  data/programs.js  →  git push  →  라이브
```

---

## 처음 한 번만: 시트 만들기

1. **시작 CSV 뽑기**
   ```bash
   cd ~/projects/child-support-map
   node pipeline/export-csv.mjs      # → pipeline/programs.csv (현재 282건)
   ```

2. **구글 시트로 가져오기**
   - 새 구글 시트 → `파일 → 가져오기 → 업로드` → `pipeline/programs.csv`
   - "가져오기 위치": **현재 시트 바꾸기**, 구분 기호: 쉼표

3. **웹에 게시(CSV)** — 스크립트가 읽어갈 주소 만들기
   - `파일 → 공유 → 웹에 게시`
   - 게시할 대상: **해당 시트 탭** 선택, 형식: **쉼표로 구분된 값(.csv)**
   - `게시` → 나오는 URL 복사 (`.../pub?gid=...&single=true&output=csv` 형태)
   - 이 URL을 `pipeline/sheet-url.txt` 에 붙여넣어 저장해 두면 편해요.

> 데이터는 어차피 공개 사이트에 실리므로 '웹에 게시'로 공개돼도 문제 없습니다.
> 편집 권한은 본인 계정에만 있으니 아무나 고칠 수 없어요.

---

## 매번: 고치고 반영하기 (다운로드 방식 — 채택)

1. **구글 시트에서 셀 편집** (금액·전화번호·문구 등)
   - 새 제도 = 새 행 추가 / 삭제 = 행 삭제
   - `id`는 고유해야 하고, 굵게는 `<b>...</b>`, 지역은 `scope` 열 규칙을 따르세요(아래 참고).

2. **CSV로 다운로드**: 시트에서 `파일 → 다운로드 → 쉼표로 구분된 값(.csv)`
   (다운로드 폴더에 저장됩니다. 이름은 무엇이든 상관없어요.)

3. **한 줄 실행** — 다운로드 폴더의 최신 CSV를 자동으로 잡아 검증·빌드:
   ```bash
   cd ~/projects/child-support-map
   bash pipeline/update.sh
   ```
   - 통과하면 `data/programs.js`가 새로 써지고 **캐시버스터(`?v=`)가 자동 증가**합니다.
   - 오류(필수 필드 누락·id 중복·연령 역전·`<b>` 태그 짝·`variant_of` 참조 없음)가 있으면 **빌드를 멈추고** 무엇이 문제인지 알려줍니다. 시트에서 고치고 다시 다운로드→실행하면 돼요.

4. **배포**:
   ```bash
   git add -A && git commit -m "데이터 수정: (내용)" && git push
   ```
   몇 분 뒤 https://skdyddns-max.github.io/bloomcare/ 에 반영됩니다.

> 검증만 미리 보고 싶으면: `node pipeline/build.mjs --check pipeline/programs.csv`
> (참고) '웹에 게시 URL' 방식을 쓰고 싶으면 `node pipeline/build.mjs --url "<게시CSV주소>"` 도 지원합니다.

---

## 열(컬럼) 설명

| 열 | 의미 | 예 |
|---|---|---|
| `id` | 고유 영문 슬러그(중복 금지) | `dev-rehab-voucher` |
| `scope` | 지역/분류 코드 | `national`, `infant`, `seoul`, `su-gu-강남구`, `gg-sgg-수원시` |
| `variant_of` | 이 카드가 대체하는 상위 카드 id (지역 심층판) | `special-ed-therapy-support` |
| `name` | 제목 | |
| `agency` | 관할·신청처(전화 포함 가능) | |
| `target_age` | 대상 연령 문구 | `만 18세 미만` |
| `age_min_months` / `age_max_months` | 매칭용 개월(빈칸=제한 없음) | `0` / `71` |
| `requires_disability_reg` | `yes`(등록 필수) / `partial`(진단서 대체 가능) / `no` | |
| `requires_sped` | 특수교육대상자 필요 시 `TRUE` | |
| `requires_parent_disability` | 부모 장애 필요 시 `TRUE` | |
| `excludes_child_disability` | 아동 비장애여야 하면 `TRUE` | |
| `excludes_sped` | 특교 선정자 제외면 `TRUE` | |
| `income_limit_pct` | 소득 상한 %(숫자, 빈칸=소득 무관) | `180` |
| `income_limit_text` | 소득 표기 문구 | `기준중위소득 180% 이하` |
| `benefit` | 지원 내용(굵게 `<b>월 26만원</b>` 가능) | |
| `how_to_apply` | 신청 방법 | |
| `note` | 실무 팁(카드에서 접힘) | |
| `link` | 공식 안내 URL | |
| `verified` | 확인 기준연도 — **반드시 연도 포함** | `2026 확인` |

**전화번호**는 본문에 그냥 적으면 앱에서 자동으로 눌러서 전화되는 링크가 됩니다(`032-880-5472` 형태).

### scope 코드 규칙
- 전국: `national` / 영유아 공통: `infant`
- 시·도: `seoul` `busan` `gyeonggi` … / 교육청: `edu-seoul` `edu-busan` …
- 구·시군 디렉토리: `su-gu-<구>`(서울) · `ic-gun-<구>`(인천) · `gg-sgg-<시군>`(경기) · `jn-gun-<군>`(전남) · `jb-gun-<시군>`(전북) · `gj-<구영문>`(광주)
- **새 지역을 추가**하려면 `index.html`의 `SCOPES`/`GROUPS`에도 등록해야 화면에 그룹이 나옵니다(구조만 알면 5분).

---

## 파일

- `lib.mjs` — CSV↔JS 변환·검증 공용 로직
- `export-csv.mjs` — 현재 데이터 → CSV(시트 초기 적재용)
- `build.mjs` — 시트/CSV → `data/programs.js` + 캐시버스터
- `programs.csv` — 내보내기 결과(시트에 올리는 원본, git 추적)
