const express = require('express');
const cors = require('cors');
const { BlobServiceClient } = require('@azure/storage-blob');
const bodyParser = require('body-parser');

const app = express();

// Configure CORS with specific options
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Add your frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

// Configure middleware
app.use(express.json());
app.use(express.raw({ type: ['text/plain', 'application/xml'], limit: '10mb' }));
app.use(bodyParser.text({ type: ['text/plain', 'application/xml'] }));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Store the API key in memory (for demo; use env vars in production)
let ACCOUNT_KEY = '';

const ACCOUNT_NAME = 'skillsoftlexiconfiles';
const CONTAINER_NAME = 'test-lexicons';

function getConnectionString() {
  return `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${ACCOUNT_KEY};EndpointSuffix=core.windows.net`;
}

app.post('/api/set-key', (req, res) => {
  ACCOUNT_KEY = req.body.key;
  res.json({ success: true });
});

app.post('/api/reset-key', (req, res) => {
  ACCOUNT_KEY = '';
  res.json({ success: true });
});

app.get('/api/blobs', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/blob/:name', async (req, res) => {
  if (!ACCOUNT_KEY) return res.status(401).json({ error: 'API key not set' });
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(req.params.name);
    const downloadBlockBlobResponse = await blobClient.download();
    const chunks = [];
    for await (const chunk of downloadBlockBlobResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    res.set('Content-Type', 'application/xml');
    res.send(buffer.toString('utf-8'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload/save endpoint
app.post('/api/blob/:name', async (req, res) => {
  if (!ACCOUNT_KEY) return res.status(401).json({ error: 'API key not set' });
  try {
    console.log('Received save request for:', req.params.name);
    console.log('Request body type:', typeof req.body);
    console.log('Request body length:', req.body ? req.body.length : 0);
    console.log('Request headers:', req.headers);
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient(req.params.name);
    
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
    console.log('Successfully saved blob:', req.params.name);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving blob:', {
      name: req.params.name,
      error: err.message,
      stack: err.stack,
      bodyType: typeof req.body,
      bodyLength: req.body ? req.body.length : 0
    });
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to save blob. Check server logs for more information.'
    });
  }
});

// Test endpoint to save a simple text file
app.post('/api/test-save', async (req, res) => {
  if (!ACCOUNT_KEY) return res.status(401).json({ error: 'API key not set' });
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString());
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blobClient = containerClient.getBlobClient('test.txt');
    const testContent = 'This is a test file to verify blob storage access.';
    await blobClient.upload(testContent, Buffer.byteLength(testContent), { 
      overwrite: true,
      blobHTTPHeaders: {
        blobContentType: 'text/plain'
      }
    });
    res.json({ success: true, message: 'Test file saved successfully' });
  } catch (err) {
    console.error('Error saving test file:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Backend proxy running on http://localhost:${PORT}`);
}); 