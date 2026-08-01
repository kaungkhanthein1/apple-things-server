import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { HOME_BANNER_MODULE } from "../../../../../modules/home-banner"
import type { HomeBannerDTO, IHomeBannerModuleService } from "../../../../../modules/home-banner/types"

const VALID_TARGET_TYPES = ["product", "collection", "category", "url", "none"]

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

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

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  const banner = await homeBannerService.retrieveHomeBanner(req.params.id)

  return res.json({ banner: mapBannerForAdmin(banner) })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  const body = req.body as Record<string, unknown>

  const updatePayload: Record<string, unknown> = { id: req.params.id }

  if ("title" in body) updatePayload.title = normalizeOptionalText(body.title) ?? ""
  if ("image_url" in body && typeof body.image_url === "string") updatePayload.image_url = body.image_url.trim()
  if ("target_type" in body && typeof body.target_type === "string" && VALID_TARGET_TYPES.includes(body.target_type)) {
    updatePayload.target_type = body.target_type
  }
  if ("target_id" in body) updatePayload.target_id = normalizeOptionalText(body.target_id)
  if ("target_url" in body) updatePayload.target_url = normalizeOptionalText(body.target_url)
  if ("sort_order" in body) updatePayload.sort_order = body.sort_order
  if ("is_active" in body) updatePayload.is_active = body.is_active
  if ("starts_at" in body) updatePayload.starts_at = normalizeOptionalText(body.starts_at)
  if ("ends_at" in body) updatePayload.ends_at = normalizeOptionalText(body.ends_at)

  const updated = await homeBannerService.updateHomeBanners(updatePayload)
  const banner = Array.isArray(updated) ? updated[0] : updated

  return res.json({ banner: mapBannerForAdmin(banner) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  await homeBannerService.deleteHomeBanners(req.params.id)

  return res.status(204).send()
}
