#!/bin/bash
# 자막 싱크 테스트 스크립트 — API 호출 없이 기존 오디오로 테스트
# 사용법: ./scripts/test-subtitle-sync.sh [WAV파일경로] [장면수]

set -e

WAV_FILE="${1:-uploads/cmn1tgkkp000fra3nms1tis5u/tts/ko.wav}"
SCENE_COUNT="${2:-6}"

if [ ! -f "$WAV_FILE" ]; then
  echo "Error: $WAV_FILE not found"
  echo "Usage: ./scripts/test-subtitle-sync.sh <wav-file> <scene-count>"
  exit 1
fi

echo "=== 자막 싱크 테스트 ==="
echo "파일: $WAV_FILE"
echo "장면 수: $SCENE_COUNT"
echo ""

# 1. Duration
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WAV_FILE")
echo "총 길이: ${DURATION}s"
echo ""

# 2. Silence detection
echo "=== 무음 구간 감지 ==="
ffmpeg -i "$WAV_FILE" -af silencedetect=noise=-30dB:d=0.1 -f null - 2>&1 | grep "silence_" | while read line; do
  echo "  $line"
done
echo ""

# 3. Calculate boundaries (pick top N-1 longest)
echo "=== 장면 경계 계산 (가장 긴 무음 $((SCENE_COUNT-1))개) ==="
python3 -c "
import subprocess, re, sys

wav = '$WAV_FILE'
n_scenes = $SCENE_COUNT
duration = $DURATION

result = subprocess.run(['ffmpeg', '-i', wav, '-af', 'silencedetect=noise=-30dB:d=0.1', '-f', 'null', '-'], capture_output=True, text=True)
silences = []
start = None
for line in result.stderr.split('\n'):
    m = re.search(r'silence_start:\s*([\d.]+)', line)
    if m: start = float(m.group(1))
    m = re.search(r'silence_end:\s*([\d.]+)', line)
    if m and start is not None:
        silences.append({'start': start, 'end': float(m.group(1)), 'dur': float(m.group(1)) - start})
        start = None

gaps = [s for s in silences if s['start'] > 0.3 and s['end'] < duration - 0.3]
needed = n_scenes - 1
top = sorted(gaps, key=lambda s: s['dur'], reverse=True)[:needed]
top_sorted = sorted(top, key=lambda s: s['start'])

print('선택된 경계:')
for s in top_sorted:
    print(f'  {s[\"start\"]:.2f}s ~ {s[\"end\"]:.2f}s (무음 {s[\"dur\"]:.2f}s)')

boundaries = [(s['start'] + s['end']) / 2 for s in top_sorted]
points = [0] + boundaries + [duration]
durations = [points[i+1] - points[i] for i in range(len(points)-1)]

print(f'\n=== SRT 타이밍 ===')
offset = 0
for i, dur in enumerate(durations):
    print(f'  장면 {i+1}: {offset:.2f}s ~ {offset+dur:.2f}s ({dur:.2f}s)')
    offset += dur

print(f'\n=== 확인 방법 ===')
print(f'오디오 재생하면서 위 시간에 장면이 전환되는지 확인하세요.')
print(f'  open {wav}')
"
