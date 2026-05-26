import { Link } from "react-router-dom";
import DevLayout from "./DevLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, CheckCircle2, CreditCard, HelpCircle, Wallet } from "lucide-react";

const STEPS = [
  { n: 1, t: "Créer son compte développeur", d: "Inscrivez-vous sur /developers/signup. Email + mot de passe suffisent, pas de carte demandée à cette étape." },
  { n: 2, t: "Générer une clé API", d: "Onglet Clés API → Générer une clé. Préfixe crw_live_, à copier une seule fois (non récupérable)." },
  { n: 3, t: "Recharger le wallet", d: "Onglet Facturation → choisir un montant (20 / 50 / 100 / 250 €) ou saisir un montant libre. Paiement sécurisé par Paddle (carte ou PayPal)." },
  { n: 4, t: "Lancer un premier job", d: "POST /v1/jobs avec { feature, input }. Le wallet est débité de 0,10 € à la création du job, atomiquement." },
  { n: 5, t: "Récupérer le résultat", d: "GET /v1/jobs/{id} jusqu'à status='completed' (ou 'failed'). Polling recommandé : 2 s puis 5 s puis 10 s." },
];

const FAQ = [
  {
    q: "Erreur 402 « insufficient_balance » : que faire ?",
    a: "Votre solde wallet est inférieur à 0,10 €. Aucun débit n'a eu lieu, le job a été automatiquement marqué failed. Rechargez sur l'onglet Facturation puis relancez la requête.",
  },
  {
    q: "Erreur 401 « invalid_api_key » alors que ma clé existe.",
    a: "Vérifiez : (1) le préfixe est bien crw_live_, (2) la clé n'a pas été révoquée dans l'onglet Clés API, (3) le header est Authorization: Bearer <clé> (ou x-crawlers-key: <clé>), sans espace parasite.",
  },
  {
    q: "Mon paiement Paddle a été débité mais le wallet n'est pas crédité.",
    a: "Le crédit est asynchrone via webhook Paddle (idempotent). Attendez 30 s puis rafraîchissez. Si après 5 minutes le solde n'a pas bougé, contactez dev@crawlers.fr avec votre identifiant de transaction Paddle (visible dans l'email de reçu).",
  },
  {
    q: "Puis-je obtenir un remboursement d'un job en échec ?",
    a: "Les jobs marqués failed pour cause de erreur serveur (500, timeout, feature en panne) sont recrédités automatiquement sous 24 h. Les jobs failed pour input invalide (400) ne sont pas remboursés — le crédit a déjà été consommé par la validation.",
  },
  {
    q: "Comment fonctionne le mode test vs production ?",
    a: "En preview (édition Lovable), les paiements sont en mode sandbox Paddle : aucun argent réel n'est prélevé, utilisez les cartes de test (4242 4242 4242 4242). Une fois publié, le mode live est automatiquement activé.",
  },
  {
    q: "Quels moyens de paiement sont acceptés ?",
    a: "Cartes Visa / Mastercard / Amex, PayPal, Apple Pay et Google Pay selon votre région. Le paiement par virement SEPA n'est pas disponible pour les top-ups wallet (montants trop faibles).",
  },
  {
    q: "Le wallet a-t-il une date d'expiration ?",
    a: "Non. Le crédit reste disponible sans limite de durée tant que votre compte est actif.",
  },
  {
    q: "Puis-je obtenir une facture pour ma comptabilité ?",
    a: "Chaque top-up génère automatiquement une facture Paddle (TVA incluse selon votre pays) envoyée par email. Historique disponible dans l'onglet Facturation → Transactions.",
  },
  {
    q: "Combien coûte exactement un appel API ?",
    a: "0,10 € HT par job, quel que soit le module appelé (audit_expert, geo_score, cocoon, etc.). Pas d'abonnement, pas de frais cachés.",
  },
  {
    q: "Que se passe-t-il si mon webhook ne répond pas ?",
    a: "Les webhooks ont un timeout de 10 s. En cas d'échec, le résultat reste consultable via GET /v1/jobs/{id}. Crawlers ne retente pas automatiquement les webhooks pour l'instant.",
  },
];

