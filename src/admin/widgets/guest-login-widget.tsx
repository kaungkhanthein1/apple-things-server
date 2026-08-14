import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Text } from "@medusajs/ui"
import { useState } from "react"

const GuestLoginWidget = () => {
  const [loading, setLoading] = useState(false)

  const handleGuestLogin = () => {
    setLoading(true)
    window.location.href = "/auth/guest"
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-ui-border-base h-px flex-1" />
        <Text className="text-ui-fg-muted" size="small">
          or
        </Text>
        <div className="bg-ui-border-base h-px flex-1" />
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={loading}
        onClick={handleGuestLogin}
      >
        {loading ? "Signing in as Guest..." : "Log in as Guest"}
      </Button>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "login.after",
})

export default GuestLoginWidget
