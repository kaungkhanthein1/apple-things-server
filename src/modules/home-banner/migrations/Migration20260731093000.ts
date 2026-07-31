import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260731093000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "home_banner" ("id" text not null, "tag" text null, "title" text not null, "subtitle" text null, "image_url" text not null, "target_type" text check ("target_type" in ('product', 'collection', 'category', 'url', 'none')) not null default 'none', "target_id" text null, "target_url" text null, "sort_order" integer not null default 0, "is_active" boolean not null default true, "starts_at" text null, "ends_at" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "home_banner_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_home_banner_deleted_at" ON "home_banner" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_home_banner_active_sort" ON "home_banner" ("is_active", "sort_order") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "home_banner" cascade;`)
  }
}
