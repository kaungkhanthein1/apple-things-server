import type { HomeBannerDTO } from "./types"

function getDateValue(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

export function isVisibleHomeBanner(banner: HomeBannerDTO, now = new Date()): boolean {
  if (!banner.is_active) {
    return false
  }

  const nowTime = now.getTime()
  const startsAt = getDateValue(banner.starts_at)
  const endsAt = getDateValue(banner.ends_at)

  if (startsAt !== null && startsAt > nowTime) {
    return false
  }

  if (endsAt !== null && endsAt < nowTime) {
    return false
  }

  return true
}

export function sortHomeBanners(banners: HomeBannerDTO[]): HomeBannerDTO[] {
  return [...banners].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (orderDiff !== 0) {
      return orderDiff
    }

    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  })
}
