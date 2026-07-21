import { Modules, MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { filename, mimeType, content } = req.body as {
    filename?: string
    mimeType?: string
    content?: string
  }

  if (!content || !filename || !mimeType) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Missing filename, mimeType, or content (base64)"
    )
  }

  const fileModule = req.scope.resolve(Modules.FILE)

  const result = await fileModule.createFiles({
    filename,
    mimeType,
    content,
    access: "public",
  })

  res.status(200).json({ files: Array.isArray(result) ? result : [result] })
}
