import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo, PencilSquare, Trash } from "@medusajs/icons"
import {
  Button,
  Container,
  DataTable,
  DatePicker,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  createDataTableColumnHelper,
  toast,
  useDataTable,
  usePrompt,
  type DataTablePaginationState,
  type DataTableSortingState,
} from "@medusajs/ui"
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react"

type HomeBannerTargetType = "product" | "collection" | "category" | "url" | "none"
type TargetLookupType = Exclude<HomeBannerTargetType, "url" | "none">

type HomeBanner = {
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
  created_at?: string | Date
  updated_at?: string | Date
}

type HomeBannerForm = {
  title: string
  image_url: string
  target_type: HomeBannerTargetType
  target_id: string
  target_url: string
  sort_order: string
  is_active: boolean
  starts_at: string
  ends_at: string
}

type TargetOption = {
  id: string
  label: string
}

const PAGE_SIZE = 20
const columnHelper = createDataTableColumnHelper<HomeBanner>()

const EMPTY_FORM: HomeBannerForm = {
  title: "",
  image_url: "",
  target_type: "none",
  target_id: "",
  target_url: "",
  sort_order: "0",
  is_active: true,
  starts_at: "",
  ends_at: "",
}

function parseResponseError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error
  }
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message
  }
  return fallback
}

function formatDate(value?: string | Date | null): string {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return date.toLocaleString()
}

