module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx next start --port 3000',
      startServerReadyPattern: 'ready started server',
      url: ['http://localhost:3000/'],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        skipAudits: ['full-page-screenshot', 'screenshot-thumbnails'],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:accessibility': ['warn', { minScore: 0.7 }],
        'categories:best-practices': ['warn', { minScore: 0.7 }],
        'categories:seo': ['warn', { minScore: 0.7 }],
      },
    },
  },
};
