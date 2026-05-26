# SAV — Wallet & Paiement API Crawlers

## Réponses types

### "Mon paiement n'apparaît pas dans mon solde"
1. Vérifier l'email Paddle utilisé au checkout = email du compte développeur.
2. Le webhook `payments-webhook` traite l'événement `transaction.completed` (généralement < 30 s).
3. Si toujours absent après 5 min : vérifier les logs de l'edge function `payments-webhook` côté admin. Le crédit est idempotent (rejouable via le dashboard Paddle).

### "J'ai reçu une erreur 402 Payment Required"
Le solde du wallet est inférieur à 10 centimes (coût d'un job).
→ Diriger vers `/developers/profile?tab=facturation` pour recharger (preset 20/50/100/250 € ou montant libre min 5 €).

### "Combien coûte un appel API ?"
**0,10 € par job**, quelle que soit la feature (geo_score, llm_visibility, etc.). Pas d'abonnement, pas d'engagement.

### "Puis-je obtenir un remboursement ?"
Oui, via le dashboard Paddle (admin) → Adjustments → Refund. Le crédit du wallet **n'est pas automatiquement débité** au refund — créer un ajustement manuel dans `dev_wallet_transactions` si nécessaire.

### "Quel mode de paiement est accepté ?"
Tous les moyens Paddle : CB, Apple Pay, Google Pay, PayPal, virement (selon pays).

### "Mode test vs production"
- Preview Lovable = sandbox Paddle (cartes de test, aucun débit réel).
- App publiée (crawlers.fr) = Paddle live (vraies transactions, KYC requis côté Paddle pour le merchant).

## Escalade

- Logs webhook : `supabase--edge_function_logs` sur `payments-webhook`.
- État solde utilisateur : `select * from dev_wallets where user_id = '...';`
- Historique : `select * from dev_wallet_transactions where user_id = '...' order by created_at desc limit 50;`
