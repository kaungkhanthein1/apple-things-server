import { MedusaService } from "@medusajs/framework/utils"
import { HomeBanner } from "./models/home-banner"

class HomeBannerModuleService extends MedusaService({
  HomeBanner,
}) {}

export default HomeBannerModuleService
