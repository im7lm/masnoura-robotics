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

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
      auth: { persistSession: false },
    });

    const { data: userData, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerMember } = await callerClient
      .from("members")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!callerMember || callerMember.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { member_id } = await req.json();
    if (!member_id) {
      return new Response(JSON.stringify({ error: "member_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch the auth user_id before deleting
    const { data: memberRow } = await adminClient
      .from("members")
      .select("user_id")
      .eq("id", member_id)
      .maybeSingle();

    // Remove related records safely
    await adminClient.from("task_grades").delete().eq("member_id", member_id);
    await adminClient.from("quiz_scores").delete().eq("member_id", member_id);
    await adminClient.from("strikes").delete().eq("member_id", member_id);
    await adminClient.from("bonuses").delete().eq("member_id", member_id);
    await adminClient.from("committee_hr").delete().eq("hr_id", member_id);
    await adminClient.from("director_committees").delete().eq("director_id", member_id);

    // Delete member row
    const { error: memberErr } = await adminClient
      .from("members")
      .delete()
      .eq("id", member_id);

    if (memberErr) {
      return new Response(JSON.stringify({ error: memberErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete auth user if linked
    if (memberRow?.user_id) {
      await adminClient.auth.admin.deleteUser(memberRow.user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
