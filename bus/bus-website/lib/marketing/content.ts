import type { LucideIcon } from 'lucide-react';
import {
  Smartphone,
  MapPinned,
  ShieldAlert,
  Users,
  Route,
  Ban,
  Gauge,
  UserCog,
  FileSpreadsheet,
  BellRing,
  Map,
  Eye,
} from 'lucide-react';
import {
  SUPPORT_EMAIL,
  SUPPORT_MOBILE_DISPLAY,
  SUPPORT_TEL,
} from '@/components/SupportContact';

export type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: 'coral' | 'lavender' | 'emerald';
};

export const features: Feature[] = [
  {
    icon: Smartphone,
    title: 'OTP login',
    desc: 'Phone-number login with a one-time password. No passwords to remember, no shared accounts — every user is a real, verified person.',
    accent: 'coral',
  },
  {
    icon: MapPinned,
    title: 'Live tracking',
    desc: 'Buses report their position roughly every 5 seconds while moving and every 10 minutes while idle, so everyone sees near-real-time location on the map.',
    accent: 'coral',
  },
  {
    icon: Map,
    title: 'Admin all-fleet live map',
    desc: 'A single live map showing every bus in the fleet at once — admins and dispatchers see the whole operation, not just one vehicle.',
    accent: 'lavender',
  },
  {
    icon: Eye,
    title: 'Track another bus',
    desc: 'Passengers and staff can look up any bus by number and follow it live, not just the one they are assigned to.',
    accent: 'lavender',
  },
  {
    icon: Route,
    title: 'Route & stop builder',
    desc: 'Build routes stop-by-stop with an interactive map. Reorder stops, set pickup windows, and publish a route in minutes.',
    accent: 'coral',
  },
  {
    icon: Ban,
    title: 'Stop suspension with fallback',
    desc: 'Suspend a stop for a day and the app automatically points affected riders to the nearest active stop — no manual calls.',
    accent: 'emerald',
  },
  {
    icon: Gauge,
    title: 'Capacity enforcement',
    desc: 'Each bus has a set capacity. The app prevents over-assignment so drivers do not leave stops with more riders than seats.',
    accent: 'emerald',
  },
  {
    icon: UserCog,
    title: 'One driver per bus',
    desc: 'Every bus is bound to exactly one active driver. No double-assignments, no ambiguity about who is behind the wheel.',
    accent: 'lavender',
  },
  {
    icon: FileSpreadsheet,
    title: 'XLSX bulk import',
    desc: 'Upload routes, stops, buses, and driver assignments in a spreadsheet. Set up an entire semester in one import.',
    accent: 'coral',
  },
  {
    icon: BellRing,
    title: 'Six push-notification triggers',
    desc: 'From trip start to the one-stop-before "arriving soon" alert, riders get the right nudge at exactly the right moment.',
    accent: 'lavender',
  },
];

export const nonFeatures: { title: string; desc: string }[] = [
  {
    title: 'No parent login',
    desc: 'Parents do not get their own account. Anyone who needs to track a bus uses the same passenger app.',
  },
  {
    title: 'No attendance marking',
    desc: 'BusTrack is about location, not roll call. Boarding attendance is out of scope.',
  },
  {
    title: 'No fee collection',
    desc: 'Transport fees are handled elsewhere. The only payment here is a one-time activation.',
  },
  {
    title: 'No SOS / panic button',
    desc: 'There is no emergency alert feature. Emergencies should go through your existing channels.',
  },
  {
    title: 'No ETA predictions',
    desc: 'You see where the bus is right now, on the route. We do not guess an arrival time.',
  },
];

export type Notification = {
  trigger: string;
  audience: string;
  desc: string;
  icon: LucideIcon;
};

