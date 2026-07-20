import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminEmail = "admin@nexus.edu";
    const adminPassword = "nexus2026";
    const adminName = "General Team Leader";
    const adminPosition = "General Team Leader";

    const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { name: adminName, position: adminPosition, role: "admin" },
      }),
    });

    if (!adminRes.ok) {
      const errText = await adminRes.text();
      if (errText.includes("already been registered") || errText.includes("already exists")) {
        const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(adminEmail)}`, {
          headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
        });
        const listData = await listRes.json();
        const existing = listData.users?.[0];
        if (existing) {
          await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "apikey": SERVICE_ROLE_KEY },
          });
        }
        const retryRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "apikey": SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: { name: adminName, position: adminPosition, role: "admin" },
          }),
        });
        if (!retryRes.ok) {
          return new Response(JSON.stringify({ error: await retryRes.text() }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const retryData = await retryRes.json();
        return await upsertMember(retryData.id, adminName, adminEmail, adminPosition);
      }
      return new Response(JSON.stringify({ error: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminData = await adminRes.json();
    return await upsertMember(adminData.id, adminName, adminEmail, adminPosition);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertMember(userId: string, name: string, email: string, position: string) {
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/members?user_id=eq.${userId}`, {
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name,
      email,
      position,
      role: "admin",
      status: "active",
    }),
  });

  if (!dbRes.ok && !dbRes.text().includes("duplicate")) {
    const errText = await dbRes.text();
    if (!errText.includes("user_id_key") && !errText.includes("duplicate")) {
      return new Response(JSON.stringify({ error: `DB error: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(email)}`, {
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    method: "PATCH",
    body: JSON.stringify({ user_id: userId, role: "admin", status: "active" }),
  });

  const result = await updateRes.json();
  return new Response(JSON.stringify({ success: true, user_id: userId, member: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
