/**
 * Inventory (with Price) — custom admin route
 * ─────────────────────────────────────────────
 * The stock @medusajs/dashboard Inventory list (Title / SKU / Reserved / In stock)
 * lives in the compiled package and can't be edited in-place, and it has no
 * Price column. This route rebuilds that list and adds an editable Price
 * column so the admin can see + change a variant's price without opening
 * the detail page.
 *
 * Data strategy
 * ─────────────
 * 1) GET /admin/inventory-items?limit&offset&q  → paginated base rows
 *    (title, sku, location_levels for stock math). This mirrors the
 *    built-in list's query.
 * 2) For each row on the current page, GET /admin/inventory-items/:id
 *    ?fields=*variants,*variants.product,*variants.prices
 *    (same pattern as inventory-price-widget.tsx) to pull the linked
 *    variant + its prices. Cross-module filtering on /admin/products
 *    directly causes a 500, so we always go through the inventory item.
 *
 * Price display: shows one "primary" price per row (USD preferred, else
 * the first currency present). Editing a price re-uses the same
 * POST /admin/products/:productId/variants/:variantId pattern as the
 * existing widget — sending the full prices array with the edited price's
 * id keeps it an in-place update instead of creating a duplicate.
 */

import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Input,
  Badge,
  IconButton,
  Skeleton,
  Tooltip,
} from "@medusajs/ui"
import { CurrencyDollar, Check, XMark, Pencil } from "@medusajs/icons"
import { useCallback, useEffect, useRef, useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────

type LocationLevel = {
  stocked_quantity: number
  reserved_quantity: number
  available_quantity?: number
}

type BaseInventoryItem = {
  id: string
  sku: string | null
  title: string | null
  location_levels?: LocationLevel[]
}

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
  product: { id: string; title: string } | null
}

type Row = {
  item: BaseInventoryItem
  variant: LinkedVariant | null
  variantsLoading: boolean
  variantsError: string | null
}

const PAGE_SIZE = 20
const PREFERRED_CURRENCY = "usd"

// ─── Helpers ──────────────────────────────────────────────────────────────

function adminFetch(path: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
}

function sumStock(levels?: LocationLevel[]) {
  return (levels ?? []).reduce(
    (acc, lvl) => ({
      stocked: acc.stocked + lvl.stocked_quantity,
      reserved: acc.reserved + lvl.reserved_quantity,
    }),
    { stocked: 0, reserved: 0 }
  )
}

