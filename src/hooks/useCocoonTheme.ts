import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CocoonTheme {
  nodeColors: Record<string, string>;
  particleColors: Record<string, string>;
  haloColors: string[];
}

const DEFAULT_NODE_COLORS: Record<string, string> = {
  homepage: "#ffc83c",
  blog: "#8c78ff",
  produit: "#3cdca0",
  "catégorie": "#50aaff",
  faq: "#ff9650",
  contact: "#f078b4",
  tarifs: "#ffc83c",
  guide: "#b48cff",
  "légal": "#a0aab4",
  "à propos": "#50dce6",
  page: "#8c64fa",
  unknown: "#8c64fa",
};

const DEFAULT_PARTICLE_COLORS: Record<string, string> = {
  authority: "#ffc83c",
  semantic: "#508cff",
  traffic: "#3cdc8c",
  hierarchy: "#b464ff",
};

const DEFAULT_HALO_COLORS: string[] = [
  "#1e3a5f", // Sapphire blue
  "#0d4f4f", // Deep cyan
  "#5f3a1e", // Amber
  "#3a1e5f", // Violet
  "#1e5f3a", // Emerald
];

export const DEFAULT_THEME: CocoonTheme = {
  nodeColors: DEFAULT_NODE_COLORS,
  particleColors: DEFAULT_PARTICLE_COLORS,
  haloColors: DEFAULT_HALO_COLORS,
};

export function useCocoonTheme() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<CocoonTheme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTheme(DEFAULT_THEME);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      // First try: direct owner settings
      let { data } = await supabase
        .from("cocoon_theme_settings" as any)
        .select("node_colors, particle_colors")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      // If not found, check if user is a team member and load owner's settings
      if (!data) {
        const { data: membership } = await supabase
          .from("agency_team_members")
          .select("owner_user_id")
          .eq("member_user_id", user.id)
          .maybeSingle();

        if (membership?.owner_user_id) {
          const res = await supabase
            .from("cocoon_theme_settings" as any)
            .select("node_colors, particle_colors")
            .eq("owner_user_id", membership.owner_user_id)
            .maybeSingle();
          data = res.data;
        }
      }

      if (data) {
        const d = data as any;
        setTheme({
          nodeColors: { ...DEFAULT_NODE_COLORS, ...(d.node_colors as Record<string, string>) },
          particleColors: { ...DEFAULT_PARTICLE_COLORS, ...(d.particle_colors as Record<string, string>) },
          haloColors: Array.isArray(d.halo_colors) && d.halo_colors.length > 0 
            ? d.halo_colors 
            : DEFAULT_HALO_COLORS,
        });
      } else {
        setTheme(DEFAULT_THEME);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  return { theme, loading };
}
