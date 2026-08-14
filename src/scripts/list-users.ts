import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function listUsers({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const userModule = container.resolve(Modules.USER as any);
  const users = await userModule.listUsers({});
  console.log(JSON.stringify(users, null, 2));
}