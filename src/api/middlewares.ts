import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import express from "express"

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/uploads",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        express.json({ limit: "10mb" }),
      ],
    },
  ],
})
