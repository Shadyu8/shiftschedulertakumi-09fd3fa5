import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["admin", "manager", "shiftleader", "worker", "kiosk", "fulltimer"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_PFPS = [
  "/pfps/spikenaruto.png",
  "/pfps/spikesaikik.png",
  "/pfps/spikegoku.png",
  "/pfps/spikejotaro.png",
  "/pfps/spikeluffy.png",
];

function getRandomPfp(): string {
  return DEFAULT_PFPS[Math.floor(Math.random() * DEFAULT_PFPS.length)];
}

async function replaceUserRole(adminClient: any, userId: string, role: string) {
  const { error: deleteError } = await adminClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(`Failed to clear existing roles: ${deleteError.message}`);
  }

  const { error: insertError } = await adminClient
    .from("user_roles")
    .insert({ user_id: userId, role });

  if (insertError) {
    throw new Error(`Failed to assign role: ${insertError.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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
      console.error("Auth error:", authError, "Caller:", caller);
      return new Response(JSON.stringify({ error: "Invalid token", detail: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Caller ID:", caller.id);

    const { data: callerRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    console.log("Caller role query result:", callerRole, "Error:", roleError);

    if (!callerRole || !["admin", "manager"].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Forbidden", debug: { callerRole, roleError: roleError?.message } }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch caller's organization for tenant isolation
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", caller.id)
      .single();
    const callerOrgId = callerProfile?.organization_id;

    const body = await req.json();

    // Delete user action
    if (body.action === "delete") {
      if (!body.user_id || !UUID_REGEX.test(body.user_id)) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (body.user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Tenant isolation: managers can only delete users in their own org
      if (callerRole.role !== "admin") {
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("organization_id")
          .eq("user_id", body.user_id)
          .single();
        if (!targetProfile || targetProfile.organization_id !== callerOrgId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
      // Tenant isolation: managers can only update users in their own org
      if (callerRole.role !== "admin") {
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("organization_id")
          .eq("user_id", body.user_id)
          .single();
        if (!targetProfile || targetProfile.organization_id !== callerOrgId) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

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
      if (body.phone !== undefined) {
        profileUpdates.phone = body.phone;
      }
      if (body.staff_type !== undefined) {
        profileUpdates.staff_type = body.staff_type;
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

      if (body.role) {
        if (!VALID_ROLES.includes(body.role)) {
          return new Response(JSON.stringify({ error: "Invalid role" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (body.role === "manager" && callerRole.role !== "admin") {
          return new Response(JSON.stringify({ error: "Only admins can promote to manager" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (body.role === "admin" && callerRole.role !== "admin") {
          return new Response(JSON.stringify({ error: "Only admins can promote to admin" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        try {
          await replaceUserRole(adminClient, body.user_id, body.role);
        } catch (roleError: any) {
          console.error("Update role error:", roleError);
          return new Response(JSON.stringify({ error: "Failed to update role" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (body.password && typeof body.password === "string" && body.password.trim().length > 0) {
        if (body.password.length < 8 || body.password.length > 128) {
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

      if (body.location_ids && Array.isArray(body.location_ids)) {
        await adminClient.from("user_locations").delete().eq("user_id", body.user_id);
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

    // Create user
    const { full_name, password, role, phone } = body;
    const username = body.username || body.email;
    // Tenant isolation: managers must create users in their own org
    const organization_id = callerRole.role === "admin" ? (body.organization_id || callerOrgId) : callerOrgId;

    if (!full_name || !password || !role || !username) {
      return new Response(JSON.stringify({ error: "Missing required fields (full_name, username or email, password, role)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof username !== "string" || username.trim().length === 0 || username.length > 100) {
      return new Response(JSON.stringify({ error: "Username must be 1-100 characters" }), {
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

    if (role === "manager" && callerRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create managers" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a placeholder email from username since Supabase Auth requires one
    const email = body.email || `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}@internal.noemail`;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username.trim(),
        full_name: full_name.trim(),
        role,
      },
    });

    if (createError) {
      console.error("Create user error:", createError);
      const userMessage = createError.message?.includes("already been registered")
        ? "A user with this username already exists"
        : "Failed to create user";
      return new Response(JSON.stringify({ error: userMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with organization, phone, staff_type, username override, and random pfp
    if (newUser.user) {
      const profileUpdates: Record<string, any> = {
        username: username.trim(),
        profile_picture: getRandomPfp(),
      };
      if (organization_id) profileUpdates.organization_id = organization_id;
      if (phone) profileUpdates.phone = phone;
      if (body.staff_type) profileUpdates.staff_type = body.staff_type;
      await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", newUser.user.id);
    }

    // Force exactly one role row so the user never stays on the default worker role
    if (newUser.user) {
      try {
        await replaceUserRole(adminClient, newUser.user.id, role);
      } catch (roleError: any) {
        console.error("Create user role sync error:", roleError);
        await adminClient.auth.admin.deleteUser(newUser.user.id);

        return new Response(JSON.stringify({ error: "Failed to assign requested role" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For kiosk accounts, also create the kiosk_accounts record
    if (role === "kiosk" && body.location_id && newUser.user) {
      await adminClient.from("kiosk_accounts").insert({
        user_id: newUser.user.id,
        location_id: body.location_id,
        created_by: caller.id,
      });
    }

    // Assign locations
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
