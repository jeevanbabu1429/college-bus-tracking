import type { Metadata } from "next";
import HowItWorksContent from "./HowItWorksContent";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "From onboarding a college to a driver starting a trip — the six steps that get live bus tracking running on your campus.",
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
