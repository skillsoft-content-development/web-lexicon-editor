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

  if (!ACCOUNT_KEY) return res.status(401).json({ error: 'API key not set' });

  // Get blob name from query parameter or path parameter
  const blobName = req.query.name || req.query.blobName;
  
  if (!blobName) {
    return res.status(400).json({ error: 'Blob name is required' });
  }

  try {
    console.log('Handling blob request:', {
      method: req.method,
      blobName,
      query: req.query,
      headers: req.headers
    });

    const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(blobName);

    if (req.method === 'GET') {
      console.log('Downloading blob:', blobName);
      const downloadBlockBlobResponse = await blobClient.download();
      const chunks = [];
      for await (const chunk of downloadBlockBlobResponse.readableStreamBody) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const content = buffer.toString('utf-8');
      console.log('Downloaded content length:', content.length);
      res.set('Content-Type', 'application/xml');
      res.send(content);
    } else if (req.method === 'POST') {
      console.log('Received save request for:', blobName);
      console.log('Request body type:', typeof req.body);
      console.log('Request body length:', req.body ? req.body.length : 0);
      console.log('Request headers:', req.headers);
      
      // Convert Buffer to string if needed
      const xmlContent = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : req.body;
      
      if (typeof xmlContent !== 'string') {
        throw new Error(`Invalid request body type: ${typeof xmlContent}`);
      }
      
      console.log('XML content type:', typeof xmlContent);
      console.log('XML content length:', xmlContent.length);
      console.log('XML content preview:', xmlContent.substring(0, 100) + '...');
      
      // Set proper content type for XML
      const blockBlobClient = blobClient.getBlockBlobClient();
      await blockBlobClient.upload(Buffer.from(xmlContent), xmlContent.length, { 
        overwrite: true,
        blobHTTPHeaders: {
          blobContentType: 'application/xml'
        }
      });
      console.log('Successfully saved blob:', blobName);
      res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Error handling blob:', {
      name: blobName,
      error: err.message,
      stack: err.stack,
      bodyType: typeof req.body,
      bodyLength: req.body ? req.body.length : 0
    });
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to handle blob. Check server logs for more information.'
    });
  }
}; 