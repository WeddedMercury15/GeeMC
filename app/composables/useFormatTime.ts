export function useFormatTime() {
  const { t, locale } = useI18n()

  function formatTime(dateStr: string | number | Date): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return ''

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24))

    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const timeStr = `${hours}:${minutes}`

    if (diffDays === 0) return t('time.relative_today', { time: timeStr })
    if (diffDays === 1) return t('time.relative_yesterday', { time: timeStr })
    if (diffDays === 2) return t('time.relative_two_days_ago', { time: timeStr })

    const loc = locale.value
    const sameYear = date.getFullYear() === now.getFullYear()
    if (sameYear) {
      return new Intl.DateTimeFormat(loc, { month: 'numeric', day: 'numeric' }).format(date)
    }
    return new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
  }

  return { formatTime }
}
