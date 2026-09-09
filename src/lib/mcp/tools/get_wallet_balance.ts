import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { err, ok, euros } from "../billing";

export default defineTool({
  name: "get_wallet_balance",
  title: "Solde du wallet",
  description:
    "Retourne le solde du wallet développeur (en micro-crédits et en euros), la consommation MCP du jour et le plafond journalier.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return err("Non authentifié.");
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const [{ data: wallet }, { data: usage }, { data: limit }, { data: settings }] = await Promise.all([
      supabase.from("dev_wallets").select("balance_micro, currency, updated_at").eq("user_id", userId).maybeSingle(),
      supabase.from("mcp_daily_usage").select("spent_micro, calls").eq("user_id", userId).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle(),
      supabase.from("mcp_user_limits").select("daily_cap_micro").eq("user_id", userId).maybeSingle(),
      supabase.from("mcp_billing_settings").select("default_daily_cap_micro").maybeSingle(),
    ]);

    const balanceMicro = Number((wallet as any)?.balance_micro ?? 0);
    const spentMicro = Number((usage as any)?.spent_micro ?? 0);
    const capMicro = Number((limit as any)?.daily_cap_micro ?? (settings as any)?.default_daily_cap_micro ?? 0);

    const payload = {
      balance_micro: balanceMicro,
      balance_eur: balanceMicro / 1000,
      currency: (wallet as any)?.currency ?? "EUR",
      today_spent_micro: spentMicro,
      today_calls: Number((usage as any)?.calls ?? 0),
      daily_cap_micro: capMicro,
      topup_url: "/developers/profile?tab=facturation",
    };

    return ok(
      `Solde ${euros(balanceMicro)} · consommé aujourd'hui ${euros(spentMicro)} sur un plafond de ${euros(capMicro)}.`,
      payload,
    );
  },
});
