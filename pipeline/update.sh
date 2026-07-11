#!/bin/bash
# 블룸케어 데이터 업데이트 (다운로드 방식)
# 구글 시트에서 [파일 → 다운로드 → CSV] 한 뒤, 이 스크립트만 실행하면
# 다운로드 폴더의 최신 CSV를 자동으로 잡아 검증·빌드합니다.
#
#   bash pipeline/update.sh
#
set -e
cd "$(dirname "$0")/.."
DL="$HOME/Downloads"

# 최근 30분 내 받은 .csv 중 우리 스키마(첫 열이 id,scope,...)인 최신 파일 찾기
newest=""
while IFS= read -r f; do
  head -1 "$f" | grep -q '^id,scope,variant_of,name' && { newest="$f"; break; }
done < <(ls -t "$DL"/*.csv 2>/dev/null)

if [ -z "$newest" ]; then
  echo "❌ 다운로드 폴더에서 블룸케어 CSV를 못 찾았어요."
  echo "   구글 시트에서 [파일 → 다운로드 → 쉼표로 구분된 값(.csv)]을 먼저 하세요."
  echo "   (첫 줄이 'id,scope,variant_of,name...' 으로 시작하는 파일이어야 해요)"
  exit 1
fi

echo "📥 사용할 파일: $(basename "$newest")"
cp "$newest" pipeline/programs.csv

# 검증 + 빌드 (오류 있으면 build.mjs가 멈춤)
node pipeline/build.mjs pipeline/programs.csv

echo ""
echo "✅ 완료. 배포하려면:"
echo "   git add -A && git commit -m \"데이터 수정\" && git push"
