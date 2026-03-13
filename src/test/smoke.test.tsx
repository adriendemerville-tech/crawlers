import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/", search: "" }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  NavLink: ({ children, to }: any) => <a href={to}>{children}</a>,
  BrowserRouter: ({ children }: any) => <>{children}</>,
  Routes: ({ children }: any) => <>{children}</>,
  Route: () => null,
}));

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn(),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null }),
    },
  },
}));

// Mock LanguageContext
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr", setLanguage: vi.fn(), t: {} }),
  LanguageProvider: ({ children }: any) => <>{children}</>,
}));

// ─── Smoke tests: critical components render without crashing ───

describe("Smoke Tests — Critical Components", () => {
  it("ScoreGauge200 renders with score", async () => {
    const { ScoreGauge200 } = await import("@/components/ExpertAudit/ScoreGauge200");
    render(<ScoreGauge200 score={142} />);
    expect(screen.getByText("142")).toBeInTheDocument();
  });

  it("CategoryCard renders title and score", async () => {
    const { CategoryCard } = await import("@/components/ExpertAudit/CategoryCard");
    render(
      <CategoryCard icon={<span>⚡</span>} title="Performance" score={32} maxScore={40} variant="performance">
        <div>child</div>
      </CategoryCard>
    );
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText(/32/)).toBeInTheDocument();
  });

  it("LoadingSteps renders site name", async () => {
    const { LoadingSteps } = await import("@/components/ExpertAudit/LoadingSteps");
    const ref = { current: null };
    render(<LoadingSteps siteName="example.com" variant="technical" onStopMusicRef={ref} />);
    expect(screen.getByText(/example\.com/i)).toBeInTheDocument();
  });

  it("WorkflowCarousel renders URL input", async () => {
    const { WorkflowCarousel } = await import("@/components/ExpertAudit/WorkflowCarousel");
    render(
      <WorkflowCarousel
        currentStep={1}
        completedSteps={[]}
        url=""
        onUrlChange={vi.fn()}
        onStartTechnical={vi.fn()}
        onStartStrategic={vi.fn()}
        onStartPayment={vi.fn()}
        isLoading={false}
        isStrategicLoading={false}
        hasTechnicalResult={false}
        hasStrategicResult={false}
        onNavigateToTechnical={vi.fn()}
        onNavigateToStrategic={vi.fn()}
      />
    );
    // Should have an input for the URL
    const input = document.querySelector("input");
    expect(input).toBeInTheDocument();
  });

  it("StepperProgress renders steps", async () => {
    const { StepperProgress } = await import("@/components/ExpertAudit/StepperProgress");
    render(<StepperProgress currentStep={2} />);
    // Should render step indicators
    expect(document.querySelectorAll("[class]").length).toBeGreaterThan(0);
  });

  it("FAQSection renders questions", async () => {
    const { ExpertAuditFAQ } = await import("@/components/ExpertAudit/ExpertAuditFAQ");
    render(<ExpertAuditFAQ />);
    // Should render at least one FAQ question
    const buttons = document.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
