import { Chroma } from "@langchain/community/vectorstores/chroma";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CloudClient } from "chromadb";
import { agentConfig } from '../config/index.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let vectorStore: Chroma | null = null;
const CHROMA_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Extract instance name from Azure OpenAI endpoint
 */
function extractInstanceName(endpoint: string): string {
  const url = new URL(endpoint);
  return url.hostname.split('.')[0] || '';
}

function createEmbeddings(): AzureOpenAIEmbeddings {
  return new AzureOpenAIEmbeddings({
    azureOpenAIApiKey: agentConfig.azure.apiKey,
    azureOpenAIApiInstanceName: extractInstanceName(agentConfig.azure.endpoint),
    azureOpenAIApiDeploymentName: agentConfig.azure.embeddingDeploymentName,
    azureOpenAIApiVersion: agentConfig.azure.apiVersion,
  });
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  const timeoutPromise = new Promise<never>((_, reject) => {
    const handleAbort = (): void => {
      reject(new Error(timeoutMessage));
    };

    timeoutSignal.addEventListener('abort', handleAbort, { once: true });
  });

  return Promise.race([operation, timeoutPromise]);
}

async function connectToChroma(): Promise<CloudClient> {
  const chromaClient = new CloudClient({
    apiKey: agentConfig.chroma.apiKey,
    tenant: agentConfig.chroma.tenant,
    database: agentConfig.chroma.database,
  });
  await withTimeout(
    chromaClient.heartbeat(),
    CHROMA_CONNECTION_TIMEOUT_MS,
    `Connection timeout after ${CHROMA_CONNECTION_TIMEOUT_MS / 1000} seconds`
  );
  console.log('✅ Chroma Cloud connection successful');
  console.log(`✅ Ready to connect to collection "${agentConfig.chroma.collectionName}"`);
  return chromaClient;
}

/**
 * Initialize the vector store with Azure OpenAI embeddings
 */
export async function initializeVectorStore(): Promise<void> {
  try {
    console.log(`🌐 Connecting to Chroma Cloud`);
    console.log(`   Tenant: ${agentConfig.chroma.tenant}`);
    console.log(`   Database: ${agentConfig.chroma.database}`);
    console.log(`   Collection: ${agentConfig.chroma.collectionName}`);
    const embeddings = createEmbeddings();
    const chromaClient = await connectToChroma();
    vectorStore = new Chroma(embeddings, {
      collectionName: agentConfig.chroma.collectionName,
      index: chromaClient,
      collectionMetadata: { 'hnsw:space': 'cosine' },
    });
    console.log('✅ Vector store connected to Chroma Cloud successfully');
  } catch (error) {
    console.error('❌ Failed to initialize vector store:', error);
    throw error;
  }
}

async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  if (mimetype === 'text/plain' || mimetype === 'text/csv') {
    return buffer.toString('utf-8');
  }
  if (mimetype === 'application/json') {
    return JSON.stringify(JSON.parse(buffer.toString('utf-8')), null, 2);
  }
  if (mimetype === 'application/pdf') {
    const tempFilePath = join(tmpdir(), `temp-${Date.now()}-${filename}`);
    try {
      writeFileSync(tempFilePath, buffer);
      const docs = await new PDFLoader(tempFilePath).load();
      return docs.map(doc => doc.pageContent).join('\n\n');
    } finally {
      try { unlinkSync(tempFilePath); } catch { /* ignore cleanup errors */ }
    }
  }
  throw new Error(`Unsupported file type: ${mimetype}. Supported types: text/plain, text/csv, application/json, application/pdf`);
}

/**
 * Index a document from a buffer
 */
export async function indexDocumentFromBuffer(
  buffer: Buffer,
  filename: string,
  mimetype: string,
  userId: string
): Promise<void> {
  if (!vectorStore) {
    throw new Error('Vector store not initialized. Call initializeVectorStore() first.');
  }
  try {
    const textContent = await extractText(buffer, mimetype, filename);
    const chunks = await new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 }).splitText(textContent);
    const documents = chunks.map((chunk, index) => new Document({
      pageContent: chunk,
      metadata: { source: filename, mimetype, userId, chunkIndex: index, totalChunks: chunks.length, indexedAt: new Date().toISOString() },
    }));
    await vectorStore.addDocuments(documents);
    console.log(`Successfully indexed ${documents.length} chunks from ${filename}`);
  } catch (error) {
    console.error(`Failed to index document ${filename}:`, error);
    throw error;
  }
}

/**
 * Search for similar documents
 */
export async function searchDocuments(query: string, k: number = 4, userId?: string): Promise<Document[]> {
  if (!vectorStore) {
    throw new Error('Vector store not initialized. Call initializeVectorStore() first.');
  }

  try {
    const filter = userId ? { userId: { $eq: userId } } : undefined;
    const results = await vectorStore.similaritySearch(query, k, filter);
    return results;
  } catch (error) {
    console.error('Failed to search documents:', error);
    throw error;
  }
}

/**
 * Delete all chunks for a document by matching the source metadata field
 */
export async function deleteDocumentByFilename(filename: string): Promise<void> {
  if (!vectorStore) {
    throw new Error('Vector store not initialized. Call initializeVectorStore() first.');
  }
  try {
    await vectorStore.delete({ filter: { source: { $eq: filename } } });
    console.log(`✅ Deleted chunks for document: ${filename}`);
  } catch (error) {
    console.error(`Failed to delete chunks for ${filename}:`, error);
    throw error;
  }
}

/**
 * Get all unique document sources in the vector store
 */
export async function getAllDocumentSources(): Promise<string[]> {
  if (!vectorStore) {
    throw new Error('Vector store not initialized. Call initializeVectorStore() first.');
  }

  try {
    // This is a simplified implementation
    // In production, you might want to maintain a separate index of document metadata
    return [];
  } catch (error) {
    console.error('Failed to get document sources:', error);
    throw error;
  }
}

export { vectorStore };
