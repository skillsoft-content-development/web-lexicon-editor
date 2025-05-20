import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';

const ACCOUNT_NAME = 'skillsoftlexiconfiles';
const ENDPOINT_SUFFIX = 'core.windows.net';
const CONTAINER_NAME = 'test-lexicons';

export function getConnectionString(apiKey: string) {
  return `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT_NAME};AccountKey=${apiKey};EndpointSuffix=${ENDPOINT_SUFFIX}`;
}

export async function listBlobs(apiKey: string): Promise<string[]> {
  const connectionString = getConnectionString(apiKey);
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const blobNames: string[] = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    blobNames.push(blob.name);
  }
  return blobNames;
}

export async function downloadBlob(apiKey: string, blobName: string): Promise<string> {
  const connectionString = getConnectionString(apiKey);
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const blobClient = containerClient.getBlobClient(blobName);
  const downloadBlockBlobResponse = await blobClient.download();
  const downloaded = await streamToStringBrowser(downloadBlockBlobResponse.readableStreamBody);
  return downloaded;
}

export async function uploadBlob(apiKey: string, blobName: string, content: string): Promise<void> {
  const connectionString = getConnectionString(apiKey);
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  // Convert string to ArrayBuffer
  const encoder = new TextEncoder();
  const contentBuffer = encoder.encode(content);
  
  // Upload the content
  await blockBlobClient.uploadData(contentBuffer, {
    blobHTTPHeaders: {
      blobContentType: 'text/xml'
    }
  });
}

// Robust browser-compatible stream-to-string
async function streamToStringBrowser(readableStream: any): Promise<string> {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      result += decoder.decode(new Uint8Array(value), { stream: true });
    }
  }
  return result;
} 