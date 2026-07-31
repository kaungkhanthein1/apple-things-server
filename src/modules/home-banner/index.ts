import { Module } from "@medusajs/framework/utils"
import HomeBannerModuleService from "./service"

export const HOME_BANNER_MODULE = "homeBanner"

export default Module(HOME_BANNER_MODULE, {
  service: HomeBannerModuleService,
})

export * from "./models/home-banner"
