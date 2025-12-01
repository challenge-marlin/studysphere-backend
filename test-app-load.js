console.log('Testing app.js load...');
try {
  const app = require('./backend/app');
  console.log('app.js loaded OK');
  console.log('App type:', typeof app);
} catch(e) {
  console.error('ERROR loading app.js:', e.message);
  console.error('Stack:', e.stack);
  process.exit(1);
}

