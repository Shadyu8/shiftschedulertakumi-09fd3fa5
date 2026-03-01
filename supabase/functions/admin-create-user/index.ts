import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["admin", "manager", "shiftleader", "worker", "kiosk"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller using anon key client with user's token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      console.error("Auth verification error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller role using admin client (bypasses RLS)
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerRole || !["admin", "manager"].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Delete user action
    if (body.action === "delete") {
      if (!body.user_id || !UUID_REGEX.test(body.user_id)) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Prevent deleting yourself
      if (body.user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.deleteUser(body.user_id);
      if (error) {
        console.error("Delete user error:", error);
        return new Response(JSON.stringify({ error: "Failed to delete user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user action
    if (body.action === "update") {
      if (!body.user_id || !UUID_REGEX.test(body.user_id)) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile fields
      const profileUpdates: Record<string, any> = {};
      if (body.full_name !== undefined) {
        if (typeof body.full_name !== "string" || body.full_name.trim().length === 0 || body.full_name.length > 100) {
          return new Response(JSON.stringify({ error: "Name must be 1-100 characters" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        profileUpdates.full_name = body.full_name.trim();
      }
      if (body.active !== undefined) {
        profileUpdates.active = Boolean(body.active);
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await adminClient
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", body.user_id);
        if (profileError) {
          console.error("Update profile error:", profileError);
          return new Response(JSON.stringify({ error: "Failed to update profile" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update role if provided
      if (body.role) {
        if (!VALID_ROLES.includes(body.role)) {
          return new Response(JSON.stringify({ error: "Invalid role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Only admins can promote to manager
        if (body.role === "manager" && callerRole.role !== "admin") {
          return new Response(JSON.stringify({ error: "Only admins can promote to manager" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Only admins can promote to admin
        if (body.role === "admin" && callerRole.role !== "admin") {
          return new Response(JSON.stringify({ error: "Only admins can promote to admin" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: roleError } = await adminClient
          .from("user_roles")
          .update({ role: body.role })
          .eq("user_id", body.user_id);
        if (roleError) {
          console.error("Update role error:", roleError);
          return new Response(JSON.stringify({ error: "Failed to update role" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update password if provided
      if (body.password && typeof body.password === "string" && body.password.trim().length > 0) {
        if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
          return new Response(JSON.stringify({ error: "Password must be 8-128 characters" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: pwError } = await adminClient.auth.admin.updateUserById(body.user_id, {
          password: body.password,
        });
        if (pwError) {
          console.error("Update password error:", pwError);
          return new Response(JSON.stringify({ error: "Failed to update password" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update locations if provided
      if (body.location_ids && Array.isArray(body.location_ids)) {
        // Remove existing locations
        await adminClient.from("user_locations").delete().eq("user_id", body.user_id);
        // Insert new ones
        const locationRows = body.location_ids
          .filter((id: string) => UUID_REGEX.test(id))
          .map((location_id: string) => ({ user_id: body.user_id, location_id }));
        if (locationRows.length > 0) {
          await adminClient.from("user_locations").insert(locationRows);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user - validate inputs
    const { email, full_name, password, role, organization_id } = body;

    if (!email || !full_name || !password || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof email !== "string" || !EMAIL_REGEX.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof full_name !== "string" || full_name.trim().length === 0 || full_name.length > 100) {
      return new Response(JSON.stringify({ error: "Name must be 1-100 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return new Response(JSON.stringify({ error: "Password must be 8-128 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (organization_id && !UUID_REGEX.test(organization_id)) {
      return new Response(JSON.stringify({ error: "Invalid organization ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins can create managers
    if (role === "manager" && callerRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create managers" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user in auth
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: email,
        full_name: full_name.trim(),
        role,
      },
    });

    if (createError) {
      console.error("Create user error:", createError);
      const userMessage = createError.message?.includes("already been registered")
        ? "A user with this email already exists"
        : "Failed to create user";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with organization
    if (organization_id && newUser.user) {
      await adminClient
        .from("profiles")
        .update({ organization_id })
        .eq("user_id", newUser.user.id);
    }

    // For kiosk accounts, create the kiosk_accounts record
    if (role === "kiosk" && body.location_id && newUser.user) {
      // Set the role to kiosk (trigger defaults to worker, so we need to update)
      await adminClient
        .from("user_roles")
        .update({ role: "kiosk" })
        .eq("user_id", newUser.user.id);
      
      await adminClient.from("kiosk_accounts").insert({
        user_id: newUser.user.id,
        location_id: body.location_id,
        created_by: caller.id,
      });
    }

    // Assign locations if provided
    if (body.location_ids && Array.isArray(body.location_ids) && newUser.user) {
      const locationRows = body.location_ids
        .filter((id: string) => UUID_REGEX.test(id))
        .map((location_id: string) => ({ user_id: newUser.user!.id, location_id }));
      if (locationRows.length > 0) {
        await adminClient.from("user_locations").insert(locationRows);
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