const ERRORS = [
  { code: "400", name: "invalid_json / missing_field / unknown_feature", action: "Corriger le payload. Pas de débit.", color: "text-foreground" },
  { code: "401", name: "missing_api_key / invalid_api_key", action: "Vérifier le header Authorization. Pas de débit.", color: "text-foreground" },
  { code: "402", name: "insufficient_balance", action: "Recharger le wallet. Pas de débit, job marqué failed.", color: "text-[hsl(280_70%_60%)]" },
  { code: "404", name: "job_not_found", action: "L'id du job n'existe pas ou n'appartient pas à votre clé.", color: "text-foreground" },
  { code: "409", name: "not_cancellable", action: "Le job est déjà terminé (completed/failed/cancelled).", color: "text-foreground" },
  { code: "429", name: "rate_limited", action: "Respecter Retry-After. Pas de débit sur les requêtes refusées.", color: "text-foreground" },
  { code: "500", name: "db_error / internal_error", action: "Erreur serveur — retry avec backoff exponentiel. Crédit remboursé sous 24 h si le job a été débité.", color: "text-foreground" },
];

export default function DevBillingHelp() {
  return (
    <DevLayout title="Aide facturation & wallet" description="FAQ et guide pas-à-pas pour la wallet pay-as-you-go Crawlers.">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Centre d'aide</p>
        <h1 className="text-3xl font-light tracking-tight mb-2">Wallet & paiement</h1>
        <p className="text-sm text-muted-foreground">
          Tout ce qu'il faut savoir sur le modèle pay-as-you-go, les rechargements Paddle et les erreurs fréquentes.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-4 mb-12">
        <Link to="/developers/profile?tab=facturation" className="border border-border rounded-lg p-4 hover:border-foreground transition-colors flex items-start gap-3">
          <Wallet className="h-4 w-4 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Recharger</div>
            <div className="text-xs text-muted-foreground">Onglet Facturation</div>
          </div>
        </Link>
        <Link to="/developers/profile?tab=cles-api" className="border border-border rounded-lg p-4 hover:border-foreground transition-colors flex items-start gap-3">
          <CreditCard className="h-4 w-4 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Mes clés API</div>
            <div className="text-xs text-muted-foreground">Créer / révoquer</div>
          </div>
        </Link>
        <Link to="/docs/api/crawlers" className="border border-border rounded-lg p-4 hover:border-foreground transition-colors flex items-start gap-3">
          <HelpCircle className="h-4 w-4 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Documentation API</div>
            <div className="text-xs text-muted-foreground">Endpoints & payloads</div>
          </div>
        </Link>
      </div>

      {/* Guide pas à pas */}
      <section className="mb-16">
        <h2 className="text-xl font-light mb-6 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> Guide pas-à-pas
        </h2>
        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="border border-border rounded-lg p-5 flex gap-4">
              <div className="font-mono text-2xl text-muted-foreground w-8 shrink-0">{String(s.n).padStart(2, "0")}</div>
              <div>
                <div className="font-medium mb-1">{s.t}</div>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Codes d'erreur */}
      <section className="mb-16">
        <h2 className="text-xl font-light mb-6 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Codes de retour POST /v1/jobs
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium w-20">HTTP</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">À faire</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e) => (
                <tr key={e.code + e.name} className="border-t border-border align-top">
                  <td className={`px-4 py-3 font-mono ${e.color}`}>{e.code}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-16">
        <h2 className="text-xl font-light mb-6 flex items-center gap-2">
          <HelpCircle className="h-5 w-5" /> Questions fréquentes
        </h2>
        <Accordion type="single" collapsible className="border border-border rounded-lg">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="px-5 last:border-b-0">
              <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Contact */}
      <section className="border-t border-border pt-8 text-center">
        <h3 className="font-light mb-2">Toujours bloqué ?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Notre équipe répond sous 24 h ouvrées.
        </p>
        <a
          href="mailto:dev@crawlers.fr?subject=Aide%20wallet%20%26%20facturation"
          className="inline-block px-5 py-2 border border-foreground rounded text-sm hover:bg-foreground hover:text-background transition-colors"
        >
          Contacter dev@crawlers.fr
        </a>
      </section>

      {/* JSON-LD FAQ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </DevLayout>
  );
}
