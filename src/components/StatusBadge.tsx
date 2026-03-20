const statusConfig: Record<string, { label: string; color: string }> = {
  generating: { label: '생성중', color: 'bg-yellow-500' },
  completed: { label: '완료', color: 'bg-blue-500' },
  approved: { label: '승인됨', color: 'bg-green-500' },
  uploaded: { label: '업로드됨', color: 'bg-purple-500' },
  failed: { label: '실패', color: 'bg-red-500' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, color: 'bg-gray-500' }
  return (
    <span className={`${config.color} text-white text-xs px-2 py-1 rounded-full`}>
      {config.label}
    </span>
  )
}
