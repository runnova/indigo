export function timeAgo(timestamp) {
  if (timestamp < 1e12) timestamp *= 1000

  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(months / 12)

  if (seconds < 10) return "just now"
  if (minutes < 1) return `${seconds}s ago`
  if (minutes === 1) return "last minute"
  if (minutes < 60) return `${minutes}m ago`

  if (hours === 1) return "last hour"
  if (hours < 24) return `${hours}h ago`

  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`

  if (months === 1) return "last month"
  if (months < 12) return `${months}mo ago`

  if (years === 1) return "last year"
  return `${years}y ago`
}