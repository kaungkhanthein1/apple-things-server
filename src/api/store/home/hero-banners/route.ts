import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { HOME_BANNER_MODULE } from "../../../../modules/home-banner"
import type { HomeBannerDTO, IHomeBannerModuleService } from "../../../../modules/home-banner/types"
import { isVisibleHomeBanner, sortHomeBanners } from "../../../../modules/home-banner/utils"

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

function parseLimit(limit: unknown): number {
  const parsed = Number.parseInt(String(limit ?? DEFAULT_LIMIT), 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }
  return Math.min(parsed, MAX_LIMIT)
}

function mapBanner(banner: HomeBannerDTO) {
  return {
    id: banner.id,
    title: banner.title,
    image_url: banner.image_url,
    target_type: banner.target_type,
    target_id: banner.target_id,
    target_url: banner.target_url,
    sort_order: banner.sort_order,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  const limit = parseLimit(req.query.limit)
  const banners = await homeBannerService.listHomeBanners()
  const visible = sortHomeBanners(banners.filter((banner) => isVisibleHomeBanner(banner))).slice(0, limit)

  return res.json({
    banners: visible.map(mapBanner),
    count: visible.length,
  })
}
