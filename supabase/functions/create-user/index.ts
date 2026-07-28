import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const callerClient = createClient(
  supabaseUrl,
  anonKey,
  {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization")!,
      },
    },
    auth: {
      persistSession: false,
    },
  }
);
    const { data: userData, error: authErr } = await callerClient.auth.getUser();
    console.log("AUTH ERROR:", authErr);
    console.log("USER:", userData);
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerMember } = await callerClient
      .from("members")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!callerMember || callerMember.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse request body
    const body = await req.json();
    const { name, email, password, role, committee_id, section_id, position } = body;

    if (!name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields: name, email, password, role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Create auth user
    const { data: newAuthUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create member record
    const { data: newMember, error: memberErr } = await adminClient
      .from("members")
      .insert({
        name,
        email,
        user_id: newAuthUser.user.id,
        role,
        committee_id: committee_id || null,
        section_id: section_id || null,
        position: position || role.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        status: "active",
        join_date: new Date().toISOString().slice(0, 10),
        notes: "[]",
      })
      .select()
      .single();

    if (memberErr) {
      // Rollback: delete the auth user
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id);
      return new Response(JSON.stringify({ error: memberErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ member: newMember, auth_user_id: newAuthUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
