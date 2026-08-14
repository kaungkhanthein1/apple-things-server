import { loadEnv } from '@medusajs/framework/utils'
import { defineConfig } from '@medusajs/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  admin: {
    brand: {
      title: "Apple Things",
    },
    options: {
      title: "Apple Things Admin",
    },
    vite: (config) => {
      const outDir = config.build?.outDir

      config.plugins = (config.plugins ?? []).filter((plugin) => {
        return plugin?.name !== "vite:react-refresh"
      })

      config.server = {
        ...(config.server ?? {}),
        hmr: {
          ...(typeof config.server?.hmr === "object" && config.server.hmr !== null
            ? config.server.hmr
            : {}),
          overlay: false,
        },
      }

      config.plugins = [
        ...config.plugins,
        {
          name: "apple-things-login-brand",
          apply: "build",
          closeBundle() {
            const fs = require("fs")
            const path = require("path")

            if (!outDir) {
              console.error("apple-things-login-brand: no outDir resolved, skipping patch")
              return
            }

            const htmlPath = path.join(outDir, "index.html")

            try {
              let html = fs.readFileSync(htmlPath, "utf-8")

              if (html.includes("apple-things-login-brand")) {
                return
              }

              const injected = html.replace(
                "</head>",
                `<script id="apple-things-login-brand">
                (() => {
                  const logoSrc = "data:image/jpeg;base64,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"
                  const applied = new WeakSet()

                  const render = () => {
                    document
                      .querySelectorAll('svg[viewBox="0 0 400 400"]')
                      .forEach((svg) => {
                        if (applied.has(svg)) {
                          return
                        }

                        applied.add(svg)

                        const SIZE = "58px"
                        const image = document.createElement("img")
                        image.alt = "Apple Things"
                        image.src = logoSrc
                        image.className = svg.getAttribute("class") || ""
                        image.style.width = SIZE
                        image.style.height = SIZE
                        image.style.maxWidth = "none"
                        image.style.objectFit = "cover"
                        image.style.display = "block"
                        image.style.borderRadius = "10px"
                        image.style.flexShrink = "0"
                        svg.replaceWith(image)

                        const outerBox = image.parentElement && image.parentElement.parentElement
                        if (outerBox) {
                          outerBox.style.width = SIZE
                          outerBox.style.height = SIZE
                        }

                        const innerBox = image.parentElement
                        if (innerBox) {
                          innerBox.style.width = SIZE
                          innerBox.style.height = SIZE
                          innerBox.style.display = "flex"
                          innerBox.style.alignItems = "center"
                          innerBox.style.justifyContent = "center"
                        }
                      })
                  }

                  render()

                  const observer = new MutationObserver(render)
                  observer.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                  })

                  window.addEventListener("load", render, { once: true })
                  window.setTimeout(() => observer.disconnect(), 10000)
                })()
              </script></head>`
              )

              fs.writeFileSync(htmlPath, injected)
              console.log("apple-things-login-brand: patched " + htmlPath)
            } catch (err) {
              console.error("apple-things-login-brand: failed to patch index.html", err)
            }
          },
        },
      ]

      return
    },
  },
  modules: {
    rbac: {
      resolve: "@medusajs/rbac",
    },
    auth: {
      resolve: "@medusajs/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/auth-emailpass",
            id: "emailpass",
          },
        ],
      },
    },
    file: {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@tsc_tech/medusa-plugin-cloudinary/providers/file-cloudinary",
            id: "cloudinary",
            options: {
              cloudName: process.env.CLOUDINARY_CLOUD_NAME,
              apiKey: process.env.CLOUDINARY_API_KEY,
              apiSecret: process.env.CLOUDINARY_API_SECRET,
              secure: true,
            },
          },
        ],
      },
    },
    homeBanner: {
      resolve: "./src/modules/home-banner",
    },
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
      bodyLimit: 10 * 1024 * 1024,
    }
  }
} as any)
