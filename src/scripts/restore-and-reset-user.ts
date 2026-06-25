import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function restoreAndReset({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const email = process.env.RESTORE_USER_EMAIL || "kaungkhantheinkkh2003@gmail.com";
  const newPassword = process.env.RESTORE_USER_PASSWORD || "kkh@188955";

  logger.info(`Restoring user with email: ${email}`);

  try {
    const userModuleService = container.resolve(Modules.USER as any);

    // Determine user id to restore: prefer explicit env var, then .user-ids.json
    let userId: string | undefined = process.env.RESTORE_USER_ID;
    if (!userId) {
      try {
        const fs = await import("fs/promises");
        const path = require("path");
        const inPath = path.resolve(process.cwd(), ".user-ids.json");
        const raw = await fs.readFile(inPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.userIds) && parsed.userIds.length > 0) {
          userId = parsed.userIds[0];
          logger.info(`Picked user id ${userId} from .user-ids.json`);
        }
      } catch (e: any) {
        logger.warn(`Could not read .user-ids.json: ${e?.message ?? e}`);
      }
    }

    if (!userId) {
      logger.info("No user id provided via RESTORE_USER_ID and none found in .user-ids.json. Aborting.");
      return;
    }

    // Restore by explicit id
    try {
      await userModuleService.restoreUsers([userId]);
      logger.info(`Restored user id=${userId}`);
    } catch (e: any) {
      logger.error(`Failed to restore user id=${userId}: ${e?.message ?? e}`);
      throw e;
    }

    // Update password via module's updateUsers. Some implementations accept an array or object; try common signatures.
    try {
      // If updateUsers expects an object with id and fields
      if (typeof userModuleService.updateUsers === "function") {
        await userModuleService.updateUsers({ id: userId, password: newPassword });
        logger.info(`Updated password for user id=${userId}`);
      }
    } catch (e: any) {
      logger.warn(`Failed to update password via updateUsers: ${e?.message ?? e}`);
    }
  } catch (err: any) {
    logger.error(`Failed to restore/reset user: ${err?.message ?? err}`);
    throw err;
  }
}