function parseFormDate(value: string): Date | null {
  if (!value.trim()) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function serializeFormDate(value: Date | null): string {
  return value ? value.toISOString() : ""
}

function toForm(banner: HomeBanner): HomeBannerForm {
  return {
    title: banner.title ?? "",
    image_url: banner.image_url,
    target_type: banner.target_type,
    target_id: banner.target_id ?? "",
    target_url: banner.target_url ?? "",
    sort_order: String(banner.sort_order ?? 0),
    is_active: banner.is_active,
    starts_at: banner.starts_at ?? "",
    ends_at: banner.ends_at ?? "",
  }
}

function buildPayload(form: HomeBannerForm) {
  return {
    title: form.title.trim(),
    image_url: form.image_url.trim(),
    target_type: form.target_type,
    target_id: form.target_id.trim() || null,
    target_url: form.target_url.trim() || null,
    sort_order: Number.parseInt(form.sort_order || "0", 10) || 0,
    is_active: form.is_active,
    starts_at: form.starts_at.trim() || null,
    ends_at: form.ends_at.trim() || null,
  }
}

function getTargetLabel(
  banner: HomeBanner,
  targetLookup: Record<TargetLookupType, Record<string, string>>
): string {
  if (banner.target_type === "none") {
    return "None"
  }

  if (banner.target_type === "url") {
    return banner.target_url ? `URL: ${banner.target_url}` : "URL"
  }

  const targetType = banner.target_type as TargetLookupType
  const targetLabel = banner.target_id ? targetLookup[targetType]?.[banner.target_id] : null
  if (targetLabel) {
    return `${banner.target_type}: ${targetLabel}`
  }

  return banner.target_id ? `${banner.target_type}: ${banner.target_id}` : banner.target_type
}

const HomeBannersPage = () => {
  const prompt = usePrompt()
  const [banners, setBanners] = useState<HomeBanner[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBanner, setSelectedBanner] = useState<HomeBanner | null>(null)
  const [form, setForm] = useState<HomeBannerForm>(EMPTY_FORM)
  const [targetOptions, setTargetOptions] = useState<Record<TargetLookupType, TargetOption[]>>({
    product: [],
    collection: [],
    category: [],
  })
  const [targetOptionsLoading, setTargetOptionsLoading] = useState(false)
  const [sorting, setSorting] = useState<DataTableSortingState | null>({
    id: "sort_order",
    desc: false,
  })
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  })

  const targetLookup = useMemo(
    () => ({
      product: Object.fromEntries(targetOptions.product.map((item) => [item.id, item.label])),
      collection: Object.fromEntries(targetOptions.collection.map((item) => [item.id, item.label])),
      category: Object.fromEntries(targetOptions.category.map((item) => [item.id, item.label])),
    }),
    [targetOptions]
  )

  const selectableTargetType = form.target_type !== "none" && form.target_type !== "url"
  const selectedTargetType = selectableTargetType ? (form.target_type as TargetLookupType) : null
  const requiresTargetId =
    form.target_type === "product" ||
    form.target_type === "collection" ||
    form.target_type === "category"
  const requiresTargetUrl = form.target_type === "url"
  const isSaveDisabled =
    saving ||
    form.image_url.trim().length === 0 ||
    (requiresTargetId && form.target_id.trim().length === 0) ||
    (requiresTargetUrl && form.target_url.trim().length === 0)
  const currentTargetOptions = useMemo(() => {
    if (!selectedTargetType) {
      return [] as TargetOption[]
    }

    const options = targetOptions[selectedTargetType]
    if (!form.target_id.trim()) {
      return options
    }

    const hasCurrentValue = options.some((item) => item.id === form.target_id)
    if (hasCurrentValue) {
      return options
    }

    return [{ id: form.target_id, label: `Current: ${form.target_id}` }, ...options]
  }, [form.target_id, selectedTargetType, targetOptions])

  const columns = useMemo(
    () => [
      columnHelper.accessor("sort_order", {
        header: "Order",
        enableSorting: true,
        sortLabel: "Order",
        cell: ({ getValue }) => String(getValue()),
      }),
      columnHelper.accessor("image_url", {
        header: "Image",
        cell: ({ getValue }) => {
          const url = getValue()
          return (
            <div className="h-10 w-16 overflow-hidden rounded-sm border border-ui-border-base bg-ui-bg-subtle">
              {url ? (
                <img src={url} alt="Home banner" className="h-full w-full object-cover" />
              ) : null}
            </div>
          )
        },
      }),
      columnHelper.accessor("target_type", {
        header: "Target",
        cell: ({ row }) => (
          <Text className="text-ui-fg-subtle">{getTargetLabel(row.original, targetLookup)}</Text>
        ),
      }),
      columnHelper.accessor("is_active", {
        header: "Status",
        enableSorting: true,
        sortLabel: "Status",
        cell: ({ getValue }) => (
          <StatusBadge color={getValue() ? "green" : "grey"}>
            {getValue() ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      }),
      columnHelper.accessor("starts_at", {
        header: "Starts",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      columnHelper.accessor("ends_at", {
        header: "Ends",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      columnHelper.action({
        actions: (ctx) => [
          {
            label: "Edit",
            icon: <PencilSquare />,
            onClick: () => openEditModal(ctx.row.original),
          },
          {
            label: "Delete",
            icon: <Trash />,
            onClick: () => void handleDelete(ctx.row.original),
          },
        ],
      }),
    ],
    [targetLookup]
  )

  const table = useDataTable({
    columns,
    data: banners,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: loading,
    sorting: {
      state: sorting,
      onSortingChange: setSorting,
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination,
    },
  })

  useEffect(() => {
    void fetchBanners()
  }, [sorting?.id, sorting?.desc, pagination.pageIndex, pagination.pageSize])

  useEffect(() => {
    void fetchTargetOptions()
  }, [])

  async function fetchTargetOptions() {
    setTargetOptionsLoading(true)

    const readItems = (data: unknown, keys: string[]): Array<Record<string, unknown>> => {
      if (!data || typeof data !== "object") {
        return []
      }

      for (const key of keys) {
        const value = (data as Record<string, unknown>)[key]
        if (Array.isArray(value)) {
          return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        }
      }

      return []
    }

    const toTargetOptions = (
      items: Array<Record<string, unknown>>,
      fallbackPrefix: string
    ): TargetOption[] => {
      return items
        .map((item) => {
          const id = typeof item.id === "string" ? item.id : ""
          if (!id) {
            return null
          }

          const title = typeof item.title === "string" ? item.title.trim() : ""
          const name = typeof item.name === "string" ? item.name.trim() : ""
          const handle = typeof item.handle === "string" ? item.handle.trim() : ""
          const label = title || name || handle || `${fallbackPrefix} ${id}`

          return { id, label }
        })
        .filter((item): item is TargetOption => Boolean(item))
        .sort((a, b) => a.label.localeCompare(b.label))
    }

    try {
      const [productsRes, collectionsRes, categoriesRes] = await Promise.all([
        fetch("/admin/products?fields=id,title,handle&limit=200", { credentials: "include" }),
        fetch("/admin/collections?fields=id,title,handle&limit=200", { credentials: "include" }),
        fetch("/admin/product-categories?fields=id,name,handle&limit=200", { credentials: "include" }),
      ])

      const [productsData, collectionsData, categoriesData] = await Promise.all([
        productsRes.json().catch(() => null),
        collectionsRes.json().catch(() => null),
        categoriesRes.json().catch(() => null),
      ])

      if (!productsRes.ok || !collectionsRes.ok || !categoriesRes.ok) {
        throw new Error("Failed to load target options")
      }

      setTargetOptions({
        product: toTargetOptions(readItems(productsData, ["products"]), "Product"),
        collection: toTargetOptions(readItems(collectionsData, ["collections"]), "Collection"),
        category: toTargetOptions(readItems(categoriesData, ["product_categories", "categories"]), "Category"),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load target options")
    } finally {
      setTargetOptionsLoading(false)
    }
  }

  async function fetchBanners() {
    setLoading(true)

    try {
      const response = await fetch("/admin/home/hero-banners", {
        credentials: "include",
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(parseResponseError(data, "Failed to load home banners"))
      }

      const allBanners = Array.isArray(data?.banners) ? (data.banners as HomeBanner[]) : []
      const sorted = [...allBanners].sort((a, b) => {
        if (sorting?.id === "is_active") {
          const result = Number(a.is_active) - Number(b.is_active)
          return sorting.desc ? -result : result
        }

        const result = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        return sorting?.desc ? -result : result
      })
      const start = pagination.pageIndex * pagination.pageSize

      setBanners(sorted.slice(start, start + pagination.pageSize))
      setCount(typeof data?.count === "number" ? data.count : allBanners.length)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load home banners")
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setSelectedBanner(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(banner: HomeBanner) {
    setSelectedBanner(banner)
    setForm(toForm(banner))
    setModalOpen(true)
  }

  function handleFieldChange<K extends keyof HomeBannerForm>(field: K, value: HomeBannerForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploadingImage(true)

    try {
      const formData = new FormData()
      formData.append("files", file)

      const uploadRes = await fetch("/admin/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      if (!uploadRes.ok) throw new Error("Failed to upload image")
      const uploadData = await uploadRes.json()
      const fileUrl = uploadData.files?.[0]?.url
      if (!fileUrl) throw new Error("Image URL missing from response")
      handleFieldChange("image_url", fileUrl)
      toast.success("Banner image uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload banner image")
    } finally {
      setUploadingImage(false)
      event.target.value = ""
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      const payload = buildPayload(form)
      const endpoint = selectedBanner
        ? `/admin/home/hero-banners/${selectedBanner.id}`
        : "/admin/home/hero-banners"
      const method = selectedBanner ? "PATCH" : "POST"
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(parseResponseError(data, "Failed to save home banner"))
      }

      setModalOpen(false)
      setSelectedBanner(null)
      setForm(EMPTY_FORM)
      await fetchBanners()
      toast.success(selectedBanner ? "Home banner updated" : "Home banner created")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save home banner")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(banner: HomeBanner) {
    const shouldDelete = await prompt({
      title: "Delete home banner",
      description: "Delete this home banner? This cannot be undone.",
      variant: "danger",
      confirmText: "Delete",
      cancelText: "Cancel",
    })

    if (!shouldDelete) {
      return
    }

    try {
      const response = await fetch(`/admin/home/hero-banners/${banner.id}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(parseResponseError(data, "Failed to delete home banner"))
      }

      const isLastItemOnPage = banners.length === 1 && pagination.pageIndex > 0
      if (isLastItemOnPage) {
        setPagination((current) => ({
          ...current,
          pageIndex: current.pageIndex - 1,
        }))
      } else {
        await fetchBanners()
      }

      toast.success("Home banner deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete home banner")
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Home Banners</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Manage the dynamic hero carousel shown at the top of the mobile home screen.
          </Text>
        </div>
        <Button type="button" size="small" variant="secondary" onClick={openCreateModal}>
          Create
        </Button>
      </div>

      <DataTable instance={table}>
        {count > 0 && (
          <div className="flex items-center justify-end border-b px-6 py-4">
            <DataTable.SortingMenu tooltip="Sort" />
          </div>
        )}
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No home banners",
              description: "Create a banner to replace the mobile fallback hero.",
            },
            filtered: {
              heading: "No results",
              description: "Try changing your filters.",
            },
          }}
        />
        {count > PAGE_SIZE && <DataTable.Pagination />}
      </DataTable>

      <FocusModal open={modalOpen} onOpenChange={setModalOpen}>
        <FocusModal.Content>
          <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <FocusModal.Header />
            <FocusModal.Body className="flex flex-1 justify-center overflow-y-auto px-6 py-10">
              <div className="flex w-full max-w-[760px] flex-col gap-y-8">
                <div>
                  <Heading level="h1">
                    {selectedBanner ? "Edit Home Banner" : "Create Home Banner"}
                  </Heading>
                  <Text className="mt-1 text-ui-fg-subtle">
                    Set the image, visibility, schedule, and tap target for the mobile hero.
                  </Text>
                </div>

                <div className="flex flex-col gap-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="home-banner-title">Title</Label>
                      <Input
                        id="home-banner-title"
                        value={form.title}
                        onChange={(event) => handleFieldChange("title", event.target.value)}
                        placeholder="Banner title"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="home-banner-order">Sort Order</Label>
                      <Input
                        id="home-banner-order"
                        type="number"
                        value={form.sort_order}
                        onChange={(event) => handleFieldChange("sort_order", event.target.value)}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="home-banner-image-url">Image URL</Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="home-banner-image-url"
                        value={form.image_url}
                        onChange={(event) => handleFieldChange("image_url", event.target.value)}
                        placeholder="https://..."
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploadingImage}
                        onClick={() => document.getElementById("home-banner-image-upload")?.click()}
                      >
                        {uploadingImage ? "Uploading..." : "Upload"}
                      </Button>
                      <input
                        id="home-banner-image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                    {form.image_url && (
                      <Text className="mt-1 break-all text-ui-fg-subtle" size="small">
                        {form.image_url}
                      </Text>
                    )}
                  </div>

                  {form.image_url && (
                    <div className="overflow-hidden rounded-lg border border-ui-border-base">
                      <img
                        key={form.image_url}
                        src={form.image_url}
                        alt="Banner preview"
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="home-banner-target-type">Target Type</Label>
                      <Select
                        value={form.target_type}
                        onValueChange={(value) => {
                          const nextType = value as HomeBannerTargetType
                          setForm((current) => ({
                            ...current,
                            target_type: nextType,
                            target_id: "",
                            target_url: nextType === "url" ? current.target_url : "",
                          }))
                        }}
                      >
                        <Select.Trigger id="home-banner-target-type" className="mt-2">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="none">None</Select.Item>
                          <Select.Item value="product">Product</Select.Item>
                          <Select.Item value="category">Category</Select.Item>
                          <Select.Item value="collection">Collection</Select.Item>
                          <Select.Item value="url">External URL</Select.Item>
                        </Select.Content>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="home-banner-target-id">Target</Label>
                      <Select
                        value={form.target_id || undefined}
                        onValueChange={(value) => handleFieldChange("target_id", value)}
                        disabled={!selectableTargetType || targetOptionsLoading}
                      >
                        <Select.Trigger id="home-banner-target-id" className="mt-2">
                          <Select.Value
                            placeholder={
                              !selectableTargetType
                                ? "Not required"
                                : targetOptionsLoading
                                  ? "Loading targets..."
                                  : "Select target"
                            }
                          />
                        </Select.Trigger>
                        <Select.Content>
                          {currentTargetOptions.length === 0 ? (
                            <Select.Item value="__no_targets__" disabled>
                              No targets available
                            </Select.Item>
                          ) : (
                            currentTargetOptions.map((item) => (
                              <Select.Item key={item.id} value={item.id}>
                                {item.label}
                              </Select.Item>
                            ))
                          )}
                        </Select.Content>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="home-banner-target-url">Target URL</Label>
                      <Input
                        id="home-banner-target-url"
                        value={form.target_url}
                        onChange={(event) => handleFieldChange("target_url", event.target.value)}
                        className="mt-2"
                        placeholder="https://..."
                        disabled={form.target_type !== "url"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="home-banner-starts-at">Starts At</Label>
                      <DatePicker
                        id="home-banner-starts-at"
                        aria-label="Starts At"
                        value={parseFormDate(form.starts_at)}
                        onChange={(date) => handleFieldChange("starts_at", serializeFormDate(date))}
                        granularity="minute"
                        hourCycle={24}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="home-banner-ends-at">Ends At</Label>
                      <DatePicker
                        id="home-banner-ends-at"
                        aria-label="Ends At"
                        value={parseFormDate(form.ends_at)}
                        onChange={(date) => handleFieldChange("ends_at", serializeFormDate(date))}
                        minValue={parseFormDate(form.starts_at) ?? undefined}
                        granularity="minute"
                        hourCycle={24}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-ui-border-base p-4">
                    <div>
                      <Text className="font-medium text-ui-fg-base">Active</Text>
                      <Text className="text-ui-fg-subtle" size="small">
                        Inactive banners stay saved but do not show in the mobile app.
                      </Text>
                    </div>
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => handleFieldChange("is_active", checked)}
                    />
                  </div>
                </div>
              </div>
            </FocusModal.Body>
            <FocusModal.Footer>
              <FocusModal.Close asChild>
                <Button type="button" variant="secondary" disabled={saving}>
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button
                type="submit"
                disabled={isSaveDisabled}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </FocusModal.Footer>
          </form>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Home Banners",
  icon: Photo,
})

export default HomeBannersPage
