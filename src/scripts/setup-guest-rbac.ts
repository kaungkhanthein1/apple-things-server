const GUEST_EMAIL = "guest@applethings.com"
const GUEST_PASSWORD = "GuestPassword123!"
const ADMIN_EMAIL = "admin@medusa-test.com"
const ADMIN_PASSWORD = "supersecret"
const BASE = "http://localhost:9000"

async function main() {
  console.log("=== Setting up Read-Only RBAC Role for Guest User ===\n")

  // 1. Login as admin to get a session
  console.log("1. Logging in as admin...")
  const loginRes = await fetch(`${BASE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })

  if (!loginRes.ok) {
    const err = await loginRes.text()
    console.error("Admin login failed:", loginRes.status, err)
    console.log("\nTrying to find an admin user...")
    process.exit(1)
  }

  const { token } = await loginRes.json()

  const sessionRes = await fetch(`${BASE}/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  const cookie = sessionRes.headers.get("set-cookie")
  if (!cookie) {
    console.error("Failed to get session cookie")
    process.exit(1)
  }
  const sid = cookie.split(";")[0]
  console.log("   Admin logged in\n")

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: sid,
  }

  // 2. Check if read_only role already exists
  console.log("2. Checking for existing read_only role...")
  const rolesRes = await fetch(`${BASE}/admin/rbac/roles?name=read_only`, {
    headers: authHeaders,
  })
  const rolesData = await rolesRes.json()
  let roleId = rolesData.roles?.find((r: any) => r.name === "read_only")?.id

  if (roleId) {
    console.log(`   Read-only role already exists: ${roleId}\n`)
  } else {
    // 3. Create read_only role
    console.log("3. Creating read_only role...")
    const createRes = await fetch(`${BASE}/admin/rbac/roles`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "read_only",
        description: "Read-only access to admin dashboard",
      }),
    })
    const created = await createRes.json()
    roleId = created.role?.id
    console.log(`   Created role: ${roleId}\n`)

    // 4. Get all read policies
    console.log("4. Fetching read policies...")
    const policiesRes = await fetch(`${BASE}/admin/rbac/policies?limit=200`, {
      headers: authHeaders,
    })
    const policiesData = await policiesRes.json()
    const readOnlyPolicies = policiesData.policies?.filter(
      (p: any) => p.operation === "read"
    ) || []
    console.log(`   Found ${readOnlyPolicies.length} read policies\n`)

    // 5. Attach read policies to the role
    if (readOnlyPolicies.length > 0 && roleId) {
      console.log("5. Attaching read policies to role...")
      const attachRes = await fetch(`${BASE}/admin/rbac/roles/${roleId}/policies`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          policies: readOnlyPolicies.map((p: any) => p.id),
        }),
      })
      if (attachRes.ok) {
        console.log(`   Attached ${readOnlyPolicies.length} read policies\n`)
      } else {
        const err = await attachRes.text()
        console.error(`   Failed to attach policies: ${attachRes.status} ${err}\n`)
      }
    }
  }

  // 6. Find guest user
  console.log("6. Finding guest user...")
  const usersRes = await fetch(`${BASE}/admin/users?email=${GUEST_EMAIL}`, {
    headers: authHeaders,
  })
  const usersData = await usersRes.json()
  const guestUser = usersData.users?.find((u: any) => u.email === GUEST_EMAIL)

  if (!guestUser) {
    console.error("   Guest user not found!")
    process.exit(1)
  }
  console.log(`   Found guest user: ${guestUser.id}\n`)

  // 7. Assign role to guest user
  console.log("7. Assigning read_only role to guest user...")
  const assignRes = await fetch(`${BASE}/admin/users/${guestUser.id}/rbac-roles`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ id: roleId }),
  })

  if (assignRes.ok) {
    console.log(`   Role assigned successfully\n`)
  } else {
    const err = await assignRes.text()
    console.error(`   Failed to assign role: ${assignRes.status} ${err}\n`)
  }

  // 8. Update auth identity app_metadata to include role
  console.log("8. Updating guest auth identity app_metadata...")
  const authRes = await fetch(`${BASE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: GUEST_EMAIL, password: GUEST_PASSWORD }),
  })
  const authData = await authRes.json()

  const jwtPayload = JSON.parse(
    Buffer.from(authData.token.split(".")[1], "base64").toString()
  )
  console.log("   Current app_metadata:", JSON.stringify(jwtPayload.app_metadata))

  if (roleId && !jwtPayload.app_metadata?.roles?.includes(roleId)) {
    console.log("   NOTE: The guest user's JWT will include the role on next login.")
    console.log("   The RBAC role has been created and assigned.")
  }

  console.log("\n=== Done! Guest user now has read-only permissions. ===")
  console.log("   Log out and log back in as Guest to apply the new role.")
}

main().catch((err) => {
  console.error("Setup failed:", err)
  process.exit(1)
})
