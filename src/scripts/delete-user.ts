import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function deleteUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const email = process.env.DELETE_USER_EMAIL || "kaungkhantheinkkh2003@gmail.com";
  logger.info(`Deleting user with email: ${email}`);

  try {
    const userModuleService = container.resolve(Modules.USER as any);
    const users = await userModuleService.listUsers({ email });
    if (!users || users.length === 0) {
      logger.info(`No user found with email: ${email}`);
      return;
    }

    // Log full user objects for debugging (includes related identities when provided)
    logger.info(`Found users: ${JSON.stringify(users, null, 2)}`);

    const userIds = users.map((u: any) => u.id);
    await userModuleService.softDeleteUsers(userIds);

    // Try to collect identity ids if present on the returned user objects
    const identityIds: string[] = [];
    users.forEach((u: any) => {
      if (Array.isArray(u.identities)) {
        u.identities.forEach((idObj: any) => {
          if (idObj?.id) identityIds.push(idObj.id);
        });
      }
    });

    // Persist the ids to a workspace file so other scripts can pick them up
    try {
      const fs = await import("fs/promises");
      const path = require("path");
      const out = {
        email,
        userIds,
        identityIds,
        timestamp: new Date().toISOString(),
      };
      const outPath = path.resolve(process.cwd(), ".user-ids.json");
      await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf-8");
      logger.info(`Wrote user ids to ${outPath}`);
    } catch (e: any) {
      logger.warn(`Could not write .user-ids.json: ${e?.message ?? e}`);
    }

    logger.info(`Soft-deleted user(s) with email: ${email}`);
  } catch (err: any) {
    logger.error(`Failed to delete user: ${err?.message ?? err}`);
    throw err;
  }
}
