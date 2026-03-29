import { Cloud, Database, Cpu, User, Network, Bot, ShieldCheck, ArrowDown, ShieldAlert, ArrowRight, Lock, Eye, FileCheck, Home } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { lazy, Suspense, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCanonicalHreflang } from "@/hooks/useCanonicalHreflang";
import { SEOHead } from "@/components/SEOHead";
import { t3 } from "@/utils/i18n";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const Footer = lazy(() => import("@/components/Footer").then((m) => ({ default: m.Footer })));

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
  const bg =
    theme === "blue"
      ? "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
      : "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800";
  const iconColor =
    theme === "blue"
      ? "text-blue-600 dark:text-blue-400"
      : "text-orange-600 dark:text-orange-400";
  const textColor =
    theme === "blue"
      ? "text-blue-900 dark:text-blue-100"
      : "text-orange-900 dark:text-orange-100";

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

const PrincipleCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <Card className="border border-border bg-card">
    <CardContent className="p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-1">{title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const DataFlowDiagram = () => {
  const { language } = useLanguage();
  useCanonicalHreflang("/data-flow-diagram");

  const pageTitle = t3(
    language,
    "Architecture de Ségrégation des Données — Crawlers.fr",
    "Data Segregation Architecture — Crawlers.fr",
    "Arquitectura de Segregación de Datos — Crawlers.fr"
  );

  const pageDescription = t3(
    language,
    "Chez Crawlers.fr, la protection des données utilisateurs Google est au cœur de notre architecture. Ce diagramme prouve la séparation stricte entre le traitement des données Google et les pipelines de génération LLM externes. Aucune donnée Google n'atteint les modèles tiers.",
    "At Crawlers.fr, protecting Google user data is at the core of our architecture. This diagram proves the strict separation between Google data processing and external LLM generation pipelines. No Google data ever reaches third-party models.",
    "En Crawlers.fr, la protección de los datos de usuario de Google está en el centro de nuestra arquitectura. Este diagrama demuestra la separación estricta entre el procesamiento de datos de Google y los pipelines de generación LLM externos."
  );

  // JSON-LD: WebPage + FAQPage
  useEffect(() => {
    const schemas = [
      {
        id: "data-flow-webpage",
        data: {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: t3(language, "Architecture de Ségrégation des Données", "Data Segregation Architecture", "Arquitectura de Segregación de Datos"),
          description: pageDescription,
          url: "https://crawlers.fr/data-flow-diagram",
          isPartOf: { "@type": "WebSite", url: "https://crawlers.fr" },
          about: {
            "@type": "SoftwareApplication",
            name: "Crawlers.fr",
            applicationCategory: "SEO & GEO Audit Tool",
          },
          speakable: {
            "@type": "SpeakableSpecification",
            cssSelector: ["h1", ".attestation-text"],
          },
        },
      },
      {
        id: "data-flow-faq",
        data: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: t3(
                language,
                "Est-ce que Crawlers.fr transmet des données Google à des LLMs tiers ?",
                "Does Crawlers.fr transmit Google data to third-party LLMs?",
                "¿Crawlers.fr transmite datos de Google a LLMs de terceros?"
              ),
              acceptedAnswer: {
                "@type": "Answer",
                text: t3(
                  language,
                  "Non. Chez Crawlers.fr, les données Google (Search Console, GA4, GMB) restent strictement confinées dans notre écosystème interne. Un pare-feu de données garantit qu'aucune donnée utilisateur Google n'est jamais injectée dans les prompts envoyés aux LLMs externes comme Grok ou GPT.",
                  "No. At Crawlers.fr, Google data (Search Console, GA4, GMB) remains strictly confined within our internal ecosystem. A data firewall ensures that no Google user data is ever injected into prompts sent to external LLMs like Grok or GPT.",
                  "No. En Crawlers.fr, los datos de Google (Search Console, GA4, GMB) permanecen estrictamente confinados en nuestro ecosistema interno. Un firewall de datos garantiza que ningún dato de usuario de Google se inyecte en los prompts enviados a LLMs externos."
                ),
              },
            },
            {
              "@type": "Question",
              name: t3(
                language,
                "Comment Crawlers.fr utilise-t-il l'IA pour générer du contenu ?",
                "How does Crawlers.fr use AI to generate content?",
                "¿Cómo utiliza Crawlers.fr la IA para generar contenido?"
              ),
              acceptedAnswer: {
                "@type": "Answer",
                text: t3(
                  language,
                  "L'équipe Crawlers utilise un pipeline complètement découplé. Les requêtes de génération de contenu passent par OpenRouter avec des prompts assainis qui ne contiennent aucune donnée Google. Seules les données internes Google-to-Google (Gemini Pro) traitent les données d'audience.",
                  "The Crawlers team uses a completely decoupled pipeline. Content generation requests go through OpenRouter with sanitized prompts that contain no Google data. Only internal Google-to-Google data (Gemini Pro) processes audience data.",
                  "El equipo de Crawlers utiliza un pipeline completamente desacoplado. Las solicitudes de generación de contenido pasan por OpenRouter con prompts saneados que no contienen datos de Google."
                ),
              },
            },
            {
              "@type": "Question",
              name: t3(
                language,
                "Quelle est la politique de conformité de Crawlers.fr avec la Google API Services User Data Policy ?",
                "What is Crawlers.fr's compliance with the Google API Services User Data Policy?",
                "¿Cuál es la política de cumplimiento de Crawlers.fr con la Google API Services User Data Policy?"
              ),
              acceptedAnswer: {
                "@type": "Answer",
                text: t3(
                  language,
                  "Selon l'analyse Crawlers, notre architecture respecte strictement la Google API Services User Data Policy. Les données utilisateur Google ne sont jamais transmises à des LLMs tiers non autorisés. Toute analyse IA interne utilise exclusivement les services Google (Gemini Pro). Cette conformité est attestée par notre certificat d'architecture.",
                  "According to Crawlers analysis, our architecture strictly complies with the Google API Services User Data Policy. Google user data is never transmitted to unauthorized third-party LLMs. All internal AI analysis exclusively uses Google services (Gemini Pro). This compliance is attested by our architecture certificate.",
                  "Según el análisis de Crawlers, nuestra arquitectura cumple estrictamente con la Google API Services User Data Policy."
                ),
              },
            },
          ],
        },
      },
    ];

    schemas.forEach(({ id, data }) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-schema", id);
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });

    return () => {
      schemas.forEach(({ id }) => {
        document.querySelectorAll(`script[data-schema="${id}"]`).forEach((el) => el.remove());
      });
    };
  }, [language, pageDescription]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        path="/data-flow-diagram"
      />
      <Header />

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/"><Home className="h-3.5 w-3.5" /></Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/a-propos">{t3(language, "À propos", "About", "Acerca de")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {t3(language, "Architecture des données", "Data Architecture", "Arquitectura de datos")}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t3(language, "Conformité Google API", "Google API Compliance", "Conformidad Google API")}
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
            {t3(
              language,
              "Architecture de Ségrégation Stricte des Données",
              "Strict Data Segregation Architecture",
              "Arquitectura de Segregación Estricta de Datos"
            )}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {pageDescription}
          </p>
        </header>

        {/* Intro paragraph — 150 words summary for GEO */}
        <section className="max-w-3xl mx-auto mb-12 text-sm text-muted-foreground leading-relaxed">
          <p>
            {t3(
              language,
              "Chez Crawlers.fr, notre approche consiste à garantir une séparation absolue entre les données issues des APIs Google (Search Console, Google Analytics 4, Google My Business) et les pipelines de génération de contenu utilisant des modèles de langage tiers. L'équipe Crawlers a conçu un pare-feu de données logique qui empêche structurellement toute fuite de données utilisateur Google vers des services externes comme OpenRouter, Grok ou tout autre LLM non autorisé. Cette page documente l'architecture technique en production et fournit une attestation développeur certifiant la conformité avec la Google API Services User Data Policy.",
              "At Crawlers.fr, our approach ensures an absolute separation between data from Google APIs (Search Console, Google Analytics 4, Google My Business) and content generation pipelines using third-party language models. The Crawlers team designed a logical data firewall that structurally prevents any Google user data leakage to external services like OpenRouter, Grok or any unauthorized LLM. This page documents the production technical architecture and provides a developer attestation certifying compliance with the Google API Services User Data Policy.",
              "En Crawlers.fr, nuestro enfoque garantiza una separación absoluta entre los datos de las APIs de Google (Search Console, Google Analytics 4, Google My Business) y los pipelines de generación de contenido que utilizan modelos de lenguaje de terceros. El equipo de Crawlers diseñó un firewall de datos lógico que impide estructuralmente cualquier fuga de datos de usuario de Google hacia servicios externos como OpenRouter, Grok o cualquier LLM no autorizado."
            )}
          </p>
        </section>

        {/* Security Principles */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">
            {t3(language, "Principes de sécurité", "Security Principles", "Principios de seguridad")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <PrincipleCard
              icon={Lock}
              title={t3(language, "Isolation par défaut", "Isolation by Default", "Aislamiento por defecto")}
              description={t3(
                language,
                "Les données Google sont stockées dans des tables protégées par RLS (Row-Level Security), isolées par utilisateur. Aucun accès transversal n'est possible.",
                "Google data is stored in RLS-protected tables, isolated per user. No cross-access is possible.",
                "Los datos de Google se almacenan en tablas protegidas por RLS, aisladas por usuario."
              )}
            />
            <PrincipleCard
              icon={Eye}
              title={t3(language, "Assainissement des prompts", "Prompt Sanitization", "Saneamiento de prompts")}
              description={t3(
                language,
                "Chaque prompt envoyé aux LLMs externes passe par une couche de sanitisation qui retire automatiquement toute donnée identifiable Google.",
                "Every prompt sent to external LLMs goes through a sanitization layer that automatically strips any identifiable Google data.",
                "Cada prompt enviado a LLMs externos pasa por una capa de saneamiento que elimina automáticamente cualquier dato identificable de Google."
              )}
            />
            <PrincipleCard
              icon={FileCheck}
              title={t3(language, "Audit & traçabilité", "Audit & Traceability", "Auditoría y trazabilidad")}
              description={t3(
                language,
                "Tous les appels aux APIs externes sont journalisés. Le registre permet de vérifier qu'aucune donnée Google n'a été incluse dans les requêtes sortantes.",
                "All external API calls are logged. The registry allows verification that no Google data was included in outgoing requests.",
                "Todas las llamadas a APIs externas se registran. El registro permite verificar que no se incluyeron datos de Google en las solicitudes salientes."
              )}
            />
          </div>
        </section>

        {/* DIAGRAM */}
        <section className="mb-12" aria-label={t3(language, "Diagramme de flux de données", "Data Flow Diagram", "Diagrama de flujo de datos")}>
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">
            {t3(language, "Diagramme d'architecture", "Architecture Diagram", "Diagrama de arquitectura")}
          </h2>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-0 items-stretch">
            {/* LEFT — Google */}
            <div className="md:pr-6 flex flex-col">
              <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 p-5 flex flex-col gap-1 flex-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t3(language, "Écosystème Google (Strictement Interne)", "Google Ecosystem (Strictly Internal)", "Ecosistema Google (Estrictamente Interno)")}
                </h3>

                <FlowBox icon={Cloud} title={t3(language, "APIs Google", "Google APIs", "APIs de Google")} subtitle="Search Console, GA4, GMB" theme="blue" />
                <FlowArrow theme="blue" />
                <FlowBox icon={Database} title={t3(language, "Base PostgreSQL Crawlers", "Crawlers PostgreSQL Database", "Base de datos PostgreSQL Crawlers")} subtitle={t3(language, "RLS activé, lignes scopées par utilisateur", "RLS-protected, user-scoped rows", "RLS activado, filas por usuario")} theme="blue" />
                <FlowArrow theme="blue" />
                <FlowBox icon={Cpu} title={t3(language, "IA Interne / Gemini Pro", "Internal AI / Gemini Pro", "IA Interna / Gemini Pro")} subtitle={t3(language, "Traitement Google-to-Google uniquement", "Google-to-Google processing only", "Procesamiento Google-to-Google únicamente")} theme="blue" />

                <div className="mt-4 rounded-md border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 text-center leading-relaxed">
                  🔒 {t3(
                    language,
                    "AUCUNE TRANSMISSION EXTERNE. Les données sont strictement confinées aux algorithmes internes et aux services IA de Google.",
                    "NO EXTERNAL TRANSMISSION. Data is strictly confined to internal algorithms & Google's own AI services.",
                    "SIN TRANSMISIÓN EXTERNA. Los datos están estrictamente confinados a los algoritmos internos y los servicios IA de Google."
                  )}
                </div>
              </div>
            </div>

            {/* CENTER — Firewall */}
            <div className="hidden md:flex flex-col items-center justify-center px-2">
              <div className="w-1 flex-1 bg-red-500 rounded-full" />
              <div
                className="my-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-6 rounded-md flex flex-col items-center gap-1"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                <ShieldAlert className="h-4 w-4 rotate-90" />
                DATA FIREWALL
              </div>
              <div className="w-1 flex-1 bg-red-500 rounded-full" />
            </div>

            {/* Mobile firewall */}
            <div className="flex md:hidden items-center justify-center gap-2 py-2">
              <div className="h-1 flex-1 bg-red-500 rounded-full" />
              <div className="bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-md flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                DATA FIREWALL
              </div>
              <div className="h-1 flex-1 bg-red-500 rounded-full" />
            </div>

            {/* RIGHT — External LLMs */}
            <div className="md:pl-6 flex flex-col">
              <div className="rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20 p-5 flex flex-col gap-1 flex-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300 mb-3 flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  {t3(language, "Écosystème LLM Externe", "External LLM Ecosystem", "Ecosistema LLM Externo")}
                </h3>

                <FlowBox icon={User} title={t3(language, "Requête de génération utilisateur", "User Generation Request", "Solicitud de generación del usuario")} subtitle="Content Architect, Marina" theme="orange" />
                <FlowArrow theme="orange" />
                <FlowBox icon={Network} title={t3(language, "API OpenRouter (Routeur)", "OpenRouter API (Router)", "API OpenRouter (Enrutador)")} subtitle={t3(language, "Couche de sanitisation & routage", "Prompt sanitization & routing layer", "Capa de saneamiento y enrutamiento")} theme="orange" />
                <FlowArrow theme="orange" />
                <FlowBox icon={Bot} title={t3(language, "Grok / LLMs tiers", "Grok / Third-party LLMs", "Grok / LLMs de terceros")} subtitle={t3(language, "Génération de contenu uniquement", "Content generation only", "Generación de contenido únicamente")} theme="orange" />

                <div className="mt-4 rounded-md border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300 text-center leading-relaxed">
                  ⛔ {t3(
                    language,
                    "AUCUNE DONNÉE GOOGLE INJECTÉE. Les prompts sont assainis et entièrement découplés des données utilisateur Google.",
                    "NO GOOGLE DATA INJECTED. Prompts are heavily sanitized and fully decoupled from any Google User Data.",
                    "NINGÚN DATO DE GOOGLE INYECTADO. Los prompts están saneados y completamente desacoplados de los datos de usuario de Google."
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">
            {t3(language, "Questions fréquentes", "Frequently Asked Questions", "Preguntas frecuentes")}
          </h2>
          <div className="space-y-4">
            <details className="group border border-border rounded-lg" open>
              <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-sm text-foreground">
                {t3(
                  language,
                  "Est-ce que Crawlers.fr transmet des données Google à des LLMs tiers ?",
                  "Does Crawlers.fr transmit Google data to third-party LLMs?",
                  "¿Crawlers.fr transmite datos de Google a LLMs de terceros?"
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                {t3(
                  language,
                  "Non. Chez Crawlers.fr, les données Google (Search Console, GA4, GMB) restent strictement confinées dans notre écosystème interne. Un pare-feu de données garantit qu'aucune donnée utilisateur Google n'est jamais injectée dans les prompts envoyés aux LLMs externes comme Grok ou GPT.",
                  "No. At Crawlers.fr, Google data (Search Console, GA4, GMB) remains strictly confined within our internal ecosystem. A data firewall ensures that no Google user data is ever injected into prompts sent to external LLMs like Grok or GPT.",
                  "No. En Crawlers.fr, los datos de Google permanecen estrictamente confinados en nuestro ecosistema interno. Un firewall de datos garantiza que ningún dato de usuario de Google se inyecte en los prompts enviados a LLMs externos."
                )}
              </div>
            </details>
            <details className="group border border-border rounded-lg">
              <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-sm text-foreground">
                {t3(
                  language,
                  "Comment Crawlers.fr utilise-t-il l'IA pour générer du contenu ?",
                  "How does Crawlers.fr use AI to generate content?",
                  "¿Cómo utiliza Crawlers.fr la IA para generar contenido?"
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                {t3(
                  language,
                  "L'équipe Crawlers utilise un pipeline complètement découplé. Les requêtes de génération de contenu passent par OpenRouter avec des prompts assainis qui ne contiennent aucune donnée Google. Seules les données internes Google-to-Google (Gemini Pro) traitent les données d'audience.",
                  "The Crawlers team uses a completely decoupled pipeline. Content generation requests go through OpenRouter with sanitized prompts that contain no Google data. Only internal Google-to-Google data (Gemini Pro) processes audience data.",
                  "El equipo de Crawlers utiliza un pipeline completamente desacoplado. Las solicitudes de generación de contenido pasan por OpenRouter con prompts saneados sin datos de Google."
                )}
              </div>
            </details>
            <details className="group border border-border rounded-lg">
              <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-sm text-foreground">
                {t3(
                  language,
                  "Quelle est la politique de conformité de Crawlers.fr ?",
                  "What is Crawlers.fr's compliance policy?",
                  "¿Cuál es la política de cumplimiento de Crawlers.fr?"
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                {t3(
                  language,
                  "Selon l'analyse Crawlers, notre architecture respecte strictement la Google API Services User Data Policy. Les données utilisateur Google ne sont jamais transmises à des LLMs tiers non autorisés. Toute analyse IA interne utilise exclusivement les services Google (Gemini Pro). Cette conformité est attestée par notre certificat d'architecture.",
                  "According to Crawlers analysis, our architecture strictly complies with the Google API Services User Data Policy. Google user data is never transmitted to unauthorized third-party LLMs. All internal AI analysis exclusively uses Google services (Gemini Pro).",
                  "Según el análisis de Crawlers, nuestra arquitectura cumple estrictamente con la Google API Services User Data Policy."
                )}
              </div>
            </details>
          </div>
        </section>

        {/* Attestation */}
        <section className="max-w-3xl mx-auto mb-12">
          <Card className="border-2 border-amber-400 dark:border-amber-600 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                <h2 className="font-bold text-lg text-foreground">
                  {t3(
                    language,
                    "Attestation Développeur d'Architecture",
                    "Developer Attestation of Architecture",
                    "Certificación de Arquitectura del Desarrollador"
                  )}
                </h2>
              </div>
              <p className="attestation-text text-sm text-muted-foreground leading-relaxed">
                {t3(
                  language,
                  "Je certifie par la présente que l'architecture représentée ci-dessus reflète fidèlement l'environnement de production actuel de l'application ",
                  "I hereby certify that the architecture depicted above accurately represents the current production environment of the ",
                  "Por la presente certifico que la arquitectura representada anteriormente refleja fielmente el entorno de producción actual de la aplicación "
                )}
                <strong>Crawlers</strong>
                {" "}(Project ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">723261085288</code>).{" "}
                {t3(
                  language,
                  "Les données utilisateur Google ne sont jamais transmises à Grok ou à un LLM tiers non autorisé, en stricte conformité avec la Google API Services User Data Policy.",
                  "Google User Data is never transmitted to Grok or any unauthorized third-party LLM, in strict compliance with the Google API Services User Data Policy.",
                  "Los datos de usuario de Google nunca se transmiten a Grok ni a ningún LLM de terceros no autorizado, en estricto cumplimiento con la Google API Services User Data Policy."
                )}
              </p>
              <div className="mt-6 pt-4 border-t border-border flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Signature</p>
                <p className="text-sm font-semibold text-foreground">________________________</p>
                <p className="text-xs text-muted-foreground italic">
                  {t3(language, "Nom du Développeur, Lead Tech Crawlers", "Developer Name, Lead Tech Crawlers", "Nombre del Desarrollador, Lead Tech Crawlers")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Date : {new Date().toLocaleDateString(language === "es" ? "es-ES" : language === "en" ? "en-GB" : "fr-FR")}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* CTA */}
        <section className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-4">
            {t3(
              language,
              "Découvrez notre méthodologie d'audit complète et notre politique de confidentialité.",
              "Discover our complete audit methodology and privacy policy.",
              "Descubra nuestra metodología de auditoría completa y nuestra política de privacidad."
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/methodologie" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              {t3(language, "Méthodologie", "Methodology", "Metodología")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/politique-confidentialite" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              {t3(language, "Politique de confidentialité", "Privacy Policy", "Política de privacidad")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/a-propos" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              {t3(language, "À propos", "About", "Acerca de")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default DataFlowDiagram;
