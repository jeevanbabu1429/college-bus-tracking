import { MapPin, BellRing, ShieldCheck, Eye, Trash2, Building2 } from 'lucide-react';
import LegalLayout, { LegalSection } from '@/components/marketing/LegalLayout';
import { brand } from '@/lib/marketing/content';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How BusBee collects, uses and protects location and account data.',
};

const updated = '2 August 2026';

export default function Privacy() {
  return (
    <LegalLayout badgeIcon="lock" badge="Privacy Policy" title="Privacy Policy" updated={updated}>
      <LegalSection id="overview" title="Overview">
        <p>
          This Privacy Policy explains how <strong>[Company Legal Name]</strong> (“we”, “us”, “the
          operator”) operates the <strong>{brand.name}</strong> app and how we collect, use, and
          protect information when you use the service. By using {brand.name}, you agree to the
          practices described here.
        </p>
        <p>
          {brand.name} is a live college bus tracking application. The most important thing to know:
          <strong> we collect driver location data only during an active trip</strong> — between the
          moment a driver starts a trip and the moment they end it. We do not collect background
          location when no trip is active.
        </p>
      </LegalSection>

      <LegalSection id="data-collected" title="Information we collect">
        <div className="overflow-hidden rounded-2xl border border-cream-300">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-cream-100 text-cream-700">
              <tr>
                <th className="px-4 py-3 font-bold">Data type</th>
                <th className="px-4 py-3 font-bold">Who provides it</th>
                <th className="px-4 py-3 font-bold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              <tr>
                <td className="px-4 py-3">
                  <span className="font-semibold text-cream-900">GPS location</span>
                  <br /><span className="text-cream-600">Approx. every 5s while moving, every 10m while idle</span>
                </td>
                <td className="px-4 py-3">Driver device</td>
                <td className="px-4 py-3 font-medium text-coral-600">During active trip only</td>
              </tr>
              <tr className="bg-cream-100/40">
                <td className="px-4 py-3">
                  <span className="font-semibold text-cream-900">Phone number</span>
                  <br /><span className="text-cream-600">For OTP login (dispatchers & drivers)</span>
                </td>
                <td className="px-4 py-3">Dispatcher / Driver</td>
                <td className="px-4 py-3">At login</td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="font-semibold text-cream-900">Email + password</span>
                  <br /><span className="text-cream-600">For console login (super admins & admins)</span>
                </td>
                <td className="px-4 py-3">Super Admin / Admin</td>
                <td className="px-4 py-3">At login</td>
              </tr>
              <tr className="bg-cream-100/40">
                <td className="px-4 py-3">
                  <span className="font-semibold text-cream-900">Fleet configuration</span>
                  <br /><span className="text-cream-600">Buses, routes, stops, assignments, capacities</span>
                </td>
                <td className="px-4 py-3">Admin / Dispatcher</td>
                <td className="px-4 py-3">During setup & operation</td>
              </tr>
              <tr>
                <td className="px-4 py-3">
                  <span className="font-semibold text-cream-900">Push notification tokens</span>
                </td>
                <td className="px-4 py-3">All app users</td>
                <td className="px-4 py-3">On enabling notifications</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>We do not collect:</strong> parent accounts (there are none), attendance records,
            transport fees, SOS/emergency data, or ETA prediction data. None of these features exist
            in {brand.name}.
          </span>
        </p>
      </LegalSection>

      <LegalSection id="location" title="Driver location — active trip only">
        <p className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-coral-500" />
          <span>
            Location data is collected <strong>only from the Driver role</strong>, and only while a
            trip is actively running (from “start trip” to “end trip”). No location is collected
            from dispatchers, admins, super admins, or passengers.
          </span>
        </p>
        <p>
          While a trip is active, the driver’s device reports its GPS position approximately every
          5 seconds when the bus is moving and approximately every 10 minutes when it is idle. When
          the driver ends the trip, location collection stops immediately.
        </p>
        <p>
          Drivers are informed of this in-app before they start a trip, and they must explicitly
          start the trip to begin sharing. They can end the trip at any time to stop sharing.
        </p>
      </LegalSection>

      <LegalSection id="masking" title="ID masking">
        <p className="flex items-start gap-2.5">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-lavender-500" />
          <span>
            Internal record identifiers (user IDs, driver IDs, bus IDs) are <strong>masked</strong>{' '}
            before being shown in the app. Passengers and drivers see display names and bus numbers,
            not raw database IDs or other users’ personal identifiers.
          </span>
        </p>
      </LegalSection>

      <LegalSection id="third-parties" title="Third-party services">
        <p>We rely on the following third-party services to operate {brand.name}:</p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3 rounded-xl bg-cream-100 p-4">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-coral-500" />
            <div>
              <p className="font-semibold text-cream-900">Google Maps Platform</p>
              <p className="text-cream-700">
                Used for map display, route visualization, and geocoding of stops. Google receives
                map tile requests and location coordinates needed to render the map. See{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-coral-600 hover:underline">
                  Google’s Privacy Policy
                </a>.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 rounded-xl bg-cream-100 p-4">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-lavender-500" />
            <div>
              <p className="font-semibold text-cream-900">Firebase (Cloud Messaging & Authentication)</p>
              <p className="text-cream-700">
                Used for push notification delivery and phone OTP authentication. Firebase receives
                notification tokens and phone numbers for OTP verification. See{' '}
                <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-coral-600 hover:underline">
                  Firebase Privacy Information
                </a>.
              </p>
            </div>
          </li>
        </ul>
        <p>
          We do not sell your data to any third party. We do not share your data for advertising
          purposes.
        </p>
      </LegalSection>

      <LegalSection id="use" title="How we use your data">
        <ul className="space-y-2">
          {[
            'To display live bus location to authorized users during an active trip',
            'To send push notifications about trip status, stop changes, and arrivals',
            'To authenticate users via OTP (phone) or email + password (console)',
            'To manage fleet configuration — buses, routes, stops, and assignments',
            'To enforce per-bus capacity and one-driver-per-bus rules',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral-400" />
              {item}
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="retention" title="Data retention">
        <p>
          Live location data is retained only for the duration of an active trip and is not stored
          long-term as a trackable history beyond what is needed for operational display. Fleet
          configuration data (buses, routes, stops) is retained as long as your college uses the
          service.
        </p>
        <p>
          Account data (phone numbers, email addresses) is retained while your account is active and
          deleted when you request account deletion (see below).
        </p>
      </LegalSection>

      <LegalSection id="deletion" title="Account deletion">
        <p className="flex items-start gap-2.5 rounded-xl bg-coral-50 p-4 ring-1 ring-coral-200">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-coral-600" />
          <span>
            You can request deletion of your account and associated data at any time by emailing{' '}
            <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-coral-600 hover:underline">
              {brand.supportEmail}
            </a>{' '}
            from your registered email or phone. We process deletion requests within 30 days and
            confirm completion by email. This route is reachable from the app and from this page.
          </span>
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Access to {brand.name} is governed by role-based permissions. Row-level security ensures
          users can only access data appropriate to their role. Passwords are hashed; OTP codes are
          short-lived. Location data is only visible to authorized roles during an active trip.
        </p>
        <p>
          No method of transmission or storage is 100% secure. If a data breach occurs, we will
          notify affected users in accordance with applicable law.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children's privacy">
        <p>
          {brand.name} is intended for use by college transport operations. Drivers and passengers
          are expected to be 18 or older, or to use the app under the supervision of their college.
          We do not knowingly collect data from children under 13. If you believe a child under 13
          has provided data, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="Your rights">
        <p>
          Depending on your jurisdiction, you may have the right to access, correct, or delete your
          personal data, and to object to or restrict certain processing. To exercise any of these
          rights, contact us at{' '}
          <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-coral-600 hover:underline">
            {brand.supportEmail}
          </a>.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we’ll revise the “Last
          updated” date at the top. Material changes will be notified through the app or by email.
          Continued use after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact us">
        <p>
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cream-500" />
            <strong>[Company Legal Name]</strong>
          </span>
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
