import Container from './ui/Container';
import SectionHeading from './ui/SectionHeading';
import PhoneShot from './PhoneShot';

// The real mobile app, shown on the public pages. Screenshots live in
// /public/screens and are reused on both Home and How-it-works.
const shots = [
  {
    src: '/screens/role-login.jpg',
    title: 'Pick your role',
    desc: "Students, drivers and admins sign in with a one-time code — no passwords, no parent login.",
  },
  {
    src: '/screens/student-home.jpg',
    title: 'Your bus, live',
    desc: 'Riders see their assigned bus, its driver, and its position on the map the moment a trip starts.',
  },
  {
    src: '/screens/nearby-buses.jpg',
    title: 'Buses near you',
    desc: 'Find every college bus on a trip within 5 km and follow any one of them on the map.',
  },
];

export default function AppShowcase({
  id,
  className = 'bg-cream-100/50',
  eyebrow = 'In the app',
  title = 'See it in riders’ hands',
  subtitle = 'The mobile app your students and drivers use every day — live tracking, role-based login, and buses on the map.',
}: {
  id?: string;
  className?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <Container id={id} className={className}>
      <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {shots.map((s, i) => (
          <div
            key={s.src}
            className={`reveal reveal-delay-${(i % 3) + 1} flex flex-col items-center text-center`}
          >
            <PhoneShot src={s.src} alt={`${s.title} — BusBee app screen`} width={256} />
            <h3 className="mt-7 text-lg font-bold text-cream-900">{s.title}</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-cream-700">{s.desc}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}
