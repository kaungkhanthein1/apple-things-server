import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/uploads",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
      ],
    },
  ],
})
