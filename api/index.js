const { BlobServiceClient } = require('@azure/storage-blob');

const ACCOUNT_NAME = 'skillsoftlexiconfiles';
const CONTAINER_NAME = 'test-lexicons';

function getConnectionString(accountKey) {
  return `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
}

// Helper function to parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-api-key');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get API key from request headers
  const apiKey = req.headers['x-api-key'];
  if (!apiKey && req.method !== 'POST' && !req.url.includes('/set-key')) {
    return res.status(401).json({ error: 'API key not set' });
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // Handle different endpoints
    if (path === '/api/set-key' && req.method === 'POST') {
      const body = await parseBody(req);
      const { key } = JSON.parse(body);
      if (!key) {
        return res.status(400).json({ error: 'API key is required' });
      }
      return res.json({ success: true });
    }

    if (path === '/api/blobs' && req.method === 'GET') {
      const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString(apiKey));
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
      const blobNames = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        blobNames.push(blob.name);
      }
      return res.json(blobNames);
    }

    if (path.startsWith('/api/blob/') && req.method === 'GET') {
      const blobName = path.replace('/api/blob/', '');
      const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString(apiKey));
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
      const blobClient = containerClient.getBlobClient(decodeURIComponent(blobName));
      const downloadBlockBlobResponse = await blobClient.download();
      const chunks = [];
      for await (const chunk of downloadBlockBlobResponse.readableStreamBody) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/xml');
      return res.send(buffer.toString('utf-8'));
    }

    if (path.startsWith('/api/blob/') && req.method === 'POST') {
      const blobName = path.replace('/api/blob/', '');
      const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString(apiKey));
      const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
      const blobClient = containerClient.getBlobClient(decodeURIComponent(blobName));
      
      // Parse the request body
      const xmlContent = await parseBody(req);
      
      if (!xmlContent || typeof xmlContent !== 'string') {
        throw new Error(`Invalid request body: ${xmlContent}`);
      }
      
      const blockBlobClient = blobClient.getBlockBlobClient();
      await blockBlobClient.upload(Buffer.from(xmlContent), xmlContent.length, { 
        overwrite: true,
        blobHTTPHeaders: {
          blobContentType: 'application/xml'
        }
      });
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}; 