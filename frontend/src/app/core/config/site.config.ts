import { environment } from '../../../environments/environment';

export interface SocialLink {
  label: string;
  url: string;
  /** Brand logo image in frontend/assets/ (displayed on the website). */
  icon: string;
}

export interface SocialLinks {
  github: SocialLink;
  linkedin: SocialLink;
  instagram: SocialLink;
  tiktok: SocialLink;
}

/**
 * Public marketing-site configuration.
 *
 * Everything a recruiter/visitor sees that is personal (social links, developer
 * name) lives here so it can be updated in one place. Social icons are brand
 * logos stored in frontend/assets/ — swap the file and update `icon` to change
 * them.
 */
export const SITE = {
  name: 'LifeHub',
  tagline: 'Personal Life Management Platform',
  /** Public base URL — comes from the build environment (change in environment.ts). */
  url: environment.siteUrl,
  /** Short description reused by meta tags and the footer. */
  description:
    'LifeHub is an all-in-one personal life management platform for managing finances, tasks, habits, goals, notes, planning, and productivity in one place.',
  developer: {
    name: 'Hidayah Muhammad Fadillah',
    role: 'Full-stack Developer',
  },
  /** Social links shown on Contact / Footer. */
  social: {
    github: {
      label: 'GitHub',
      url: 'https://github.com/HidayahMF',
      icon: 'assets/githublogo.png',
    },
    linkedin: {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/hidayah-muhammad-fadillah-89695b384/',
      icon: 'assets/linkedinlogo.png',
    },
    instagram: {
      label: 'Instagram',
      url: 'https://www.instagram.com/hdyhmfdlh/',
      icon: 'assets/instagramlogo.png',
    },
    tiktok: {
      label: 'TikTok',
      url: 'https://www.tiktok.com/@padelqt',
      icon: 'assets/tiktoklogo.png',
    },
  } as SocialLinks,
};
