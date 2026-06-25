import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function createAdmin({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const email = process.env.ADMIN_EMAIL || "local.admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";
  const first_name = process.env.ADMIN_FIRST_NAME || "Local";
  const last_name = process.env.ADMIN_LAST_NAME || "Admin";

  logger.info(`Creating admin user ${email}`);

  try {
    const userModule = container.resolve(Modules.USER as any);
    const authModule = container.resolve(Modules.AUTH as any);

    // Create user (if exists, listUsers will reveal it)
    const existing = await userModule.listUsers({ email });
    if (existing && existing.length) {
      logger.info(`User with email ${email} already exists: ${existing[0].id}`);
    }

    let user: any;
    if (!existing || !existing.length) {
      user = await userModule.createUsers({
        email,
        first_name,
        last_name,
        is_admin: true,
      });
      logger.info(`Created user id=${user.id}`);
    } else {
      user = existing[0];
      // Ensure is_admin
      try {
        await userModule.updateUsers({ id: user.id, is_admin: true });
        logger.info(`Ensured is_admin=true for user id=${user.id}`);
      } catch (e: any) {
        logger.warn(`Could not set is_admin: ${e?.message ?? e}`);
      }
    }

    // Register auth identity (creates auth identity and provider identity with password)
    let regResp: any;
    try {
      regResp = await authModule.register("emailpass", { body: { email, password } });
      logger.info(`register response: ${JSON.stringify(regResp)}`);
    } catch (e: any) {
      logger.warn(`register error: ${e?.message ?? e}`);
    }

    // Determine auth_identity id
    let authIdentityId: string | undefined = regResp?.authIdentity?.id ?? regResp?.auth_identity?.id;
    if (!authIdentityId) {
      // try finding via provider identities
      try {
        const providerList = await authModule.listProviderIdentities({ provider: "emailpass", entity_id: email });
        if (Array.isArray(providerList) && providerList.length > 0) {
          authIdentityId = providerList[0].auth_identity_id;
          logger.info(`Found existing provider identity; auth_identity_id=${authIdentityId}`);
        }
      } catch (e: any) {
        logger.warn(`listProviderIdentities failed: ${e?.message ?? e}`);
      }
    }

    if (!authIdentityId) {
      logger.error("Could not determine auth identity id; aborting link step.");
    } else {
      // Ensure a provider identity links the auth identity to this user (user_metadata)
      try {
        const existingProviders = await authModule.listProviderIdentities({ provider: "emailpass", entity_id: email });
        const linked = (existingProviders || []).some((p: any) => p.user_metadata && (p.user_metadata.id === user.id || p.user_metadata.user_id === user.id));
        if (!linked) {
          const createDto = [{
            provider: "emailpass",
            entity_id: email,
            auth_identity_id: authIdentityId,
            user_metadata: { id: user.id, email },
          }];
          const created = await authModule.createProviderIdentities(createDto);
          logger.info(`Created provider identity linking auth -> user: ${JSON.stringify(created)}`);
        } else {
          logger.info("Provider identity already links auth identity to user.");
        }
      } catch (e: any) {
        logger.warn(`createProviderIdentities failed: ${e?.message ?? e}`);
      }
    }

    // Final test: authenticate
    try {
      const final = await authModule.authenticate("emailpass", { body: { email, password } });
      logger.info(`authenticate test result: ${JSON.stringify(final)}`);
    } catch (e: any) {
      logger.warn(`authenticate test failed: ${e?.message ?? e}`);
    }

    logger.info(`Admin credentials: ${email} / ${password}`);
  } catch (err: any) {
    logger.error(`createAdmin failed: ${err?.message ?? err}`);
    throw err;
  }
}
