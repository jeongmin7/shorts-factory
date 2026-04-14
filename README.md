# Shorts Factory

AI를 활용해 인물 스토리 기반의 쇼츠 영상을 자동으로 생성하고 YouTube 및 Telegram에 업로드하는 자동화 파이프라인입니다.

## 주요 기능

- **AI 대본 생성**: Gemini를 활용한 인물 스토리 기반 대본 자동 작성
- **AI 이미지 생성**: fal.ai를 활용한 장면별 이미지 자동 생성
- **다국어 TTS**: 언어별 최적화된 TTS 엔진 적용
  - 한국어/영어: ElevenLabs
  - 일본어: VOICEVOX
  - 중국어: Qwen3-TTS
- **자막 생성**: TTS 기반 자동 자막 싱크
- **영상 합성**: 이미지 + 음성 + 자막 합성으로 쇼츠 영상 완성
- **자동 업로드**: YouTube API 및 Telegram Bot을 통한 멀티 플랫폼 업로드

## 파이프라인 구조

```
대본 입력
  → 장면 분할 + 번역
  → 이미지 생성 (fal.ai)
  → 음성 생성 (TTS)
  → 자막 생성 (SRT)
  → 영상 렌더링
  → YouTube / Telegram 업로드
```

각 단계는 Prisma로 상태를 관리하며, 진행률을 실시간으로 추적합니다.

## 기술 스택

- **Framework**: Next.js (App Router), TypeScript
- **Database**: Prisma
- **AI 대본**: Google Gemini
- **AI 이미지**: fal.ai
- **TTS**: ElevenLabs, VOICEVOX, Qwen3-TTS
- **인프라**: Docker
- **업로드**: YouTube Data API v3, Telegram Bot API

## 실행 방법

1. `.env.example`을 복사하여 `.env` 생성 후 API 키 입력

2. 의존성 설치

```bash
npm install
```

3. 개발 서버 실행

```bash
npm run dev
```
