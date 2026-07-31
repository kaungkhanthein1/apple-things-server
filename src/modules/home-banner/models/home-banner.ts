import { model } from "@medusajs/framework/utils"

export const HomeBanner = model.define("home_banner", {
  id: model.id().primaryKey(),
  title: model.text().default(""),
  image_url: model.text(),
  target_type: model
    .enum(["product", "collection", "category", "url", "none"])
    .default("none"),
  target_id: model.text().nullable(),
  target_url: model.text().nullable(),
  sort_order: model.number().default(0),
  is_active: model.boolean().default(true),
  starts_at: model.text().nullable(),
  ends_at: model.text().nullable(),
})

export default HomeBanner