export const notifications: Notification[] = [
  {
    trigger: 'Trip started',
    audience: 'Assigned passengers',
    desc: 'When the driver starts the trip, assigned riders get a push that their bus has begun the route.',
    icon: Smartphone,
  },
  {
    trigger: 'Arriving soon',
    audience: 'Passengers at the next stop',
    desc: 'One stop before a rider\'s stop, they get an "arriving soon" nudge so they can head to the pickup point.',
    icon: BellRing,
  },
  {
    trigger: 'Stop skipped',
    audience: 'Affected passengers',
    desc: 'If a stop is suspended or skipped, affected riders are notified immediately with the nearest active alternative.',
    icon: Ban,
  },
  {
    trigger: 'Trip ended',
    audience: 'Assigned passengers',
    desc: 'When the driver ends the trip, riders get a confirmation that the run is complete.',
    icon: MapPinned,
  },
  {
    trigger: 'Route / stop changes',
    audience: 'Assigned passengers',
    desc: 'When a dispatcher edits a route or suspends a stop, assigned riders are notified of the change.',
    icon: Route,
  },
  {
    trigger: 'Bus reassigned',
    audience: 'Assigned passengers',
    desc: 'If a bus is swapped onto a route, affected riders are notified so nobody waits for the wrong vehicle.',
    icon: Users,
  },
];

export type RoleCapability = {
  label: string;
  superAdmin: boolean;
  admin: boolean;
  dispatcher: boolean;
  driver: boolean;
};

export const roleCapabilities: RoleCapability[] = [
  { label: 'Email + password console login', superAdmin: true, admin: false, dispatcher: false, driver: false },
  { label: 'Mobile OTP login (console or app)', superAdmin: false, admin: true, dispatcher: true, driver: true },
  { label: 'Manage admins & colleges', superAdmin: true, admin: false, dispatcher: false, driver: false },
  { label: 'Publish app-wide banner', superAdmin: true, admin: false, dispatcher: false, driver: false },
  { label: 'Manage college buses, routes, drivers', superAdmin: false, admin: true, dispatcher: false, driver: false },
  { label: 'XLSX bulk import', superAdmin: false, admin: true, dispatcher: false, driver: false },
  { label: 'Set bus capacity', superAdmin: false, admin: true, dispatcher: false, driver: false },
  { label: 'View all-fleet live map', superAdmin: false, admin: true, dispatcher: true, driver: false },
  { label: 'Assign driver to bus (one driver per bus)', superAdmin: false, admin: true, dispatcher: true, driver: false },
  { label: 'Build & edit routes and stops', superAdmin: false, admin: true, dispatcher: true, driver: false },
  { label: 'Suspend stops (nearest-active fallback)', superAdmin: false, admin: true, dispatcher: true, driver: false },
  { label: 'Start / end trip & share location', superAdmin: false, admin: false, dispatcher: false, driver: true },
  { label: 'Track any bus by number', superAdmin: false, admin: true, dispatcher: true, driver: true },
];

export type Role = {
  key: string;
  name: string;
  tagline: string;
  login: string;
  icon: LucideIcon;
  accent: 'coral' | 'lavender' | 'emerald' | 'amber';
  blurb: string;
  responsibilities: string[];
};

export const roles: Role[] = [
  {
    key: 'super-admin',
    name: 'Super Admin',
    tagline: 'The platform owner',
    login: 'Email + password console',
    icon: ShieldAlert,
    accent: 'amber',
    blurb:
      'Runs the whole platform. Manages which colleges are onboard and which admins represent them, and can push an app-wide banner to every user.',
    responsibilities: [
      'Create and manage admin accounts for each college',
      'Onboard or remove colleges from the platform',
      'Publish an app-wide announcement banner',
      'Console-only access (email + password)',
    ],
  },
  {
    key: 'admin',
    name: 'Admin',
    tagline: 'The college transport head',
    login: 'Mobile OTP on the web console',
    icon: UserCog,
    accent: 'coral',
    blurb:
      'Owns their college\'s entire fleet. Sets up buses, routes, and drivers, imports a semester in one spreadsheet, and sets capacity limits.',
    responsibilities: [
      'Add and manage buses and drivers',
      'Build routes and stops on the map',
      'Bulk-import routes, stops & assignments via XLSX',
      'Set per-bus capacity and one-driver-per-bus rule',
    ],
  },
  {
    key: 'dispatcher',
    name: 'Dispatcher',
    tagline: 'The day-to-day operator',
    login: 'Phone OTP in the app',
    icon: Map,
    accent: 'lavender',
    blurb:
      'Keeps the fleet moving in real time. Watches the all-fleet live map, assigns drivers to buses, and suspends stops when something changes on the ground.',
    responsibilities: [
      'Monitor the all-fleet live map',
      'Assign a driver to each bus',
      'Edit routes and suspend stops on the fly',
      'Notify riders of route or bus changes',
    ],
  },
  {
    key: 'driver',
    name: 'Driver',
    tagline: 'The one behind the wheel',
    login: 'Phone OTP in the app',
    icon: Users,
    accent: 'emerald',
    blurb:
      'The only role that shares location. Starts the trip, drives the route, and ends the trip — the app shares their position only while a trip is active.',
    responsibilities: [
      'Start and end an active trip',
      'Share live location during the trip only',
      'See the assigned route and stops',
      'One driver per bus — no double assignments',
    ],
  },
];

