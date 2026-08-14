import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function verifyAdminRole({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const adminEmail = "admin@gmail.com";

  try {
    const userModule = container.resolve(Modules.USER as any);
    const rbacModule = container.resolve(Modules.RBAC as any);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const users = await userModule.listUsers({ email: adminEmail });
    if (!users?.length) {
      logger.error(`User with email ${adminEmail} not found`);
      return;
    }

    const user = users[0];
    logger.info(`User: ${user.id}`);

    // Check user roles
    const { data: userWithRoles } = await query.graph({
      entity: "user",
      fields: ["rbac_roles.id", "rbac_roles.name", "rbac_roles.policies.id", "rbac_roles.policies.operation", "rbac_roles.policies.resource"],
      filters: { id: user.id },
    });

    logger.info(`User roles: ${JSON.stringify(userWithRoles?.[0]?.rbac_roles, null, 2)}`);
  } catch (err: any) {
    logger.error(`Error: ${err?.message ?? err}`);
    throw err;
  }
}