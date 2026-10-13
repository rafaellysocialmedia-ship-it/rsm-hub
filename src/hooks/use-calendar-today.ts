import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { zonedCalendarDate } from "@/lib/calendar-period";
export function useCalendarToday() {
  const zone = useQuery({
    queryKey: ["calendar-timezone"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calendar_timezone");
      if (error) throw error;
      return data;
    },
  });
  const timezone = zone.data ?? "America/Fortaleza";
  const [today, setToday] = useState(() => zonedCalendarDate(new Date(), timezone));
  useEffect(() => {
    const update = () => setToday(zonedCalendarDate(new Date(), timezone));
    update();
    const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [timezone]);
  return { today, zone };
}
