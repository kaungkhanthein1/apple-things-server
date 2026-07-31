import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { z } from "zod"
import { HOME_BANNER_MODULE } from "../../../../modules/home-banner"
import type { HomeBannerDTO, IHomeBannerModuleService } from "../../../../modules/home-banner/types"
import { sortHomeBanners } from "../../../../modules/home-banner/utils"

const TargetTypeSchema = z.enum(["product", "collection", "category", "url", "none"])

const CreateHomeBannerSchema = z.object({
  title: z.string().trim().max(200).optional().default(""),
  image_url: z.string().trim().min(1).max(2000),
  target_type: TargetTypeSchema.default("none"),
  target_id: z.string().trim().max(200).optional().nullable(),
  target_url: z.string().trim().max(2000).optional().nullable(),
  sort_order: z.number().int().optional().default(0),
  is_active: z.boolean().optional().default(true),
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
  const banners = await homeBannerService.listHomeBanners()

  return res.json({
    banners: sortHomeBanners(banners).map(mapBannerForAdmin),
    count: banners.length,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const homeBannerService = req.scope.resolve<IHomeBannerModuleService>(HOME_BANNER_MODULE)
  const validationResult = CreateHomeBannerSchema.safeParse(req.body)

  if (!validationResult.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validationResult.error.issues,
    })
  }

  const data = validationResult.data
  const created = await homeBannerService.createHomeBanners({
    title: data.title.trim(),
    image_url: data.image_url.trim(),
    target_type: data.target_type,
    target_id: normalizeOptionalText(data.target_id),
    target_url: normalizeOptionalText(data.target_url),
    sort_order: data.sort_order,
    is_active: data.is_active,
    starts_at: normalizeOptionalText(data.starts_at),
    ends_at: normalizeOptionalText(data.ends_at),
  })
  const banner = Array.isArray(created) ? created[0] : created

  return res.status(201).json({
    banner: mapBannerForAdmin(banner),
  })
}
