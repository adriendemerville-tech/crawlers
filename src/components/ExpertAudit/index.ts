// Re-exports for lazy loading - each component should be imported directly
// to avoid bundling all components together

// Main dashboard (heavy) - prefer direct import with React.lazy
export { ExpertAuditDashboard } from './ExpertAuditDashboard';

// Lighter components that may be needed elsewhere
export { ScoreGauge200 } from './ScoreGauge200';
export { CategoryCard, MetricRow } from './CategoryCard';
export { RecommendationList } from './RecommendationList'; // Legacy
export { ActionPlan, ActionPlanCard, ActionPlanProgress, ActionPlanSaveButton } from './ActionPlan';
export { LoadingSteps } from './LoadingSteps';
export { StrategicInsights } from './StrategicInsights';
export { ExpertAuditFAQ } from './ExpertAuditFAQ';
export { ExpertAuditContent } from './ExpertAuditContent';
export { IntroductionCard } from './IntroductionCard';
export { ExpertInsightsCard } from './ExpertInsightsCard';
export { InsightEducationalPanel } from './InsightEducationalPanel';
export { GeoScoreVisualization } from './GeoScoreVisualization';
export { StrategicRoadmapCard } from './StrategicRoadmapCard';
export { BrandIdentityCard } from './BrandIdentityCard';
export { EmailGateCard } from './EmailGateCard';
export { StepperProgress } from './StepperProgress';
export { RegistrationGate } from './RegistrationGate';
export { ReportAuthGate } from './ReportAuthGate';
export { PaymentModal } from './PaymentModal';
export { WorkflowCarousel } from './WorkflowCarousel';
export { CorrectiveCodeEditor } from './CorrectiveCodeEditor';
export { HallucinationCorrectionModal } from './HallucinationCorrectionModal';

export type { HallucinationAnalysis } from './HallucinationCorrectionModal';
