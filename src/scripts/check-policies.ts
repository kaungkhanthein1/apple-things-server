import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function checkPolicies({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const rbacModule = container.resolve(Modules.RBAC as any);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // List all policies
    const policies = await rbacModule.listRbacPolicies({}, { take: 500 });
    logger.info(`Total policies: ${policies?.length || 0}`);

    // Check for missing write policies
    const requiredWritePolicies = [
      'product:create',
      'product_variant:create', 
      'product_option:create',
      'inventory_item:create',
      'price_set:create',
      'price:create',
      'sales_channel:update'
    ];

    const existingPolicies = policies?.map((p: any) => `${p.resource}:${p.operation}`) || [];
    const missingPolicies = requiredWritePolicies.filter(p => !existingPolicies.includes(p));

    if (missingPolicies.length > 0) {
      logger.error(`Missing required policies: ${missingPolicies.join(', ')}`);
    } else {
      logger.info('All required write policies exist');
    }

    // Check admin role policies
    const adminRoles = await rbacModule.listRbacRoles({ name: 'admin' });
    if (!adminRoles?.length) {
      logger.error('No admin role found');
      return;
    }

    const adminRole = adminRoles[0];
    const rolePolicies = await rbacModule.listPoliciesForRole(adminRole.id);
    const rolePolicyNames = rolePolicies?.map((p: any) => `${p.resource}:${p.operation}`) || [];

    const missingFromRole = requiredWritePolicies.filter(p => !rolePolicyNames.includes(p));
    if (missingFromRole.length > 0) {
      logger.error(`Admin role missing policies: ${missingFromRole.join(', ')}`);
    } else {
      logger.info('Admin role has all required write policies');
    }

    // Check user's permissions
    const { data: users } = await query.graph({
      entity: 'user',
      fields: ['rbac_roles.id', 'rbac_roles.name', 'rbac_roles.policies.resource', 'rbac_roles.policies.operation'],
      filters: { email: 'admin@gmail.com' },
    });

    const user = users?.[0];
    if (!user) {
      logger.error('User not found');
      return;
    }

    const userPolicies = user.rbac_roles?.flatMap((r: any) => 
      r.policies?.map((p: any) => `${p.resource}:${p.operation}`) || []
    ) || [];

    const missingFromUser = requiredWritePolicies.filter(p => !userPolicies.includes(p));
    if (missingFromUser.length > 0) {
      logger.error(`User missing policies: ${missingFromUser.join(', ')}`);
    } else {
      logger.info('User has all required write policies');
    }

  } catch (err: any) {
    logger.error(`Failed: ${err?.message ?? err}`);
    throw err;
  }
}