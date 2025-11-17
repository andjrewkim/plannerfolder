import { landingPages } from './data/landingPages';

const config = {
  siteUrl: 'https://fluxplanner.netlify.app', // replace with your domain
  generateRobotsTxt: true,
  additionalPaths: async () => {
    // Take all keys (slugs) from landingPages object
    return Object.keys(landingPages).map(slug => `/landing/${slug}`);
  },
};

export default config;