import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })

const GUEST_ROLE_ID = "role_01KZNKRSBE97DC4NV7XP07SY16"

async function requireAdminWritePermission(req: any, res: any, next: any) {
  const authContext = req.auth_context
  if (!authContext?.actor_id) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Authentication required")
  }

  const query = req.scope.resolve("query" as any)
  const userId = authContext.actor_id

  const { data: users } = await query.graph({
    entity: "user",
    fields: ["rbac_roles.id", "rbac_roles.policies.operation"],
    filters: { id: userId },
  })

  const user = users?.[0]
  if (!user?.rbac_roles?.length) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "You can't do this action as a guest user"
    )
  }

  const hasWriteAccess = user.rbac_roles.some((role: any) =>
    role.policies?.some(
      (p: any) => p.operation === "write" || p.operation === "*"
    )
  )

  if (!hasWriteAccess) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "You can't do this action as a guest user"
    )
  }

  next()
}

async function guestWriteBlocker(req: any, res: any, next: any) {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const authContext = req.auth_context
    if (authContext?.actor_id) {
      const query = req.scope.resolve("query" as any)
      const { data: users } = await query.graph({
        entity: "user",
        fields: ["rbac_roles.id"],
        filters: { id: authContext.actor_id },
      })

      const user = users?.[0]
      if (user?.rbac_roles?.some((r: any) => r.id === GUEST_ROLE_ID)) {
        throw new MedusaError(
          MedusaError.Types.UNAUTHORIZED,
          "You can't do this action as a guest user"
        )
      }
    }
  }
  next()
}

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/uploads",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        upload.array("files"),
      ],
    },
    {
      matcher: "/admin/*",
      middlewares: [guestWriteBlocker],
    },
    {
      matcher: "/admin/home/hero-banners*",
      middlewares: [
        authenticate("user", ["session", "bearer"]),
      ],
    },
    {
      method: ["POST", "PATCH", "DELETE"],
      matcher: "/admin/home/hero-banners*",
      middlewares: [
        requireAdminWritePermission,
      ],
    },
  ],
})
