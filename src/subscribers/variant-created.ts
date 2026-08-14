import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function handleVariantCreated({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const variantId = data.id
  const productModule = container.resolve(Modules.PRODUCT)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)

  const variant = await productModule.retrieveProductVariant(variantId, {
    relations: ["product"],
  })

  if (!variant?.sku || !variant.manage_inventory) {
    return
  }

  const [locations] = await stockLocationModule.listStockLocations({}, { take: 1 })
  if (!locations) {
    console.warn(`[Subscriber: variant-created] No stock location found to assign variant ${variantId}`)
    return
  }

  const inventoryTitle = `${variant.product?.title ?? "Product"} - ${variant.title}`

  const { result: inventoryItems } = await createInventoryItemsWorkflow(container).run({
    input: {
      items: [
        {
          sku: variant.sku,
          title: inventoryTitle,
          location_levels: [
            {
              location_id: locations.id,
              stocked_quantity: -1,
            },
          ],
        },
      ],
    },
  })

  const inventoryItem = inventoryItems[0]
  if (!inventoryItem) {
    return
  }

  const link = container.resolve(ContainerRegistrationKeys.LINK)
  await link.create([
    {
      [Modules.PRODUCT]: {
        variant_id: variant.id,
      },
      [Modules.INVENTORY]: {
        inventory_item_id: inventoryItem.id,
      },
    },
  ])
}

export const config: SubscriberConfig = {
  event: "product-variant.created",
}