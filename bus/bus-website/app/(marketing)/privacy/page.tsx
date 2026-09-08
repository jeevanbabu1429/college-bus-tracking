import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import LegalLayout, { LegalSection } from '@/components/marketing/LegalLayout';
import { brand } from '@/lib/marketing/content';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How BusBee collects, uses and protects location and account data.',
};

const updated = '6 September 2026';

/** Plain bulleted list — the shape every section on this page uses. */
function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Mail() {
  return (
    <a
      href={`mailto:${brand.supportEmail}`}
      className="font-semibold text-coral-600 hover:underline"
    >
      {brand.supportEmail}
    </a>
  );
}

export default function Privacy() {
  return (
    <LegalLayout
      badgeIcon="lock"
      badge="Privacy Policy"
      title="Privacy Policy"
      updated={updated}
      showTemplateNotice={false}
    >
      <LegalSection id="introduction" title="1. Introduction">
        <p>
          {brand.name} is a live college bus tracking app used by colleges, their transport staff,
          drivers, and passengers. This Privacy Policy explains what information we collect when you
          use {brand.name}, how we use it, who we share it with, and the choices you have.
        </p>
        <p>
          The most important thing to know: <strong>we collect a driver’s location only during an
          active trip</strong> — from the moment the driver starts a trip to the moment they end it.
          We do not collect location in the background when no trip is running.
        </p>
        <p>By using {brand.name}, you agree to the practices described in this policy.</p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="2. Information We Collect">
        <List
          items={[
            <>
              <strong>Account details</strong> — name, mobile number, and email address, provided
              when a college account is created or when staff, drivers, and passengers are added to
              a college.
            </>,
            <>
              <strong>Login information</strong> — a one-time password (OTP) sent to your mobile
              number for admin, dispatcher, driver, and passenger sign-in; an email address and
              password for the platform owner’s console.
            </>,
            <>
              <strong>Location data</strong> — the GPS position reported by a driver’s device,
              collected only while a trip is active. See section 4.
            </>,
            <>
              <strong>Fleet configuration</strong> — buses, plate numbers, routes, stops,
              capacities, and driver and passenger assignments, entered by a college’s admin or
              dispatcher.
            </>,
            <>
              <strong>Driver records</strong> — licence number, date of birth, address, and an
              optional profile photo, entered by the college for its own fleet records.
            </>,
            <>
              <strong>Push notification tokens</strong> — an anonymous device token issued by your
              operating system when you allow notifications, used only to deliver alerts.
            </>,
            <>
              <strong>Device and log information</strong> — basic technical data such as app version
              and error logs, used to diagnose faults.
            </>,
          ]}
        />
        <p>
          We do not collect parent accounts, attendance records, transport fees, or emergency/SOS
          data. None of these features exist in {brand.name}.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" title="3. How We Use Your Information">
        <List
          items={[
            'Show the live position of a bus to the people authorised to see it while a trip is active',
            'Authenticate you at sign-in and keep your session secure',
            'Let admins and dispatchers manage buses, routes, stops, and assignments',
            'Enforce per-bus capacity and the one-driver-per-bus rule',
            'Send push notifications about trip status, route changes, suspended stops, and college announcements',
            'Point riders at the nearest active stop when their usual stop is suspended',
            'Produce the fleet reports a college downloads for its own records',
            'Verify a new college and its admin before the account is activated',
            'Diagnose faults, prevent misuse, and keep the service running',
            'Improve the app based on how its features are actually used',
          ]}
        />
      </LegalSection>

      <LegalSection id="location-data" title="4. Location Data">
        <p>
          Location is collected from the <strong>Driver role only</strong>. No location is collected
          from admins, dispatchers, or passengers.
        </p>
        <p>
          While a trip is active, the driver’s device reports its position roughly every 5 seconds
          while the bus is moving, and roughly every 10 minutes while it is idle. The moment the
          driver ends the trip, collection stops.
        </p>
        <p>
          Drivers are told this in the app before a trip begins, and a driver must start the trip
          themselves for sharing to begin. Ending the trip stops sharing immediately.
        </p>
        <p>
          A bus’s live position is visible only within its own college — to that college’s admin and
          dispatchers, and to the passengers assigned to its fleet. It is never shown publicly.
        </p>
      </LegalSection>

      <LegalSection id="information-sharing" title="5. Information Sharing">
        <p>We share information in the following situations, and no others:</p>
        <List
          items={[
            <>
              <strong>With your college</strong> — an admin and their dispatchers see the fleet data,
              driver records, and assignments belonging to their own college.
            </>,
            <>
              <strong>With users at your college</strong> — display name, bus number, route, and the
              live position of an active bus. Internal record identifiers are masked, so users never
              see raw database IDs or other users’ personal identifiers.
            </>,
            <>
              <strong>With map providers</strong> — OpenStreetMap and Google Maps Platform receive
              the map tile requests and coordinates needed to draw the map and place stops. See{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-coral-600 hover:underline"
              >
                Google’s Privacy Policy
              </a>
              .
            </>,
            <>
              <strong>With our notification provider</strong> — Firebase Cloud Messaging receives the
              device token and message content needed to deliver a push notification. See{' '}
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-coral-600 hover:underline"
              >
                Firebase Privacy Information
              </a>
              .
            </>,
            <>
              <strong>When required by law</strong> — where we are obliged to disclose information to
              a competent authority.
            </>,
          ]}
        />
        <p>
          <strong>We do not sell your information to third parties</strong>, and we do not share it
          for advertising.
        </p>
      </LegalSection>

      <LegalSection id="data-security" title="6. Data Security">
        <List
          items={[
            'Access is governed by role-based permissions, and every permission is enforced on our servers — not merely hidden in the interface.',
            'Each college’s data is isolated: an admin or dispatcher can only reach records belonging to their own college.',
            'Passwords are stored hashed, never in plain text. OTP codes are short-lived and single-use.',
            'Live location is visible only to authorised users, and only while a trip is active.',
          ]}
        />
        <p>
          No system can guarantee absolute security. If a breach affects your information, we will
          notify you in accordance with applicable law.
        </p>
      </LegalSection>

      <LegalSection id="account-verification" title="7. Account Verification">
        <p>
          A new college, and the admin who registers it, are reviewed before the account is
          activated. Until that review is complete the account can sign in but cannot manage a
          fleet. The details supplied for verification are used only to confirm the college is
          genuine, and are not shown to other colleges or users.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="8. Your Rights">
        <List
          items={[
            'Access the personal information we hold about you',
            'Correct anything that is inaccurate or out of date',
            'Request deletion of your account and its data (section 10)',
            'Object to, or ask us to restrict, certain processing',
            'Ask for a copy of the fleet data recorded against your college',
            'Turn off notification permission at any time in your device settings; location sharing stops whenever a driver ends a trip',
          ]}
        />
        <p>
          To exercise any of these rights, write to <Mail /> from the email address or mobile number
          registered on your account.
        </p>
      </LegalSection>

      <LegalSection id="data-retention" title="9. Data Retention">
        <List
          items={[
            'Live location is kept only for as long as it is operationally useful for the trip in progress. It is not retained as a long-term movement history.',
            'Account details are kept while the account is active.',
            'Fleet configuration is kept for as long as your college uses the service.',
            'After deletion we may keep a limited record where we are required to for legal, tax, or regulatory reasons.',
            'Aggregated, anonymous usage statistics that cannot identify you may be kept indefinitely.',
          ]}
        />
      </LegalSection>

      <LegalSection id="account-deletion" title="10. Account Deletion">
        <p>
          You can ask us to delete your account and the data associated with it at any time by
          emailing <Mail /> from your registered email address or mobile number. We complete
          deletion requests within 30 days and confirm by email.
        </p>
        <p>
          If your account was created for you by your college, we will tell the college that the
          account has been removed so it can update its fleet records. This request can also be
          started from inside the app.
        </p>
      </LegalSection>

      <LegalSection id="childrens-privacy" title="11. Children’s Privacy">
        <p>
          {brand.name} is intended for college transport operations. We do not knowingly collect
          information from children under 13. If you believe a child under 13 has provided us with
          information, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we revise the “Last
          updated” date at the top of this page, and material changes are announced in the app or by
          email. Please review this page periodically. Continuing to use {brand.name} after a change
          means you accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact Us">
        <p>If you have any questions about this policy or about your data, contact us:</p>
        <List
          items={[
            <>
              <strong>General support</strong> — <Mail /> or{' '}
              <a
                href={`tel:${brand.supportTel}`}
                className="font-semibold text-coral-600 hover:underline"
              >
                {brand.supportPhone}
              </a>
            </>,
            <>
              <strong>Privacy questions and data requests</strong> — <Mail />
            </>,
            <>
              <strong>Account deletion</strong> — <Mail />
            </>,
          ]}
        />
      </LegalSection>
    </LegalLayout>
  );
}
