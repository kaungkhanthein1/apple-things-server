import { Modules, MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type UploadedFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

type StoreUploadRequest = MedusaRequest & {
  files?: UploadedFile[]
}

export async function POST(
  req: StoreUploadRequest,
  res: MedusaResponse
) {
  const input = req.files

  if (!input?.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No files were uploaded")
  }

  const fileModule = req.scope.resolve(Modules.FILE)

  const results = await Promise.all(
    input.map(async (file) => {
      const result = await fileModule.createFiles({
        filename: file.originalname,
        mimeType: file.mimetype,
        content: file.buffer.toString("base64"),
        access: "public",
      })
      return result
    })
  )

  res.status(200).json({ files: Array.isArray(results[0]) ? results[0] : results })
}
