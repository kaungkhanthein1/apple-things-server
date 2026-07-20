/**
 * Inventory Price Widget
 * Zone: inventory_item.details.side.before
 *
 * How data is fetched
 * ───────────────────
 * The Medusa v2 dashboard loader uses:
 *   GET /admin/inventory-items/:id?fields=*variants,*variants.product,*variants.options
 *
 * We extend that exact pattern by adding *variants.prices to get pricing data.
 * This is the ONLY reliable way to get linked product variants from an inventory
 * item — querying /admin/products with a cross-module filter causes a 500.
 *
 * How prices are shown / edited
 * ──────────────────────────────
 * AdminPrice.amount  →  DISPLAY-UNIT decimal (e.g. 9.99 for $9.99). No /100.
 * AdminPrice.raw_amount  →  { value: string, precision: number }  (internal)
 *
 * To update a price we POST the full prices array (with existing price IDs) to:
 *   POST /admin/products/:productId/variants/:variantId
 * Including the `id` on each price record updates it in-place; omitting would create duplicates.
 */

import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminInventoryItem } from "@medusajs/types"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Skeleton,
  StatusBadge,
  Text,
  Tooltip,
  clx,
} from "@medusajs/ui"
import {
  ArchiveBox,
  Check,
  CurrencyDollar,
  InformationCircle,
  Pencil,
  Tag,
  XMark,
} from "@medusajs/icons"
import type { IconProps } from "@medusajs/icons/dist/types"
import {
  type ForwardRefExoticComponent,
  type RefAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

// ─── Icon type ────────────────────────────────────────────────────────────────

type MedusaIcon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>

// ─── Domain types ─────────────────────────────────────────────────────────────

type ProductStatus = "draft" | "proposed" | "published" | "rejected"

/**
 * Mirrors AdminPrice from @medusajs/types.
 * amount = display-unit decimal (9.99), NOT cents. Do NOT divide by 100.
 */
type PriceRecord = {
  id: string
  currency_code: string
  amount: number
  min_quantity: number | null
  max_quantity: number | null
}

type LinkedVariant = {
  id: string
  sku: string | null
  title: string | null
  product_id: string | null
  prices: PriceRecord[]
  product: {
    id: string
    title: string
    status: ProductStatus
    handle: string
    thumbnail: string | null
  } | null
}

/** Shape of GET /admin/inventory-items/:id response when *variants is expanded */
type InventoryItemDetailResponse = {
  inventory_item: {
    id: string
    sku?: string | null
    variants?: LinkedVariant[]
  }
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; variants: LinkedVariant[] }

type SaveState =
  | { status: "idle" }
  | { status: "saving"; priceId: string }
  | { status: "error"; priceId: string; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Display a Medusa v2 price amount (already in display units, e.g. 9.99). */
function formatAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return "—"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`
  }
}

type StockTotals = { stocked: number; reserved: number; available: number }

function sumStockLevels(levels: AdminInventoryItem["location_levels"]): StockTotals {
  return (levels ?? []).reduce<StockTotals>(
    (acc, lvl) => ({
      stocked:   acc.stocked   + lvl.stocked_quantity,
      reserved:  acc.reserved  + lvl.reserved_quantity,
      available: acc.available + (lvl.available_quantity ?? 0),
    }),
    { stocked: 0, reserved: 0, available: 0 }
  )
}

function statusColor(s: ProductStatus): "green" | "orange" | "red" | "grey" {
  return ({ published: "green", proposed: "orange", rejected: "red", draft: "grey" } as const)[s] ?? "grey"
}

function adminFetch(path: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type StatVariant = "positive" | "neutral" | "warning" | "danger"

const STAT_COLORS: Record<StatVariant, string> = {
  positive: "bg-ui-tag-green-bg   text-ui-tag-green-text   border-ui-tag-green-border",
  neutral:  "bg-ui-tag-blue-bg    text-ui-tag-blue-text    border-ui-tag-blue-border",
  warning:  "bg-ui-tag-orange-bg  text-ui-tag-orange-text  border-ui-tag-orange-border",
  danger:   "bg-ui-tag-red-bg     text-ui-tag-red-text     border-ui-tag-red-border",
}

function StatCard({ label, value, variant = "neutral" }: {
  label: string; value: number; variant?: StatVariant
}) {
  return (
    <div className={clx("rounded-lg border px-3 py-2.5 text-center", STAT_COLORS[variant])}>
      <p className="txt-compact-xlarge-plus font-bold tabular-nums">{value.toLocaleString()}</p>
      <p className="txt-compact-xsmall mt-0.5 font-medium opacity-80">{label}</p>
    </div>
  )
}

function AttrRow({ label, value, tooltip }: {
  label: string; value: string; tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1">
        <Text size="small" className="text-ui-fg-muted">{label}</Text>
        {tooltip && (
          <Tooltip content={tooltip}>
            <InformationCircle className="text-ui-fg-muted h-3.5 w-3.5 cursor-help" />
          </Tooltip>
        )}
      </div>
      <Text size="small" weight="plus">{value}</Text>
    </div>
  )
}

function SectionLabel({ Icon, title }: { Icon: MedusaIcon; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <Icon className="text-ui-fg-muted h-4 w-4 flex-shrink-0" />
      <Text size="xsmall" weight="plus"
        className="text-ui-fg-subtle font-semibold uppercase tracking-wider">
        {title}
      </Text>
    </div>
  )
}

// ─── Editable Price Row ───────────────────────────────────────────────────────

function PriceRow({
  price,
  isSaving,
  saveError,
  onSave,
}: {
  price: PriceRecord
  isSaving: boolean
  saveError: string | null
  onSave: (priceId: string, newAmount: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setInputVal(price.amount.toFixed(2))
    setEditing(true)
    // Focus the input on next tick after it mounts
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => {
    setEditing(false)
  }

  const save = async () => {
    const parsed = parseFloat(inputVal)
    if (!Number.isFinite(parsed) || parsed < 0) return
    await onSave(price.id, parsed)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter")  save()
    if (e.key === "Escape") cancel()
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <div className="bg-ui-bg-field flex items-center gap-1.5 rounded-md px-2.5 py-1">
          <span className="txt-compact-xsmall text-ui-fg-muted w-8 flex-shrink-0 font-semibold uppercase tracking-widest">
            {price.currency_code}
          </span>
          <Input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 flex-1 border-none bg-transparent p-0 text-right text-sm shadow-none focus:ring-0"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={save}
              disabled={isSaving}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover disabled:opacity-50"
              title="Save"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancel}
              disabled={isSaving}
              className="text-ui-fg-muted hover:text-ui-fg-base"
              title="Cancel"
            >
              <XMark className="h-4 w-4" />
            </button>
          </div>
        </div>
        {saveError && (
          <Text size="xsmall" className="text-ui-tag-red-text px-1">{saveError}</Text>
        )}
      </div>
    )
  }

  return (
    <div className="group bg-ui-bg-field flex items-center justify-between rounded-md px-2.5 py-1.5">
      <span className="txt-compact-xsmall text-ui-fg-muted w-8 font-semibold uppercase tracking-widest">
        {price.currency_code}
      </span>

      <div className="flex items-center gap-2">
        <span className="txt-compact-small font-semibold tabular-nums">
          {formatAmount(price.amount, price.currency_code)}
        </span>
        <button
          onClick={startEdit}
          className="text-ui-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-ui-fg-base"
          title={`Edit ${price.currency_code.toUpperCase()} price`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Variant Card ─────────────────────────────────────────────────────────────

function VariantCard({
  variant,
  onPriceSaved,
}: {
  variant: LinkedVariant
  onPriceSaved: (variantId: string, updatedPrices: PriceRecord[]) => void
}) {
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" })

  const handleSave = useCallback(
    async (priceId: string, newAmount: number) => {
      if (!variant.product_id && !variant.product?.id) return

      const productId = variant.product?.id ?? variant.product_id!
      setSaveState({ status: "saving", priceId })

      // Build the full prices array, replacing only the edited price.
      // Including the `id` field on each price updates it in-place in Medusa v2.
      const updatedPrices = variant.prices.map((p) =>
        p.id === priceId
          ? { id: p.id, currency_code: p.currency_code, amount: newAmount,
              min_quantity: p.min_quantity, max_quantity: p.max_quantity }
          : { id: p.id, currency_code: p.currency_code, amount: p.amount,
              min_quantity: p.min_quantity, max_quantity: p.max_quantity }
      )

      try {
        const res = await adminFetch(
          `/admin/products/${productId}/variants/${variant.id}`,
          { method: "POST", body: JSON.stringify({ prices: updatedPrices }) }
        )
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error((errJson as { message?: string }).message ?? `${res.status} ${res.statusText}`)
        }

        // Optimistically update local state with the new amount
        const newPriceRecords: PriceRecord[] = variant.prices.map((p) =>
          p.id === priceId ? { ...p, amount: newAmount } : p
        )
        onPriceSaved(variant.id, newPriceRecords)
        setSaveState({ status: "idle" })
      } catch (err) {
        setSaveState({
          status: "error",
          priceId,
          message: err instanceof Error ? err.message : "Save failed",
        })
      }
    },
    [variant, onPriceSaved]
  )

  return (
    <div className="bg-ui-bg-subtle overflow-hidden rounded-xl">
      {/* Product identity */}
      {variant.product && (
        <div className="flex items-center gap-2.5 p-3">
          {variant.product.thumbnail ? (
            <img
              src={variant.product.thumbnail}
              alt={variant.product.title}
              className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="bg-ui-bg-component flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md">
              <Tag className="text-ui-fg-muted h-4 w-4" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <Text size="small" weight="plus" className="truncate leading-tight">
              {variant.product.title}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted truncate">
              {variant.title ?? variant.sku ?? "—"}
            </Text>
          </div>

          <StatusBadge
            color={statusColor(variant.product.status)}
            className="flex-shrink-0 capitalize"
          >
            {variant.product.status}
          </StatusBadge>
        </div>
      )}

      {/* Prices */}
      <div className="space-y-1 px-3 pb-3">
        {variant.prices.length > 0 ? (
          variant.prices.map((price) => (
            <PriceRow
              key={price.id}
              price={price}
              isSaving={
                saveState.status === "saving" && saveState.priceId === price.id
              }
              saveError={
                saveState.status === "error" && saveState.priceId === price.id
                  ? saveState.message
                  : null
              }
              onSave={handleSave}
            />
          ))
        ) : (
          <Text size="xsmall" className="text-ui-fg-muted py-2 text-center">
            No prices configured
          </Text>
        )}
      </div>
    </div>
  )
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

const InventoryPriceWidget = ({ data }: DetailWidgetProps<AdminInventoryItem>) => {
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" })

  const stock         = sumStockLevels(data.location_levels)
  const locationCount = data.location_levels?.length ?? 0
  const hasPhysical   = !!(data.weight || data.length || data.height || data.width || data.material)
  const hasOrigin     = !!(data.hs_code || data.mid_code || data.origin_country)

  // ── Fetch linked variants with prices from the inventory item itself ───────
  useEffect(() => {
    setFetchState({ status: "loading" })

    /**
     * The correct Medusa v2 approach (same pattern as the dashboard's loader):
     *   GET /admin/inventory-items/:id?fields=*variants,*variants.product,*variants.prices
     *
     * *variants  →  expand the ProductVariant ↔ InventoryItem link from the inventory side
     * *variants.product  →  include parent product (title, status, thumbnail, handle)
     * *variants.prices   →  include pricing from the Pricing module
     *
     * This avoids cross-module filter queries on /admin/products that cause 500 errors.
     */
    const params = new URLSearchParams({
      fields: "*variants,*variants.product,*variants.prices",
    })

    adminFetch(`/admin/inventory-items/${data.id}?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const json: InventoryItemDetailResponse = await res.json()
        setFetchState({
          status: "success",
          variants: json.inventory_item?.variants ?? [],
        })
      })
      .catch((err: Error) =>
        setFetchState({ status: "error", message: err.message })
      )
  }, [data.id])

  // ── Optimistic price update from child variant card ───────────────────────
  const handlePriceSaved = useCallback(
    (variantId: string, updatedPrices: PriceRecord[]) => {
      setFetchState((prev) => {
        if (prev.status !== "success") return prev
        return {
          ...prev,
          variants: prev.variants.map((v) =>
            v.id === variantId ? { ...v, prices: updatedPrices } : v
          ),
        }
      })
    },
    []
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Container className="divide-y p-0">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2" className="txt-compact-medium font-semibold">
          Product &amp; Pricing
        </Heading>
        {data.sku
          ? <Badge size="2xsmall" color="grey"   rounded="full">{data.sku}</Badge>
          : <Badge size="2xsmall" color="orange" rounded="full">No SKU</Badge>
        }
      </div>

      {/* ── Stock Overview ───────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <SectionLabel Icon={ArchiveBox} title="Stock Overview" />
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Stocked"   value={stock.stocked}   variant="neutral" />
          <StatCard label="Reserved"  value={stock.reserved}  variant="warning" />
          <StatCard
            label="Available"
            value={stock.available}
            variant={stock.available > 0 ? "positive" : "danger"}
          />
        </div>
        {locationCount > 0 && (
          <Text size="xsmall" className="text-ui-fg-muted mt-2 text-right">
            Across {locationCount} {locationCount === 1 ? "location" : "locations"}
          </Text>
        )}
      </div>

      {/* ── Linked Variant Prices ────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <SectionLabel Icon={CurrencyDollar} title="Linked Prices" />

        {fetchState.status === "loading" && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-7  w-full rounded-md" />
            <Skeleton className="h-7  w-3/4 rounded-md" />
          </div>
        )}

        {fetchState.status === "error" && (
          <div className="bg-ui-tag-red-bg rounded-lg p-3">
            <Text size="small" className="text-ui-tag-red-text">
              Could not load prices — {fetchState.message}
            </Text>
          </div>
        )}

        {fetchState.status === "success" && fetchState.variants.length === 0 && (
          <div className="bg-ui-bg-subtle rounded-lg px-4 py-5 text-center">
            <CurrencyDollar className="text-ui-fg-muted mx-auto mb-2 h-5 w-5" />
            <Text size="small" className="text-ui-fg-muted">
              No linked product variants found
            </Text>
          </div>
        )}

        {fetchState.status === "success" && fetchState.variants.length > 0 && (
          <div className="space-y-3">
            {fetchState.variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                onPriceSaved={handlePriceSaved}
              />
            ))}
            <Text size="xsmall" className="text-ui-fg-muted px-1">
              Hover a price and click <Pencil className="inline h-3 w-3" /> to edit.
              Press Enter to save or Esc to cancel.
            </Text>
          </div>
        )}
      </div>

      {/* ── Physical Specs ───────────────────────────────────────────────── */}
      {hasPhysical && (
        <div className="px-6 py-4">
          <SectionLabel Icon={Tag} title="Physical Specs" />
          <div className="divide-y divide-dashed">
            {data.weight   && <AttrRow label="Weight"   value={`${data.weight} g`}  tooltip="Gross weight in grams" />}
            {data.length   && <AttrRow label="Length"   value={`${data.length} mm`} />}
            {data.height   && <AttrRow label="Height"   value={`${data.height} mm`} />}
            {data.width    && <AttrRow label="Width"    value={`${data.width} mm`}  />}
            {data.material && <AttrRow label="Material" value={data.material}        />}
          </div>
        </div>
      )}

      {/* ── Customs & Origin ─────────────────────────────────────────────── */}
      {hasOrigin && (
        <div className="px-6 py-4">
          <SectionLabel Icon={InformationCircle} title="Customs & Origin" />
          <div className="divide-y divide-dashed">
            {data.origin_country && (
              <AttrRow
                label="Country of Origin"
                value={data.origin_country.toUpperCase()}
                tooltip="Country where the item was manufactured"
              />
            )}
            {data.hs_code && (
              <AttrRow label="HS Code" value={data.hs_code}
                tooltip="Harmonized System tariff classification code" />
            )}
            {data.mid_code && (
              <AttrRow label="MID Code" value={data.mid_code}
                tooltip="Manufacturer Identification code used for customs" />
            )}
          </div>
        </div>
      )}

    </Container>
  )
}

// ─── Widget config ────────────────────────────────────────────────────────────

export const config = defineWidgetConfig({
  zone: "inventory_item.details.side.before",
})

export default InventoryPriceWidget
