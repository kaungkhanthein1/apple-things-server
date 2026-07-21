import { uploadFilesWorkflow } from "@medusajs/core-flows"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

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

  try {
    const { result } = await uploadFilesWorkflow(req.scope).run({
      input: {
        files: [
          {
            filename,
            mimeType,
            content,
            access: "public",
          },
        ],
      },
    })

    res.status(200).json({ files: result })
  } catch (err) {
    console.error("[store/uploads] Upload failed:", err)
    const message = err instanceof Error ? err.message : "Upload failed"
    res.status(500).json({ code: "upload_error", message })
  }
}
