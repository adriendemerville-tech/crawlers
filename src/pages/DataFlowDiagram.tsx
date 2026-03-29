import { Cloud, Database, Cpu, User, Network, Bot, ShieldCheck, ArrowDown, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const FlowBox = ({
  icon: Icon,
  title,
  subtitle,
  theme,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  theme: "blue" | "orange";
}) => {
  const bg = theme === "blue"
    ? "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
    : "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800";
  const iconColor = theme === "blue" ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400";
  const textColor = theme === "blue" ? "text-blue-900 dark:text-blue-100" : "text-orange-900 dark:text-orange-100";

  return (
    <div className={`rounded-lg border-2 p-4 flex items-center gap-3 ${bg}`}>
      <Icon className={`h-8 w-8 shrink-0 ${iconColor}`} />
      <div>
        <p className={`font-semibold text-sm leading-tight ${textColor}`}>{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
};

const FlowArrow = ({ theme }: { theme: "blue" | "orange" }) => (
  <div className="flex justify-center py-1">
    <ArrowDown className={`h-6 w-6 ${theme === "blue" ? "text-blue-400" : "text-orange-400"}`} />
  </div>
);

const DataFlowDiagram = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 print:p-4">
    {/* Header */}
    <div className="text-center mb-10">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Crawlers Architecture&nbsp;: Strict Data Segregation
      </h1>
      <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
        This diagram proves the complete separation between Google User Data processing and external LLM generation pipelines. No Google data ever reaches third-party language models.
      </p>
    </div>

    {/* Main diagram */}
    <div className="max-w-5xl mx-auto grid grid-cols-[1fr_auto_1fr] gap-0 items-stretch">
      {/* LEFT — Google */}
      <div className="pr-6 flex flex-col">
        <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 p-5 flex flex-col gap-1 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Google Ecosystem (Strictly Internal)
          </h2>

          <FlowBox icon={Cloud} title="Google APIs" subtitle="Search Console, GA4, GMB" theme="blue" />
          <FlowArrow theme="blue" />
          <FlowBox icon={Database} title="Crawlers PostgreSQL Database" subtitle="RLS-protected, user-scoped rows" theme="blue" />
          <FlowArrow theme="blue" />
          <FlowBox icon={Cpu} title="Internal AI / Gemini Pro" subtitle="Google-to-Google processing only" theme="blue" />

          <div className="mt-4 rounded-md border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 text-center leading-relaxed">
            🔒 NO EXTERNAL TRANSMISSION.<br />
            Data is strictly confined to internal algorithms &amp; Google's own AI services.
          </div>
        </div>
      </div>

      {/* CENTER — Firewall */}
      <div className="flex flex-col items-center justify-center px-2">
        <div className="w-1 flex-1 bg-red-500 rounded-full" />
        <div className="my-3 -rotate-0 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-6 rounded-md flex flex-col items-center gap-1 writing-vertical"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
          <ShieldAlert className="h-4 w-4 rotate-90" />
          DATA FIREWALL
        </div>
        <div className="w-1 flex-1 bg-red-500 rounded-full" />
      </div>

      {/* RIGHT — External LLMs */}
      <div className="pl-6 flex flex-col">
        <div className="rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20 p-5 flex flex-col gap-1 flex-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300 mb-3 flex items-center gap-2">
            <Network className="h-4 w-4" /> External LLM Ecosystem
          </h2>

          <FlowBox icon={User} title="User Generation Request" subtitle="Content Architect, Marina briefs" theme="orange" />
          <FlowArrow theme="orange" />
          <FlowBox icon={Network} title="OpenRouter API (Router)" subtitle="Prompt sanitization & routing layer" theme="orange" />
          <FlowArrow theme="orange" />
          <FlowBox icon={Bot} title="Grok / Third-party LLMs" subtitle="Content generation only" theme="orange" />

          <div className="mt-4 rounded-md border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300 text-center leading-relaxed">
            ⛔ NO GOOGLE DATA INJECTED.<br />
            Prompts are heavily sanitized and fully decoupled from any Google User Data.
          </div>
        </div>
      </div>
    </div>

    {/* Attestation */}
    <Card className="max-w-3xl mx-auto mt-12 border-2 border-amber-400 dark:border-amber-600 shadow-lg">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Developer Attestation of Architecture</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          I hereby certify that the architecture depicted above accurately represents the current production environment
          of the <strong>Crawlers</strong> application (Project&nbsp;ID:&nbsp;<code className="text-xs bg-muted px-1 py-0.5 rounded">723261085288</code>).
          Google User Data is <strong>never</strong> transmitted to Grok or any unauthorized third-party LLM,
          in strict compliance with the <em>Google API Services User Data Policy</em>.
        </p>
        <div className="mt-6 pt-4 border-t border-border flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Signature</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">________________________</p>
          <p className="text-xs text-muted-foreground italic">Nom du Développeur, Lead Tech Crawlers</p>
          <p className="text-xs text-muted-foreground">Date&nbsp;: {new Date().toLocaleDateString("fr-FR")}</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default DataFlowDiagram;