function formatAmount(amount: number, currency: string) {
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

/** Pick one price to show as the row's primary price. */
function pickPrimaryPrice(prices: PriceRecord[]): PriceRecord | null {
  if (!prices.length) return null
  return (
    prices.find((p) => p.currency_code.toLowerCase() === PREFERRED_CURRENCY) ??
    prices[0]
  )
}

// ─── Editable price cell ──────────────────────────────────────────────────

function PriceCell({
  variant,
  onSaved,
}: {
  variant: LinkedVariant | null
  onSaved: (variantId: string, updatedPrices: PriceRecord[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!variant) {
    return <Text className="text-ui-fg-muted">—</Text>
  }

  const primary = pickPrimaryPrice(variant.prices)

  if (!primary) {
    return <Text className="text-ui-fg-muted">No price</Text>
  }

  const startEdit = () => {
    setInputVal(primary.amount.toFixed(2))
    setError(null)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => setEditing(false)

  const save = async () => {
    const parsed = parseFloat(inputVal)
    if (!Number.isFinite(parsed) || parsed < 0) return
    const productId = variant.product?.id ?? variant.product_id
    if (!productId) {
      setError("Missing product")
      return
    }

    setSaving(true)
    setError(null)

    const updatedPrices = variant.prices.map((p) =>
      p.id === primary.id
        ? {
            id: p.id,
            currency_code: p.currency_code,
            amount: parsed,
            min_quantity: p.min_quantity,
            max_quantity: p.max_quantity,
          }
        : {
            id: p.id,
            currency_code: p.currency_code,
            amount: p.amount,
            min_quantity: p.min_quantity,
            max_quantity: p.max_quantity,
          }
    )

    try {
      const res = await adminFetch(
        `/admin/products/${productId}/variants/${variant.id}`,
        { method: "POST", body: JSON.stringify({ prices: updatedPrices }) }
      )
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(
          (errJson as { message?: string }).message ?? `${res.status} ${res.statusText}`
        )
      }
      const newPriceRecords = variant.prices.map((p) =>
        p.id === primary.id ? { ...p, amount: parsed } : p
      )
      onSaved(variant.id, newPriceRecords)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save()
    if (e.key === "Escape") cancel()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="txt-compact-xsmall text-ui-fg-muted w-8 flex-shrink-0 font-semibold uppercase tracking-widest">
          {primary.currency_code}
        </span>
        <Input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-24"
        />
        <IconButton size="small" onClick={save} disabled={saving} type="button">
          <Check className="text-ui-fg-interactive h-4 w-4" />
        </IconButton>
        <IconButton size="small" onClick={cancel} disabled={saving} type="button">
          <XMark className="text-ui-fg-muted h-4 w-4" />
        </IconButton>
        {error && <Text className="text-ui-tag-red-text txt-compact-xsmall">{error}</Text>}
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2">
      <span className="txt-compact-small font-semibold tabular-nums">
        {formatAmount(primary.amount, primary.currency_code)}
      </span>
      {variant.prices.length > 1 && (
        <Tooltip content={variant.prices.map((p) => `${p.currency_code.toUpperCase()} ${p.amount}`).join(", ")}>
          <Badge size="2xsmall" color="grey" rounded="full">
            +{variant.prices.length - 1}
          </Badge>
        </Tooltip>
      )}
      <button
        onClick={startEdit}
        className="text-ui-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-ui-fg-base"
        title="Edit price"
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

const InventoryPricingPage = () => {
  const [rows, setRows] = useState<Row[]>([])
  const [count, setCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [loadingBase, setLoadingBase] = useState(true)
  const [baseError, setBaseError] = useState<string | null>(null)

  // Load base rows (title/sku/stock) for current page + search
  useEffect(() => {
    let cancelled = false
    setLoadingBase(true)
    setBaseError(null)

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      fields: "id,sku,title,location_levels.stocked_quantity,location_levels.reserved_quantity",
    })
    if (search.trim()) params.set("q", search.trim())

    adminFetch(`/admin/inventory-items?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const json = await res.json()
        if (cancelled) return
        const items: BaseInventoryItem[] = json.inventory_items ?? []
        setCount(json.count ?? items.length)
        setRows(
          items.map((item) => ({
            item,
            variant: null,
            variantsLoading: true,
            variantsError: null,
          }))
        )
      })
      .catch((err: Error) => {
        if (!cancelled) setBaseError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingBase(false)
      })

    return () => {
      cancelled = true
    }
  }, [offset, search])

  // For each base row, fetch its linked variant + prices
  useEffect(() => {
    if (rows.length === 0) return
    let cancelled = false

    rows.forEach((row, idx) => {
      if (row.variant !== null || !row.variantsLoading) return

      const params = new URLSearchParams({
        fields: "*variants,*variants.product,*variants.prices",
      })

      adminFetch(`/admin/inventory-items/${row.item.id}?${params}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
          const json = await res.json()
          if (cancelled) return
          const variants: LinkedVariant[] = json.inventory_item?.variants ?? []
          setRows((prev) => {
            const next = [...prev]
            if (next[idx]?.item.id !== row.item.id) return prev
            next[idx] = {
              ...next[idx],
              variant: variants[0] ?? null,
              variantsLoading: false,
            }
            return next
          })
        })
        .catch((err: Error) => {
          if (cancelled) return
          setRows((prev) => {
            const next = [...prev]
            if (next[idx]?.item.id !== row.item.id) return prev
            next[idx] = { ...next[idx], variantsLoading: false, variantsError: err.message }
            return next
          })
        })
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.item.id).join(",")])

  const handlePriceSaved = useCallback((variantId: string, updatedPrices: PriceRecord[]) => {
    setRows((prev) =>
      prev.map((row) =>
        row.variant?.id === variantId
          ? { ...row, variant: { ...row.variant, prices: updatedPrices } }
          : row
      )
    )
  }, [])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Inventory (with Price)</Heading>
          <Text size="small" className="text-ui-fg-muted">
            Same list as Inventory, with an editable Price column.
          </Text>
        </div>
        <div className="w-64">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => {
              setOffset(0)
              setSearch(e.target.value)
            }}
          />
        </div>
      </div>

      {baseError && (
        <div className="px-6 py-4">
          <Text className="text-ui-tag-red-text">Could not load inventory — {baseError}</Text>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-ui-border-base border-b">
              <th className="text-ui-fg-subtle txt-compact-small-plus px-6 py-3 text-left">Title</th>
              <th className="text-ui-fg-subtle txt-compact-small-plus px-6 py-3 text-left">SKU</th>
              <th className="text-ui-fg-subtle txt-compact-small-plus px-6 py-3 text-left">Reserved</th>
              <th className="text-ui-fg-subtle txt-compact-small-plus px-6 py-3 text-left">In stock</th>
              <th className="text-ui-fg-subtle txt-compact-small-plus px-6 py-3 text-left">
                <div className="flex items-center gap-1.5">
                  <CurrencyDollar className="h-3.5 w-3.5" />
                  Price
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loadingBase &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-ui-border-base border-b">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loadingBase &&
              rows.map((row) => {
                const stock = sumStock(row.item.location_levels)
                const title =
                  row.variant?.title ?? row.item.title ?? "Default variant"
                return (
                  <tr key={row.item.id} className="border-ui-border-base hover:bg-ui-bg-subtle border-b">
                    <td className="px-6 py-3">
                      <Text size="small" weight="plus">
                        {title}
                      </Text>
                      {row.variant?.product?.title && (
                        <Text size="xsmall" className="text-ui-fg-muted">
                          {row.variant.product.title}
                        </Text>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <Text size="small">{row.item.sku ?? "—"}</Text>
                    </td>
                    <td className="px-6 py-3">
                      <Text size="small">{stock.reserved.toLocaleString()}</Text>
                    </td>
                    <td className="px-6 py-3">
                      <Text size="small">{stock.stocked.toLocaleString()}</Text>
                    </td>
                    <td className="px-6 py-3">
                      {row.variantsLoading ? (
                        <Skeleton className="h-4 w-16" />
                      ) : row.variantsError ? (
                        <Text size="xsmall" className="text-ui-tag-red-text">
                          {row.variantsError}
                        </Text>
                      ) : (
                        <PriceCell variant={row.variant} onSaved={handlePriceSaved} />
                      )}
                    </td>
                  </tr>
                )
              })}

            {!loadingBase && rows.length === 0 && !baseError && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <Text className="text-ui-fg-muted">No inventory items found</Text>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <Text size="small" className="text-ui-fg-muted">
          {count.toLocaleString()} item{count === 1 ? "" : "s"}
        </Text>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="text-ui-fg-base disabled:text-ui-fg-disabled disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <Text size="small" className="text-ui-fg-muted">
            {currentPage} / {totalPages}
          </Text>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= count}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="text-ui-fg-base disabled:text-ui-fg-disabled disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Inventory (with Price)",
  icon: CurrencyDollar,
})

export default InventoryPricingPage
