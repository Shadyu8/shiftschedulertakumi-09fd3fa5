import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if any admin already exists
    const { data: existingAdmins } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "An admin user already exists. Bootstrap denied." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { username, password, full_name, email: providedEmail } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof username !== "string" || username.trim().length < 3 || username.length > 100) {
      return new Response(
        JSON.stringify({ error: "Username must be 3-100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use provided email or generate placeholder from username
    const email = (typeof providedEmail === "string" && EMAIL_REGEX.test(providedEmail))
      ? providedEmail
      : `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}@internal.noemail`;

    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return new Response(
        JSON.stringify({ error: "Password must be 8-128 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeName = typeof full_name === "string" ? full_name.trim().substring(0, 100) : "Admin";

    // Create admin user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: email,
        full_name: safeName,
        role: "admin",
      },
    });

    if (createError) {
      console.error("Bootstrap admin error:", createError);
      return new Response(
        JSON.stringify({ error: "Failed to create admin user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the role from default 'worker' to 'admin'
    if (newUser.user) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ role: "admin" })
        .eq("user_id", newUser.user.id);

      if (roleError) {
        console.error("Role update error:", roleError);
        return new Response(
          JSON.stringify({ error: "User created but failed to assign admin role" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user?.id, message: "Admin user created. You can now log in." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Bootstrap error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
