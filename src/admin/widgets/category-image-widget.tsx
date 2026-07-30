import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Text, toast } from "@medusajs/ui"
import type { DetailWidgetProps, AdminProductCategory } from "@medusajs/types"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

const CategoryImageWidget = ({ data: category }: DetailWidgetProps<AdminProductCategory>) => {
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()
  const currentImageUrl = (category.metadata?.image_url as string) || null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // 1. Upload to /store/uploads
      const formData = new FormData()
      formData.append("files", file)

      const uploadRes = await fetch("/store/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      if (!uploadRes.ok) throw new Error("Failed to upload image")
      const uploadData = await uploadRes.json()
      const fileUrl = uploadData.files?.[0]?.url
      if (!fileUrl) throw new Error("Image URL missing from response")

      // 2. Update category metadata
      const updateRes = await fetch(`/admin/product-categories/${category.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            ...category.metadata,
            image_url: fileUrl,
          },
        }),
      })
      if (!updateRes.ok) throw new Error("Failed to update category metadata")

      toast.success("Success", { description: "Category image updated successfully." })
      queryClient.invalidateQueries({ queryKey: ["product_categories"] })
    } catch (error: any) {
      toast.error("Error", { description: error.message || "An error occurred" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Category Image</Heading>
      </div>
      <div className="px-6 py-4 flex flex-col gap-y-4">
        {currentImageUrl ? (
          <div className="flex flex-col gap-2">
            <img
              src={currentImageUrl}
              alt={category.name}
              className="w-32 h-32 object-cover rounded-md border"
            />
          </div>
        ) : (
          <Text className="text-ui-fg-muted">No image attached.</Text>
        )}

        <div>
          <label htmlFor="category-image-input">
            <Button
              isLoading={uploading}
              onClick={() => document.getElementById("category-image-input")?.click()}
              variant="secondary"
            >
              {currentImageUrl ? "Change Image" : "Upload Image"}
            </Button>
          </label>
          <input
            id="category-image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_category.details.side.before",
})

export default CategoryImageWidget
