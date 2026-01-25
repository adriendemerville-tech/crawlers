import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ExpertAuditDashboard } from '@/components/ExpertAudit';

const ExpertAudit = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1" role="main" aria-label="Audit Expert SEO & IA">
        <ExpertAuditDashboard />
      </main>
      <Footer />
    </div>
  );
};

export default ExpertAudit;
