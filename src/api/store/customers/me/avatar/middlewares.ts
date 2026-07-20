import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/customers/me/avatar",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        upload.single("file"),
      ],
    },
  ],
})
