#!/bin/bash
export SHELL=/bin/bash
# 매일 자동 실행 — Claude로 대본 생성 후 영상 파이프라인 시작
# 로그: /tmp/daily-generate.log

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:$PATH"
export HOME="/Users/jeongmin"
export TERM=xterm-256color

LOG="/tmp/daily-generate.log"
cd /Users/jeongmin/youtube-shorts-automation

PROMPT='너는 전 세계적으로 유명한 정치인, 기업가, 예술가들의 알려지지 않은 실화와 독특한 습관을 추적하는 전문 작가야. 모든 내용은 전기, 공식 인터뷰, 신뢰도 높은 언론 보도에 기반한 팩트여야 해.

순수 대사만 출력해. [도입], [본문] 같은 라벨 없이 TTS가 바로 읽을 수 있는 문장만.
첫 문장은 시청자의 고정관념을 깨는 충격적 팩트로 시작해.
검증된 사실만 다뤄. 인물의 성공 뒤에 숨겨진 기행이나 인간적인 면모에 집중해.
문장은 2초 내외로 읽히도록 짧게 끊어 쳐.
마지막 문장은 반드시 "나만 이 정보 알고 죽을 수 없습니다."로 끝내.

대상: 도널드 트럼프, 일론 머스크, 제프 베이조스, 스티브 잡스, 워런 버핏, 역사적 위인 등에서 하나를 골라 새로운 에피소드로 대본을 써.

반드시 아래 JSON 형식으로만 응답해:
{"title": "인물이름 또는 짧은 제목", "script": "대본 전문 (100~500자)"}'

echo "[$(date)] 대본 생성 시작 (HOME=$HOME, claude=$(which claude))" >> "$LOG"

# 이미 생성된 제목 목록 가져오기 (중복 방지)
EXISTING=$(npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.video.findMany({ select: { title: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  .then(vs => { console.log(vs.map(v => v.title).join(', ')); return p.\$disconnect(); });
" 2>/dev/null)

FULL_PROMPT="$PROMPT

이미 다룬 주제 (절대 겹치지 마): $EXISTING"

# Claude로 대본 생성
RAW=$(/opt/homebrew/bin/claude -p "$FULL_PROMPT" 2>/tmp/claude-stderr.txt)
cat /tmp/claude-stderr.txt >> "$LOG"
echo "[$(date)] Claude 응답 길이: ${#RAW}" >> "$LOG"
echo "[$(date)] Claude 응답 앞부분: ${RAW:0:200}" >> "$LOG"

if [ -z "$RAW" ]; then
  echo "[$(date)] Claude 응답 없음" >> "$LOG"
  exit 1
fi

# JSON 추출 후 DB에 직접 삽입 + 파이프라인 트리거
npx tsx scripts/trigger-pipeline.ts "$RAW" >> "$LOG" 2>&1
echo "[$(date)] 완료" >> "$LOG"
