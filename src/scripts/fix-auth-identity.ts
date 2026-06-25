import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function fixAuthIdentity({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  // Read ids written by delete-user.ts
  let email: string | undefined;
  let userId: string | undefined;
  try {
    const fs = await import("fs/promises");
    const path = require("path");
    const inPath = path.resolve(process.cwd(), ".user-ids.json");
    const raw = await fs.readFile(inPath, "utf-8");
    const parsed = JSON.parse(raw);
    email = parsed.email;
    userId = Array.isArray(parsed.userIds) && parsed.userIds.length ? parsed.userIds[0] : undefined;
  } catch (e: any) {
    logger.warn(`Could not read .user-ids.json: ${e?.message ?? e}`);
  }

  email = process.env.RESTORE_USER_EMAIL || email;
  userId = process.env.RESTORE_USER_ID || userId;
  const password = process.env.RESTORE_USER_PASSWORD || "MedusaAdmin@123";

  if (!email || !userId) {
    logger.error("Missing email or user id. Set RESTORE_USER_EMAIL and RESTORE_USER_ID or create .user-ids.json");
    return;
  }

  logger.info(`Ensuring auth identity for email=${email} links to user id=${userId}`);

  try {
    const authModule = container.resolve(Modules.AUTH as any);

    // Try authenticating with the password first
    try {
      const authResp = await authModule.authenticate("emailpass", { body: { email, password } });
      logger.info(`Initial authenticate response: ${JSON.stringify(authResp, null, 2)}`);
      if (authResp?.success && authResp?.authIdentity) {
        // Check for provider identity linking to our user id
        const authIdentity = authResp.authIdentity;
        const existing = (authIdentity.provider_identities || []).find((p: any) => p.provider === "emailpass" && (p.entity_id === userId || p.user_metadata?.id === userId || p.user_metadata?.user_id === userId));
        if (existing) {
          logger.info("Auth identity already linked to user id. No action needed.");
          return;
        }
      }
    } catch (e: any) {
      logger.info(`authenticate() failed: ${e?.message ?? e}`);
    }

    // Ensure an auth identity exists for the email (register will create it if missing)
    let registered: any;
    try {
      registered = await authModule.register("emailpass", { body: { email, password } });
      logger.info(`register response: ${JSON.stringify(registered, null, 2)}`);
    } catch (e: any) {
      logger.warn(`register() error: ${e?.message ?? e}`);
    }

    const authIdentity = registered?.authIdentity ?? registered?.auth_identity ?? null;

    // If we didn't get an authIdentity from register, attempt to locate provider identities by email
    let authIdentityId: string | undefined = authIdentity?.id;
    if (!authIdentityId) {
      try {
        const providerList = await authModule.listProviderIdentities({ provider: "emailpass", entity_id: email });
        if (Array.isArray(providerList) && providerList.length > 0) {
          authIdentityId = providerList[0].auth_identity_id;
          logger.info(`Found providerIdentity for email; auth_identity_id=${authIdentityId}`);
        }
      } catch (e: any) {
        logger.warn(`listProviderIdentities by email failed: ${e?.message ?? e}`);
      }
    }

    if (!authIdentityId) {
      logger.error("Could not determine auth identity id for email. Aborting.");
      return;
    }

    // Check if there's already a provider identity linking this auth identity to the user id
    let existingLink: any[] = [];
    try {
      existingLink = await authModule.listProviderIdentities({ auth_identity_id: authIdentityId, provider: "emailpass" });
    } catch (e: any) {
      logger.warn(`listProviderIdentities by auth_identity_id failed: ${e?.message ?? e}`);
    }

    const alreadyLinked = (existingLink || []).some((p: any) => p.entity_id === userId || p.user_metadata?.id === userId || p.user_metadata?.user_id === userId);
    if (alreadyLinked) {
      logger.info("Provider identity already links auth identity to user id.");
      return;
    }

    // Create a provider identity that links the auth identity to the user id
    try {
      const createDto = {
        provider: "emailpass",
        entity_id: userId,
        auth_identity_id: authIdentityId,
        user_metadata: { email },
      };
      const created = await authModule.createProviderIdentities(createDto);
      logger.info(`Created provider identity: ${JSON.stringify(created, null, 2)}`);
    } catch (e: any) {
      logger.error(`Failed to create provider identity: ${e?.message ?? e}`);
      throw e;
    }

    // Final test: authenticate
    try {
      const final = await authModule.authenticate("emailpass", { body: { email, password } });
      logger.info(`Final authenticate response: ${JSON.stringify(final, null, 2)}`);
    } catch (e: any) {
      logger.warn(`Final authenticate() failed: ${e?.message ?? e}`);
    }
  } catch (err: any) {
    logger.error(`fixAuthIdentity failed: ${err?.message ?? err}`);
    throw err;
  }
}
