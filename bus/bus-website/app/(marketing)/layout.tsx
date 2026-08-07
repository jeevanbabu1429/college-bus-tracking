import type { Metadata } from "next";
import Header from "@/components/marketing/Header";
import Footer from "@/components/marketing/Footer";
// Tailwind lives here. Every rule it emits is scoped to `.mkt` below, so it
// cannot reach the admin console styled by app/globals.css.
import "../marketing.css";

export const metadata: Metadata = {
  title: {
    default: "BusTrack — Live College Bus Tracking",
    template: "%s · BusTrack",
  },
  description:
    "Live college bus tracking for admins, dispatchers, drivers, and passengers. OTP login, real-time tracking, route & stop management, push notifications, and more.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mkt">
      <div className="flex min-h-screen flex-col bg-cream-200">
        <Header />
        <main className="flex-1 pt-16 lg:pt-18">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
