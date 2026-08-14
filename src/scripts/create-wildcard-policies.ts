import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

function capitalize(s: string) {
  return s.replace(/(^|_)(\w)/g, (_: any, __: any, c: string) => c.toUpperCase());
}

export default async function createWildcardPolicies({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const rbacModule = container.resolve(Modules.RBAC as any);

    const resources = ["inventory_item", "price_set", "price", "product", "product_variant", "product_option", "sales_channel"];

    const existingPolicies = await rbacModule.listRbacPolicies({}, { take: 500 });
    const existingKeys = new Set(existingPolicies?.map((p: any) => p.key) || []);

    for (const resource of resources) {
      const key = `${resource}:*`;
      if (existingKeys.has(key)) {
        logger.info(`Already exists: ${key}`);
        continue;
      }

      const name = `All${resource.split('_').map(capitalize).join('')}`;
      try {
        await rbacModule.createRbacPolicies({
          key,
          resource,
          operation: "*",
          name,
        });
        logger.info(`Created: ${key}`);
      } catch (err: any) {
        logger.error(`Failed ${key}: ${err?.message}`);
      }
    }

    // Attach all policies to admin role
    const adminRoles = await rbacModule.listRbacRoles({ name: "admin" });
    if (!adminRoles?.length) {
      logger.error("No admin role found");
      return;
    }
    const roleId = adminRoles[0].id;

    const allPolicies = await rbacModule.listRbacPolicies({}, { take: 500 });
    const rolePolicies = await rbacModule.listPoliciesForRole(roleId);
    const existingPolicyIds = new Set(rolePolicies?.map((p: any) => p.id) || []);

    const missingFromRole = allPolicies?.filter(
      (p: any) => !existingPolicyIds.has(p.id)
    ) || [];

    if (missingFromRole.length > 0) {
      logger.info(`Attaching ${missingFromRole.length} missing policies to admin role...`);
      await rbacModule.createRbacRolePolicies(
        missingFromRole.map((p: any) => ({ role_id: roleId, policy_id: p.id }))
      );
      logger.info("Attached policies to admin role");
    }

    logger.info("Done. Please log out and log back in.");
  } catch (err: any) {
    logger.error(`Failed: ${err?.message ?? err}`);
    throw err;
  }
}