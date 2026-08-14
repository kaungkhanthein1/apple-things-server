import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const authService = req.scope.resolve(Modules.AUTH)

    const { success, error, authIdentity } = await authService.authenticate(
      "emailpass",
      {
        body: {
          email: "guest@applethings.com",
          password: "GuestPassword123!",
        },
      }
    )

    if (!success || !authIdentity) {
      console.error("[GuestLogin] Auth failed:", error)
      return res.redirect("/app/login")
    }

    const entityIdKey = "user_id"
    const entityId = authIdentity?.app_metadata?.[entityIdKey]

    const providerIdentity = authIdentity.provider_identities?.find(
      (identity: any) => identity.provider === "emailpass"
    )

    const authContext = {
      actor_id: entityId ?? "",
      actor_type: "user",
      auth_identity_id: authIdentity.id ?? "",
      app_metadata: {
        [entityIdKey]: entityId,
        roles: (authIdentity.app_metadata as any)?.roles ?? [],
      },
      user_metadata: providerIdentity?.user_metadata ?? {},
    }

    req.session.auth_context = authContext

    return new Promise<void>((resolve) => {
      req.session.save((err) => {
        if (err) {
          console.error("[GuestLogin] Session save error:", err)
        }
        res.redirect("/app/orders")
        resolve()
      })
    })
  } catch (err) {
    console.error("[GuestLogin] Server-side auth failed:", err)
    return res.redirect("/app/login")
  }
}
