import { Github, Mail, Linkedin } from 'lucide-react';
import { Card, FadeIn } from '../ui';

interface TeamMember {
  name: string;
  role: string;
  year: string;
  college: string;
  location: string;
  email: string;
  image: string;
}

const TEAM: TeamMember[] = [
  {
    name: 'Rohan Singh',
    role: 'Backend + Deployment',
    year: '4th Year, B.Tech',
    college: 'Rajiv Gandhi Institute of Petroleum Technology',
    location: 'Amethi, Uttar Pradesh, India',
    email: 'rohan.singh200402@gmail.com',
    image: '/team/rohan.jpg',
  },
  {
    name: 'Anuj Kumar Yadav',
    role: 'Backend + Frontend',
    year: '3rd Year, B.Tech',
    college: 'Netaji Subhas University of Technology',
    location: 'Dwarka, India',
    email: 'anuj.yadav.ug24@nsut.ac.in',
    image: '/team/anuj.jpg',
  },
  {
    name: 'Baibhav Kundu',
    role: 'Data Scraping & Processing, Documentation',
    year: '3rd Year, B.Tech',
    college: 'Netaji Subhas University of Technology',
    location: 'Dwarka, India',
    email: 'baibhav.kundu.ug24@nsut.ac.in',
    image: '/team/baibhav.jpg',
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <FadeIn>
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-dark mb-3">
            About Us
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            We're a team of students building the intent-capture layer for quick commerce.
            Built during <strong className="text-dark">HackOn with Amazon</strong> (48-hour build).
          </p>
        </div>
      </FadeIn>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TEAM.map((member, i) => (
          <FadeIn key={member.name} delay={i * 100}>
            <Card padding="lg" className="text-center h-full flex flex-col items-center">
              {/* Photo */}
              <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-primary-light">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=e8f5e9&color=2e7d32&size=128`;
                  }}
                />
              </div>

              {/* Info */}
              <h3 className="font-heading font-bold text-xl text-dark mb-1">
                {member.name}
              </h3>
              <span className="inline-block px-3 py-1 rounded-full bg-primary-light text-primary-ink text-xs font-semibold mb-3">
                {member.role}
              </span>
              <p className="text-sm text-muted mb-1">{member.year}</p>
              <p className="text-sm text-dark font-medium mb-1">{member.college}</p>
              <p className="text-xs text-muted mb-4">{member.location}</p>

              {/* Links */}
              <div className="mt-auto flex items-center gap-3">
                <a
                  href={`mailto:${member.email}`}
                  className="w-9 h-9 rounded-full bg-light-bg border border-border flex items-center justify-center text-muted hover:text-primary-ink hover:border-primary/40 transition"
                  aria-label={`Email ${member.name}`}
                >
                  <Mail size={16} />
                </a>
              </div>
            </Card>
          </FadeIn>
        ))}
      </div>

      {/* Project Info */}
      <FadeIn delay={400}>
        <div className="mt-12 text-center">
          <Card padding="lg" className="inline-block">
            <p className="text-muted text-sm">
              <strong className="text-dark">NowCart</strong> — Built for HackOn with Amazon 2025
            </p>
          </Card>
        </div>
      </FadeIn>
    </div>
  );
}
