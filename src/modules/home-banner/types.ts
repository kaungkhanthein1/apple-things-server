import type HomeBannerModuleService from "./service"

export type HomeBannerTargetType =
  | "product"
  | "collection"
  | "category"
  | "url"
  | "none"

export interface HomeBannerDTO {
  id: string
  title: string
  image_url: string
  target_type: HomeBannerTargetType
  target_id: string | null
  target_url: string | null
  sort_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at?: Date | string
  updated_at?: Date | string
}

export type IHomeBannerModuleService = HomeBannerModuleService
