import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function listPolicies({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const rbacModule = container.resolve(Modules.RBAC as any);

    // List all policies
    const policies = await rbacModule.listRbacPolicies({}, { take: 500 });
    logger.info(`Total policies: ${policies?.length || 0}`);

    // Group by resource
    const byResource: Record<string, string[]> = {};
    for (const p of policies || []) {
      const key = p.resource || 'unknown';
      if (!byResource[key]) byResource[key] = [];
      byResource[key].push(p.operation);
    }

    // Print sorted resources
    for (const [resource, ops] of Object.entries(byResource).sort()) {
      logger.info(`${resource}: ${ops.join(', ')}`);
    }

  } catch (err: any) {
    logger.error(`Failed: ${err?.message ?? err}`);
    throw err;
  }
}