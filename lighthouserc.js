module.exports = {
  ci: {
    collect: {
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
        'redirects': 'warn',
        'robots-txt': 'warn',
        'legacy-javascript-insight': 'warn',
        'legacy-javascript': 'warn',
        'unused-javascript': 'warn',
        'uses-rel-preconnect': 'warn',
        'render-blocking-resources': 'warn',
        'render-blocking-insight': 'warn',
        'uses-long-cache-ttl': 'warn',
        'cache-insight': 'warn',
        'max-potential-fid': 'warn',
      },
    },
  },
};
