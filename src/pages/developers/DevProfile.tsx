import { useSearchParams, Link } from "react-router-dom";
import DevLayout from "./DevLayout";
import SettingsTab from "./tabs/SettingsTab";
import ApiKeysTab from "./tabs/ApiKeysTab";
import UsageTab from "./tabs/UsageTab";
import BillingTab from "./tabs/BillingTab";
import WebhooksTab from "./tabs/WebhooksTab";

const TABS = [
  { id: "cles-api", label: "Clés API" },
  { id: "consommation", label: "Consommation" },
  { id: "webhooks", label: "Webhooks" },
  { id: "facturation", label: "Facturation" },
  { id: "parametres", label: "Paramètres" },
];

export default function DevProfile() {
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "cles-api";

  return (
    <DevLayout requireAuth title="Profil">
      <div className="mb-8">
        <h1 className="text-3xl font-light tracking-tight">Profil</h1>
      </div>

      <div className="flex gap-1 border-b border-border mb-8 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setParams({ tab: t.id })}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "cles-api" && <ApiKeysTab />}
      {active === "consommation" && <UsageTab />}
      {active === "webhooks" && <WebhooksTab />}
      {active === "facturation" && <BillingTab />}
      {active === "parametres" && <SettingsTab />}
    </DevLayout>
  );
}
