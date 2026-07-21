import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/uploads",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        upload.array("files"),
      ],
    },
  ],
})
