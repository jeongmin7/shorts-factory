import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const raw = process.argv[2]
  if (!raw) {
    console.error('Usage: npx tsx scripts/trigger-pipeline.ts <json>')
    process.exit(1)
  }

  // Claude 응답에서 JSON 추출 (앞뒤에 텍스트가 있을 수 있음)
  const jsonMatch = raw.match(/\{[\s\S]*"title"[\s\S]*"script"[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('JSON 파싱 실패:', raw.substring(0, 200))
    process.exit(1)
  }

  const { title, script } = JSON.parse(jsonMatch[0])
  if (!title || !script) {
    console.error('title 또는 script 없음')
    process.exit(1)
  }

  if (script.length < 100 || script.length > 2000) {
    console.error(`대본 길이 부적절: ${script.length}자`)
    process.exit(1)
  }

  const video = await prisma.video.create({
    data: { title, script },
  })

  console.log(`영상 생성됨: ${video.id} - ${title}`)

  // 파이프라인은 Next.js 서버에서 실행해야 하므로 API 호출
  // 로컬이라 쿠키 없이 호출 — 인증 우회용 내부 트리거
  const res = await fetch('http://localhost:3000/api/generate/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId: video.id }),
  })

  if (res.ok) {
    console.log('파이프라인 시작됨')
  } else {
    console.error('파이프라인 트리거 실패:', await res.text())
  }

  await prisma.$disconnect()
}

main()