export type FAQ = { q: string; a: string };

export const faqs: FAQ[] = [
  {
    q: 'Do parents need their own login?',
    a: 'No. There is no separate parent account. Anyone who needs to track a bus — including parents — uses the passenger side of the app.',
  },
  {
    q: 'Does the app predict an arrival time (ETA)?',
    a: 'No. BusTrack shows you where the bus is right now on its route. We intentionally do not estimate an arrival time, because traffic makes those guesses unreliable.',
  },
  {
    q: 'How often is the bus location updated?',
    a: 'About every 5 seconds while the bus is moving, and about every 10 minutes while it is idle. Location is only shared while a trip is actively running.',
  },
  {
    q: 'When is a driver\'s location collected?',
    a: 'Only during an active trip — between the driver starting and ending the run. No background location is collected when no trip is active.',
  },
  {
    q: 'What happens if a stop is suspended for the day?',
    a: 'The dispatcher or admin suspends the stop, and the app automatically points affected riders to the nearest active stop on the route. No phone calls needed.',
  },
  {
    q: 'How much does it cost?',
    a: 'A one-time activation fee of ₹90. There are no per-seat or per-bus recurring charges for the features listed here.',
  },
  {
    q: 'Can a bus have more than one driver?',
    a: 'No. Each bus is bound to exactly one active driver at a time, so there is never ambiguity about who is driving.',
  },
  {
    q: 'Can passengers track any bus, or only their assigned one?',
    a: 'Both. Passengers can follow their assigned bus and also look up any other bus by its number to track it live.',
  },
];

export type Step = {
  num: string;
  title: string;
  desc: string;
  icon: LucideIcon;
};

export const setupSteps: Step[] = [
  {
    num: '01',
    title: 'Super Admin onboards the college',
    desc: 'The platform owner creates an admin account for the college and brings it onto BusTrack.',
    icon: ShieldAlert,
  },
  {
    num: '02',
    title: 'Admin sets up the fleet',
    desc: 'Add buses, set capacity, and assign one driver per bus — or import the whole semester from an XLSX spreadsheet.',
    icon: UserCog,
  },
  {
    num: '03',
    title: 'Build routes & stops',
    desc: 'Lay out each route stop-by-stop on the map, set pickup windows, and publish. Routes can be edited any time.',
    icon: Route,
  },
  {
    num: '04',
    title: 'Dispatcher runs the day',
    desc: 'On the all-fleet live map, the dispatcher assigns drivers to buses and suspends stops if something changes.',
    icon: Map,
  },
  {
    num: '05',
    title: 'Driver starts the trip',
    desc: 'The driver taps "start trip" and the app begins sharing live location — only for the duration of the run.',
    icon: Smartphone,
  },
  {
    num: '06',
    title: 'Passengers get notified',
    desc: 'Riders get a trip-started alert, an "arriving soon" nudge one stop before theirs, and a trip-ended confirmation.',
    icon: BellRing,
  },
];

// Support details come from the same module the admin console uses, so the
// marketing site and the login screens can never drift apart.
export const brand = {
  name: 'BusTrack',
  supportEmail: SUPPORT_EMAIL,
  supportPhone: SUPPORT_MOBILE_DISPLAY,
  supportTel: SUPPORT_TEL,
  price: '₹90',
  priceNote: 'one-time activation',
};
