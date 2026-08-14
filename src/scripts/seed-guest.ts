import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const GUEST_EMAIL = process.env.GUEST_EMAIL || "guest@applethings.com"
const GUEST_PASSWORD = process.env.GUEST_PASSWORD || "GuestPassword123!"

export default async function seedGuestUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  logger.info(`Seeding guest user: ${GUEST_EMAIL}`)

  try {
    const userModule = container.resolve(Modules.USER as any)
    const authModule = container.resolve(Modules.AUTH as any)

    let readOnlyRoleId: string | undefined

    try {
      const rbacService = container.resolve("rbac" as any)

      const existingRoles = await rbacService.listRbacRoles({
        name: "read_only",
      })

      if (existingRoles && existingRoles.length > 0) {
        readOnlyRoleId = existingRoles[0].id
        logger.info(`Read-only role already exists: ${readOnlyRoleId}`)
      } else {
        const role = await rbacService.createRbacRoles({
          name: "read_only",
          description: "Read-only access to admin dashboard",
        })
        readOnlyRoleId = role.id
        logger.info(`Created read-only role: ${readOnlyRoleId}`)

        const allPolicies = await rbacService.listRbacPolicies({})
        logger.info(`Found ${allPolicies.length} total policies`)

        const readOnlyPolicies = allPolicies.filter(
          (p: any) => p.operation === "read"
        )
        logger.info(`Found ${readOnlyPolicies.length} read policies`)

        if (readOnlyPolicies.length > 0) {
          await rbacService.createRbacRolePolicies(
            readOnlyPolicies.map((p: any) => ({
              role_id: readOnlyRoleId!,
              policy_id: p.id,
            }))
          )
          logger.info(
            `Attached ${readOnlyPolicies.length} read policies to role`
          )
        }
      }
    } catch (e: any) {
      logger.warn(`RBAC setup skipped (feature may not be enabled): ${e?.message ?? e}`)
    }

    const existingUsers = await userModule.listUsers({ email: GUEST_EMAIL })

    let userId: string

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id
      logger.info(`Guest user already exists with id: ${userId}`)
    } else {
      const user = await userModule.createUsers({
        email: GUEST_EMAIL,
        first_name: "Guest",
        last_name: "User",
        is_admin: true,
      })
      userId = user.id
      logger.info(`Created guest user with id: ${userId}`)
    }

    try {
      await authModule.register("emailpass", {
        body: { email: GUEST_EMAIL, password: GUEST_PASSWORD },
      })
      logger.info("Registered auth identity")
    } catch (e: any) {
      logger.warn(`register() error (may already exist): ${e?.message ?? e}`)
    }

    const finalAuth = await authModule.authenticate("emailpass", {
      body: { email: GUEST_EMAIL, password: GUEST_PASSWORD },
    })

    if (finalAuth.authIdentity) {
      const currentAppMeta = finalAuth.authIdentity.app_metadata || {}
      const roles = readOnlyRoleId ? [readOnlyRoleId] : []

      const needsUpdate =
        !currentAppMeta.user_id ||
        currentAppMeta.user_id !== userId ||
        JSON.stringify(currentAppMeta.roles) !== JSON.stringify(roles)

      if (needsUpdate) {
        logger.info(`Updating app_metadata: user_id=${userId}, roles=[${roles}]`)
        await authModule.updateAuthIdentities({
          id: finalAuth.authIdentity.id,
          app_metadata: {
            ...currentAppMeta,
            user_id: userId,
            roles,
          },
        })

        const verifyAuth = await authModule.authenticate("emailpass", {
          body: { email: GUEST_EMAIL, password: GUEST_PASSWORD },
        })
        logger.info(
          `Verified auth app_metadata: ${JSON.stringify(verifyAuth.authIdentity?.app_metadata)}`
        )
      } else {
        logger.info(`app_metadata already correct`)
      }
    }

    logger.info(
      `Guest user seeded successfully: ${GUEST_EMAIL} / ${GUEST_PASSWORD}`
    )
  } catch (err: any) {
    logger.error(`seedGuestUser failed: ${err?.message ?? err}`)
    throw err
  }
}
