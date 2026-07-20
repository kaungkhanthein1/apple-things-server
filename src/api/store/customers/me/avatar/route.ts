import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow, updateCustomersWorkflow } from "@medusajs/core-flows"
import { MedusaError } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id

  if (!customerId) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not authenticated")
  }

  const file = req.file
  if (!file) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No file uploaded")
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: [
        {
          filename: file.originalname,
          mimeType: file.mimetype,
          content: file.buffer.toString("base64"),
          access: "public",
        },
      ],
    },
  })

  const uploadedFile = result[0]

  await updateCustomersWorkflow(req.scope).run({
    input: {
      selector: { id: customerId },
      update: {
        metadata: {
          avatar_file_id: uploadedFile.id,
          avatar_url: uploadedFile.url,
        },
      },
    },
  })

  return res.status(200).json({
    avatar: {
      id: uploadedFile.id,
      url: uploadedFile.url,
    },
  })
}
