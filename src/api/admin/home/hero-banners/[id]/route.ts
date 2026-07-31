import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { z } from "zod"
import { HOME_BANNER_MODULE } from "../../../../../modules/home-banner"
import type { HomeBannerDTO, IHomeBannerModuleService } from "../../../../../modules/home-banner/types"

const UpdateHomeBannerSchema = z.object({
  title: z.string().trim().max(200).optional(),
  image_url: z.string().trim().min(1).max(2000).optional(),
  target_type: z.enum(["product", "collection", "category", "url", "none"]).optional(),
  target_id: z.string().trim().max(200).optional().nullable(),
  target_url: z.string().trim().max(2000).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  starts_at: z.string().trim().max(80).optional().nullable(),
  ends_at: z.string().trim().max(80).optional().nullable(),
})

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

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
  const validationResult = UpdateHomeBannerSchema.safeParse(req.body)

  if (!validationResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validationResult.error.issues,
    })
  }

  const data = validationResult.data
  const updatePayload: Record<string, unknown> = { id: req.params.id }

  if ("title" in data) updatePayload.title = data.title?.trim() ?? ""
  if ("image_url" in data && data.image_url) updatePayload.image_url = data.image_url.trim()
  if ("target_type" in data) updatePayload.target_type = data.target_type
  if ("target_id" in data) updatePayload.target_id = normalizeOptionalText(data.target_id)
  if ("target_url" in data) updatePayload.target_url = normalizeOptionalText(data.target_url)
  if ("sort_order" in data) updatePayload.sort_order = data.sort_order
  if ("is_active" in data) updatePayload.is_active = data.is_active
  if ("starts_at" in data) updatePayload.starts_at = normalizeOptionalText(data.starts_at)
  if ("ends_at" in data) updatePayload.ends_at = normalizeOptionalText(data.ends_at)

  const updated = await homeBannerService.updateHomeBanners(updatePayload)
  const banner = Array.isArray(updated) ? updated[0] : updated

  return res.json({ banner: mapBannerForAdmin(banner) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  await homeBannerService.deleteHomeBanners(req.params.id)

  return res.status(204).send()
}
