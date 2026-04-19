import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { Hero } from "@/components/landing/hero";
import { FlowSection } from "@/components/landing/flow-section";
import { GraphSection } from "@/components/landing/graph-section";
import { ApiFirstSection } from "@/components/landing/api-first-section";
import { AgentScaleSection } from "@/components/landing/agent-scale-section";
import { BusinessCaseSection } from "@/components/landing/business-case-section";
import { CtaFooter } from "@/components/landing/cta-footer";

export const metadata: Metadata = {
  title: "asktiberius — API-first reply drafting, grounded in your graph",
  description:
    "One knowledge graph for sales, support, and every chat-based team. Hybrid retrieval, editable chunks, multi-signal confidence. API-first, MCP-next.",
};

export default function Home() {
  return (
    <div className="dark relative min-h-svh overflow-x-hidden bg-background text-foreground">
      <LandingNav />
      <main>
        <Hero />
        <FlowSection />
        <GraphSection />
        <ApiFirstSection />
        <AgentScaleSection />
        <BusinessCaseSection />
        <CtaFooter />
      </main>
    </div>
  );
}
