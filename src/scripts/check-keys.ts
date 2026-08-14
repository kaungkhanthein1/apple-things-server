import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function checkPolicyKeys({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const rbacModule = container.resolve(Modules.RBAC as any);

  const policies = await rbacModule.listRbacPolicies({}, { take: 5 });
  for (const p of policies || []) {
    logger.info(`id=${p.id} key=${p.key} resource=${p.resource} operation=${p.operation} name=${p.name}`);
  }
}