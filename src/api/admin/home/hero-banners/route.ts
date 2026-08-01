import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { HOME_BANNER_MODULE } from "../../../../modules/home-banner"
import type { HomeBannerDTO, IHomeBannerModuleService } from "../../../../modules/home-banner/types"
import { sortHomeBanners } from "../../../../modules/home-banner/utils"

const VALID_TARGET_TYPES = ["product", "collection", "category", "url", "none"]

function mapBannerForAdmin(banner: HomeBannerDTO) {
  return {
    id: banner.id,
    title: banner.title,
    image_url: banner.image_url,
    target_type: banner.target_type,
    target_id: banner.target_id,
    target_url: banner.target_url,
    sort_order: banner.sort_order,
    is_active: banner.is_active,
    starts_at: banner.starts_at,
    ends_at: banner.ends_at,
    created_at: banner.created_at,
    updated_at: banner.updated_at,
  }
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  const banners = await homeBannerService.listHomeBanners()

  return res.json({
    banners: sortHomeBanners(banners).map(mapBannerForAdmin),
    count: banners.length,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  const body = req.body as Record<string, unknown>

  const image_url = typeof body.image_url === "string" ? body.image_url.trim() : ""
  if (!image_url) {
    return res.status(400).json({ error: "image_url is required" })
  }

  const targetType = typeof body.target_type === "string" && VALID_TARGET_TYPES.includes(body.target_type)
    ? body.target_type
    : "none"

  const created = await homeBannerService.createHomeBanners({
    title: normalizeOptionalText(body.title) ?? "",
    image_url,
    target_type: targetType as any,
    target_id: normalizeOptionalText(body.target_id),
    target_url: normalizeOptionalText(body.target_url),
    sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
    is_active: typeof body.is_active === "boolean" ? body.is_active : true,
    starts_at: normalizeOptionalText(body.starts_at),
    ends_at: normalizeOptionalText(body.ends_at),
  })
  const banner = Array.isArray(created) ? created[0] : created

  return res.status(201).json({ banner: mapBannerForAdmin(banner) })
}
