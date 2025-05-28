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

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ACCOUNT_KEY) return res.status(401).json({ error: 'API key not set' });

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobNames = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      blobNames.push(blob.name);
    }
    res.json(blobNames);
  } catch (err) {
    console.error('Error listing blobs:', err);
    res.status(500).json({ error: err.message });
  }
}; 