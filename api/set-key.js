const { BlobServiceClient } = require('@azure/storage-blob');

// Store the API key in memory (for demo; use env vars in production)
let ACCOUNT_KEY = '';

const ACCOUNT_NAME = 'skillsoftlexiconfiles';
const CONTAINER_NAME = 'test-lexicons';

function getConnectionString() {
  return `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Setting API key:', req.body);
    if (!req.body || !req.body.key) {
      return res.status(400).json({ error: 'API key is required' });
    }
    ACCOUNT_KEY = req.body.key;
    console.log('API key set successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting API key:', error);
    res.status(500).json({ error: error.message });
  }
}; 