import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Shield, Eye, Trash2, Clock, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PrivacyGoogleAds() {
  return (
    <>
      <Helmet>
        <title>Politique de confidentialité — Google Ads | Crawlers.fr</title>
        <meta name="description" content="Comment Crawlers.fr utilise vos données Google Ads : accès en lecture seule, durée de rétention, révocation instantanée." />
        <link rel="canonical" href="https://crawlers.lovable.app/privacy-google-ads" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Politique de confidentialité — Google Ads</h1>
            <p className="text-muted-foreground mt-2">Dernière mise à jour : 3 avril 2026</p>
          </div>

          {/* Scope */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Données collectées</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Le module <strong>SEA → SEO Bridge</strong> de Crawlers.fr accède à votre compte Google Ads
                exclusivement en <strong>lecture seule</strong> pour récupérer :
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Les mots-clés actifs et leurs volumes de recherche</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Les coûts par clic (CPC) et dépenses par campagne</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Les impressions, clics et conversions</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Les noms de campagnes (pour le croisement SEA/SEO)</li>
              </ul>
            </CardContent>
          </Card>

          {/* What we DON'T do */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Shield className="h-5 w-5 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold">Ce que nous ne faisons jamais</h2>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span>Modifier, créer ou supprimer des campagnes</li>
                <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span>Ajuster des enchères ou des budgets</li>
                <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span>Accéder à vos informations de facturation</li>
                <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span>Partager vos données avec des tiers</li>
                <li className="flex items-start gap-2"><span className="text-destructive mt-0.5">✕</span>Utiliser vos données à des fins publicitaires</li>
              </ul>
            </CardContent>
          </Card>

          {/* Scope technique */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold">Scope technique & sécurité</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                L'API Google Ads ne propose pas de scope en lecture seule. Nous utilisons le scope{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://www.googleapis.com/auth/adwords</code>{' '}
                imposé par Google. Cependant :
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Notre code backend n'appelle que des méthodes de <strong>lecture</strong> (<code className="text-xs bg-muted px-1 rounded">searchStream</code>)</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Aucune fonction de mutation (create, update, remove) n'est implémentée</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>Les tokens sont chiffrés au repos et transmis uniquement via HTTPS</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>L'identité de l'utilisateur est validée côté serveur (JWT)</li>
              </ul>
            </CardContent>
          </Card>

          {/* Retention */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-semibold">Durée de conservation</h2>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><strong>Tokens OAuth :</strong> conservés tant que la connexion est active. Supprimés immédiatement à la déconnexion.</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><strong>Données de mots-clés :</strong> conservées 90 jours pour le suivi des tendances SEA/SEO, puis supprimées automatiquement.</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><strong>Résultats d'analyse :</strong> conservés dans le workbench tant que l'utilisateur ne les supprime pas.</li>
              </ul>
            </CardContent>
          </Card>

          {/* Revocation */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold">Révocation de l'accès</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vous pouvez révoquer l'accès à tout moment via :
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">1.</span><strong>Crawlers.fr :</strong> Console → onglet SEA→SEO → bouton « Déconnecter Google Ads », ou Console → onglet API → carte Google Ads → « Déconnecter »</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">2.</span><strong>Google :</strong> <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary underline">myaccount.google.com/permissions</a></li>
              </ul>
              <p className="text-sm text-muted-foreground leading-relaxed">
                À la déconnexion, nous révoquons le token auprès de Google et supprimons toutes les données stockées.
              </p>
            </CardContent>
          </Card>

          {/* Contact */}
          <div className="text-center text-xs text-muted-foreground/60 pb-8">
            <p>Pour toute question, contactez-nous : contact@crawlers.fr</p>
            <p className="mt-1">Crawlers.fr — SAS enregistrée en France</p>
          </div>
        </div>
      </div>
    </>
  );
}
