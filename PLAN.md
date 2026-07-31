# Home Banner Upload Feature — Backend + Admin Dashboard

## Context
The mobile app needs a dynamic hero carousel on the home screen (replacing the static `bannerSample/home-banner.png` image). The Techzy project (`/Users/airm2/Documents/Techzy/commerce-app`) has a complete home-banner module with admin CRUD UI, custom data model, and store-facing API. We port this pattern to `apple-things-backend`.

## Files to Create

### Module: `src/modules/home-banner/`

1. **`src/modules/home-banner/models/home-banner.ts`** — Data model
   - Fields: `id`, `image_url`, `target_type` (enum: product|collection|category|url|none), `target_id`, `target_url`, `sort_order`, `is_active`, `starts_at`, `ends_at`
   - Soft-delete via Medusa's `model` helpers

2. **`src/modules/home-banner/service.ts`** — Module service
   - Extends `MedusaService({ HomeBanner })` — gives CRUD for free

3. **`src/modules/home-banner/types.ts`** — DTO + service type exports

4. **`src/modules/home-banner/utils.ts`** — `isVisibleHomeBanner()`, `sortHomeBanners()`

5. **`src/modules/home-banner/index.ts`** — Module registration (`HOME_BANNER_MODULE = "homeBanner"`)

6. **`src/modules/home-banner/migrations/Migration20260731093000.ts`** — Creates `home_banner` table

### API Routes

7. **`src/api/admin/home/hero-banners/route.ts`** — GET (list all) + POST (create)
   - Validates with Zod (`CreateHomeBannerSchema`)
   - Returns `{ banners, count }`

8. **`src/api/admin/home/hero-banners/[id]/route.ts`** — GET (single) + PATCH (update) + DELETE
   - Validates with Zod (`UpdateHomeBannerSchema`)

9. **`src/api/store/home/hero-banners/route.ts`** — GET (visible banners only)
   - Filters by `is_active`, `starts_at`, `ends_at` via `isVisibleHomeBanner()`
   - Accepts `?limit=N` (default 5, max 20)
   - Returns only safe fields: `id, image_url, target_type, target_id, target_url, sort_order`

### Admin UI

10. **`src/admin/routes/home-banners/page.tsx`** — Full CRUD page
    - DataTable with columns: Order, Image, Target, Status, Starts, Ends, Actions
    - FocusModal form: image upload, target type/id/url, sort order, active toggle, date range
    - Image upload via `/admin/uploads` (Cloudinary)
    - Target dropdown loads products/collections/categories from admin API
    - Uses `defineRouteConfig({ label: "Home Banners", icon: Photo })`

### Config

11. **`medusa-config.ts`** — Register `homeBanner` module:
    ```ts
    homeBanner: {
      resolve: "./src/modules/home-banner",
    },
    ```

## Files to Modify
- `medusa-config.ts` — add `homeBanner` to `modules`

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/home/hero-banners` | Admin | List all banners |
| POST | `/admin/home/hero-banners` | Admin | Create banner |
| GET | `/admin/home/hero-banners/:id` | Admin | Get single banner |
| PATCH | `/admin/home/hero-banners/:id` | Admin | Update banner |
| DELETE | `/admin/home/hero-banners/:id` | Admin | Delete banner |
| GET | `/store/home/hero-banners?limit=5` | Store | Visible banners for mobile |

## Verification
1. Backend builds: `pnpm run build` succeeds
2. Migration runs: `pnpm run migration:run` creates `home_banner` table
3. Admin UI: navigating to `/app/home-banners` shows the banners page
4. Admin CRUD: can create/edit/delete banners with image upload
5. Store API: `GET /store/home/hero-banners` returns only active, in-date-range banners
6. No TypeScript errors in new files
