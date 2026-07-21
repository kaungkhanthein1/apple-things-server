import { uploadFilesWorkflow } from "@medusajs/core-flows"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

type UploadedFile = {
  originalname: string
  mimetype: string
  buffer: Buffer
}

type StoreUploadRequest = AuthenticatedMedusaRequest & {
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

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: input.map((file) => ({
        filename: file.originalname,
        mimeType: file.mimetype,
        content: file.buffer.toString("base64"),
        access: "public",
      })),
    },
  })

  res.status(200).json({ files: result })
}
