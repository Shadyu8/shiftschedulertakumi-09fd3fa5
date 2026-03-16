import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get all location settings with their closing times and timezones
    const { data: locations, error: locErr } = await adminClient
      .from("locations")
      .select("id, timezone");

    if (locErr || !locations) {
      console.error("Failed to fetch locations:", locErr);
      return new Response(JSON.stringify({ error: "Failed to fetch locations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings, error: setErr } = await adminClient
      .from("location_settings")
      .select("location_id, latest_shift_end");

    if (setErr || !settings) {
      console.error("Failed to fetch location settings:", setErr);
      return new Response(JSON.stringify({ error: "Failed to fetch settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a map of location_id -> { latest_shift_end, timezone }
    const settingsMap = new Map<string, { latest_shift_end: string; timezone: string }>();
    for (const loc of locations) {
      const s = settings.find((st) => st.location_id === loc.id);
      if (s) {
        settingsMap.set(loc.id, {
          latest_shift_end: s.latest_shift_end,
          timezone: loc.timezone || "Europe/Amsterdam",
        });
      }
    }

    // Find all open punches (punch_out is null)
    const { data: openPunches, error: punchErr } = await adminClient
      .from("time_punches")
      .select("id, location_id, date, punch_in")
      .is("punch_out", null);

    if (punchErr) {
      console.error("Failed to fetch open punches:", punchErr);
      return new Response(JSON.stringify({ error: "Failed to fetch punches" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!openPunches || openPunches.length === 0) {
      return new Response(JSON.stringify({ message: "No open punches", closed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let closedCount = 0;
    const now = new Date();

    for (const punch of openPunches) {
      const locSettings = settingsMap.get(punch.location_id);
      if (!locSettings) continue;

      const { latest_shift_end, timezone } = locSettings;

      // Calculate the closing datetime for the punch date in the location's timezone
      // latest_shift_end is like "23:00", date is like "2026-03-16"
      const closingDateTimeStr = `${punch.date}T${latest_shift_end}:00`;

      // Convert closing time in location timezone to UTC for comparison
      // Use a simple approach: format now in the location's timezone and compare
      const nowInTz = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      const closingInTz = new Date(
        new Date(closingDateTimeStr).toLocaleString("en-US", { timeZone: timezone })
      );

      // Parse closing time directly as local time in that timezone
      const [closeH, closeM] = latest_shift_end.split(":").map(Number);
      const nowTzStr = now.toLocaleString("sv-SE", { timeZone: timezone }); // YYYY-MM-DD HH:MM:SS
      const nowTzDate = nowTzStr.split(" ")[0];
      const nowTzTime = nowTzStr.split(" ")[1];
      const [nowH, nowM] = nowTzTime.split(":").map(Number);

      // Check if the punch date is today or earlier, and current time has passed closing time
      const punchDate = punch.date; // YYYY-MM-DD
      const isPastDay = punchDate < nowTzDate;
      const isSameDay = punchDate === nowTzDate;
      const isPastClosing = isPastDay || (isSameDay && (nowH > closeH || (nowH === closeH && nowM >= closeM)));

      if (isPastClosing) {
        const { error: updateErr } = await adminClient
          .from("time_punches")
          .update({
            punch_out: latest_shift_end,
            notes: "Auto clock-out: forgot to clock out",
          })
          .eq("id", punch.id);

        if (updateErr) {
          console.error(`Failed to auto-close punch ${punch.id}:`, updateErr);
        } else {
          closedCount++;
          console.log(`Auto-closed punch ${punch.id} at ${latest_shift_end}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Auto clock-out complete`, closed: closedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
