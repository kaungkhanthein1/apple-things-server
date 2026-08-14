import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function assignAdminRole({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const adminEmail = "admin@gmail.com";

  logger.info(`Assigning admin role to user: ${adminEmail}`);

  try {
    const userModule = container.resolve(Modules.USER as any);
    const rbacModule = container.resolve(Modules.RBAC as any);
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const users = await userModule.listUsers({ email: adminEmail });
    if (!users?.length) {
      logger.error(`User with email ${adminEmail} not found`);
      return;
    }

    const user = users[0];
    logger.info(`Found user: ${user.id}`);

    // Find or create admin role
    let adminRole = await rbacModule.listRbacRoles({ name: "admin" });
    if (!adminRole?.length) {
      logger.info("Creating admin role...");
      const created = await rbacModule.createRbacRoles({
        name: "admin",
        description: "Full admin access",
      });
      adminRole = [created];
      logger.info(`Created admin role: ${created.id}`);
    } else {
      logger.info(`Admin role already exists: ${adminRole[0].id}`);
    }

    const roleId = adminRole[0].id;

    // Check if all policies are attached to role
    const policies = await rbacModule.listRbacPolicies({}, { take: 500 });
    const allPolicies = policies || [];
    logger.info(`Found ${allPolicies.length} total policies`);

    // Check existing role policies
    const existingPolicies = await rbacModule.listPoliciesForRole(roleId);
    const existingPolicyIds = existingPolicies?.map((p: any) => p.id) || [];
    logger.info(`Role already has ${existingPolicyIds.length} policies`);

    // Find missing policies
    const missingPolicies = allPolicies.filter((p: any) => !existingPolicyIds.includes(p.id));
    if (missingPolicies.length > 0) {
      logger.info(`Adding ${missingPolicies.length} missing policies...`);
      const rolePolicies = missingPolicies.map((p: any) => ({
        role_id: roleId,
        policy_id: p.id,
      }));
      await rbacModule.createRbacRolePolicies(rolePolicies);
      logger.info("Added missing policies");
    } else {
      logger.info("All policies already attached");
    }

    // Check if user already has the role via link
    const { data: userWithRoles } = await query.graph({
      entity: "user",
      fields: ["rbac_roles.id"],
      filters: { id: user.id },
    });

    const userRoles = userWithRoles?.[0]?.rbac_roles || [];
    const hasAdminRole = userRoles.some((r: any) => r.id === roleId);

    if (!hasAdminRole) {
      // Create link between user and role
      await link.create([
        {
          [Modules.USER]: {
            user_id: user.id,
          },
          [Modules.RBAC]: {
            rbac_role_id: roleId,
          },
        },
      ]);
      logger.info(`Assigned admin role to user ${user.id}`);
    } else {
      logger.info(`User ${user.id} already has admin role`);
    }

    // Verify
    const { data: verified } = await query.graph({
      entity: "user",
      fields: ["rbac_roles.id", "rbac_roles.name"],
      filters: { id: user.id },
    });
    logger.info(`User roles after assignment: ${JSON.stringify(verified?.[0]?.rbac_roles)}`);

    logger.info("Done! Admin user now has full permissions. Please log out and log back in.");
  } catch (err: any) {
    logger.error(`Failed to assign admin role: ${err?.message ?? err}`);
    throw err;
  }
}