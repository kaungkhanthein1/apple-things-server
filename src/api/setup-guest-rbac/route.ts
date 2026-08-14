import type { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const ROLE_NAME = "read_only"
const GUEST_EMAIL = "guest@applethings.com"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const rbacService = req.scope.resolve("rbac" as any)
    const userModule = req.scope.resolve(Modules.USER)
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.LINK)

    // 1. Create or find read_only role
    let role: any
    const existing = await (rbacService as any).listRbacRoles({ name: ROLE_NAME })
    if (existing && existing.length > 0) {
      role = existing[0]
    } else {
      role = await (rbacService as any).createRbacRoles({
        name: ROLE_NAME,
        description: "Read-only access to admin dashboard",
      })
    }

    // 2. Get all policies and filter read-only ones
    const allPolicies = await (rbacService as any).listRbacPolicies({})
    const readOnlyPolicies = allPolicies.filter((p: any) => p.operation === "read")

    // 3. Get existing role policies
    const existingPolicies = await (rbacService as any).listRbacRolePolicies({
      role_id: role.id,
    })
    const existingPolicyIds = new Set(existingPolicies.map((rp: any) => rp.policy_id))

    // 4. Attach missing read policies
    const toAttach = readOnlyPolicies
      .filter((p: any) => !existingPolicyIds.has(p.id))
      .map((p: any) => ({ role_id: role.id, policy_id: p.id }))

    if (toAttach.length > 0) {
      await (rbacService as any).createRbacRolePolicies(toAttach)
    }

    // 5. Find guest user
    const users = await userModule.listUsers({ email: GUEST_EMAIL })
    if (!users || users.length === 0) {
      res.status(404).json({ error: "Guest user not found" })
      return
    }
    const userId = users[0].id

    // 6. Create link between user and role
    await remoteLink.create([
      {
        [Modules.USER]: {
          user_id: userId,
        },
        [Modules.RBAC]: {
          rbac_role_id: role.id,
        },
      },
    ])

    res.json({
      success: true,
      role_id: role.id,
      user_id: userId,
      policies_attached: toAttach.length,
      total_read_policies: readOnlyPolicies.length,
      message: "Guest user linked to read-only role",
    })
  } catch (err: any) {
    console.error("[SetupRBAC] Error:", err)
    res.status(500).json({ error: err.message })
  }
}
