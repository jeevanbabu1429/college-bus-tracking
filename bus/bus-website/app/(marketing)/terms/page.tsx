import { AlertCircle, Ban } from 'lucide-react';
import LegalLayout, { LegalSection } from '@/components/marketing/LegalLayout';
import { brand } from '@/lib/marketing/content';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern use of BusBee by colleges, admins, dispatchers and drivers.',
};

const updated = '2 August 2026';

export default function Terms() {
  return (
    <LegalLayout badgeIcon="file" badge="Terms of Service" title="Terms of Service" updated={updated}>
      <LegalSection id="agreement" title="Agreement to terms">
        <p>
          These Terms of Service (“Terms”) govern your use of the <strong>{brand.name}</strong> app
          and web console (the “Service”), operated by <strong>[Company Legal Name]</strong> (“we”,
          “us”, “the operator”). By creating an account or using the Service, you agree to be bound
          by these Terms. If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="Eligibility">
        <p>
          {brand.name} is intended for use by college transport operations in India. You must be at
          least 18 years old or use the Service under the authorization of your college. By using
          the Service, you represent that you meet these requirements.
        </p>
      </LegalSection>

      <LegalSection id="accounts-roles" title="Accounts & roles">
        <p>The Service has four roles, each with a different login method and scope of access:</p>
        <ul className="space-y-2">
          {[
            ['Super Admin', 'Email + password console login. Manages admins and colleges, publishes app-wide banners.'],
            ['Admin', 'Email + password console login. Manages their college\'s buses, routes, drivers, and capacity.'],
            ['Dispatcher', 'Phone OTP app login. Monitors the live map, assigns drivers, edits routes, suspends stops.'],
            ['Driver', 'Phone OTP app login. Starts and ends trips and shares live location during an active trip.'],
          ].map(([role, desc]) => (
            <li key={role} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-400" />
              <span><strong className="text-cream-900">{role}:</strong> {desc}</span>
            </li>
          ))}
        </ul>
        <p>
          You are responsible for keeping your login credentials and OTP confidential. You must not
          share your account or OTP with anyone. Each bus is bound to exactly one active driver —
          shared driver accounts are not permitted.
        </p>
      </LegalSection>

      <LegalSection id="license" title="License to use the Service">
        <p>
          We grant you a limited, non-exclusive, non-transferable license to use {brand.name} for
          your college transport operations, subject to these Terms and the one-time activation fee.
          This license does not include the right to resell, sublicense, or modify the Service.
        </p>
      </LegalSection>

      <LegalSection id="fees" title="Fees & activation">
        <p>
          Use of the Service requires a one-time activation fee of <strong>{brand.price}</strong> ({brand.priceNote}).
          There are no per-bus or per-seat recurring charges for the features described in these
          Terms. The activation fee is non-refundable except where required by law.
        </p>
        <p>
          The features included are those described on our website and in the app. Specifically, the
          Service does <strong>not</strong> include parent login, attendance marking, fee collection,
          SOS/panic button, or ETA prediction.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="space-y-2">
          {[
            'Use the Service for any purpose other than college transport tracking',
            'Share your login, OTP, or account credentials with another person',
            'Assign more than one driver to a single bus, or exceed the set bus capacity',
            'Attempt to access data or features outside your role\'s permissions',
            'Use the driver location data to track or monitor any person outside of an active trip',
            'Reverse engineer, decompile, or otherwise attempt to extract source code',
            'Use the Service in a manner that could damage, disable, or overload it',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-coral-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="location-consent" title="Driver location consent">
        <p>
          The Driver role shares GPS location only during an active trip (from trip start to trip
          end). By using the Driver role and starting a trip, the driver consents to sharing their
          device’s location with authorized users of the Service for the duration of that trip.
          Location sharing stops when the trip ends. Drivers may end a trip at any time.
        </p>
        <p>
          Colleges using {brand.name} are responsible for informing their drivers of this location
          collection and obtaining any additional consent required under applicable labour or
          privacy law.
        </p>
      </LegalSection>

      <LegalSection id="third-parties" title="Third-party services">
        <p>
          The Service uses Google Maps Platform for map display and routing, and Firebase for push
          notifications and OTP authentication. We are not responsible for the privacy practices or
          content of these third-party services. Your use of those services is subject to their own
          terms and policies.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="Disclaimers">
        <p className="flex items-start gap-2.5 rounded-xl bg-cream-100 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <span>
            The Service is provided “as is” and “as available” without warranties of any kind, express
            or implied. We do not guarantee that location data will be accurate, complete, or
            uninterrupted. <strong>{brand.name} does not provide ETA predictions.</strong> You
            should not rely solely on the Service for safety-critical decisions.
          </span>
        </p>
        <p>
          The Service is not an emergency tool and does not include an SOS or panic feature.
          Emergencies should be handled through your existing emergency channels.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, <strong>[Company Legal Name]</strong> shall not be
          liable for any indirect, incidental, special, consequential, or punitive damages, or any
          loss of profits or revenues, arising from your use of (or inability to use) the Service,
          even if advised of the possibility of such damages.
        </p>
        <p>
          Our total liability for any claim arising from the Service shall not exceed the activation
          fee you paid.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="Indemnification">
        <p>
          You agree to indemnify and hold harmless <strong>[Company Legal Name]</strong>, its
          officers, and employees from any claim, damage, or expense arising from your misuse of the
          Service, your violation of these Terms, or your violation of any law or third-party right.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="Termination">
        <p>
          We may suspend or terminate your access to the Service if you violate these Terms or if
          your college ceases to use {brand.name}. You may stop using the Service at any time. Upon
          termination, your right to use the Service ends immediately. You may request deletion of
          your account data as described in our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection id="ip" title="Intellectual property">
        <p>
          The Service, including its design, features, and branding, is the property of{' '}
          <strong>[Company Legal Name]</strong> and is protected by intellectual property laws. Fleet
          configuration data you upload (buses, routes, stops) remains your college’s data.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="Governing law & disputes">
        <p>
          These Terms are governed by the laws of the Republic of India. Any dispute arising from
          these Terms or the Service shall be subject to the exclusive jurisdiction of the courts at{' '}
          <strong>[City], [State]</strong>, India.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we’ll revise the “Last updated”
          date at the top. Material changes will be notified through the app or by email. Continued
          use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <p>
          <strong>[Company Legal Name]</strong>
          <br />
          [Registered Address], [City], [State] [PIN], India
          <br />
          Email: <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-coral-600 hover:underline">{brand.supportEmail}</a>
          <br />
          Phone: {brand.supportPhone}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
