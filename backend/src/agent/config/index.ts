import { config } from 'dotenv';

// Load environment variables
config();

export const agentConfig = {
  azure: {
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',

    // Chat/LLM Model - for generating responses and conversations
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',

    // Embedding Model - for document search and retrieval
    embeddingDeploymentName: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || '',

    temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
  },
  chroma: {
    // Chroma Cloud configuration (uses CloudClient)
    apiKey: process.env.CHROMA_API_KEY || '',
    tenant: process.env.CHROMA_TENANT || 'default_tenant',
    database: process.env.CHROMA_DATABASE || 'default_database',
    collectionName: process.env.CHROMA_COLLECTION_NAME || 'finance-docs',
  },
};

// Validate required configuration
if (!agentConfig.azure.apiKey) {
  throw new Error('AZURE_OPENAI_API_KEY is required. Please set it in .env file.');
}
if (!agentConfig.azure.endpoint) {
  throw new Error('AZURE_OPENAI_ENDPOINT is required. Please set it in .env file.');
}
if (!agentConfig.azure.deploymentName) {
  throw new Error('AZURE_OPENAI_DEPLOYMENT_NAME is required. Please set it in .env file (this is your chat/LLM model).');
}
if (!agentConfig.azure.embeddingDeploymentName) {
  throw new Error('AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME is required. Please set it in .env file (this is your embedding model for document search).');
}

// Validate Chroma configuration
if (!agentConfig.chroma.apiKey) {
  throw new Error('CHROMA_API_KEY is required when using Chroma Cloud. Please set it in .env file.');
}
console.log('✅ Using Chroma Cloud for persistent vector storage');

console.log('📝 Configuration loaded:');
console.log(`  - Chat Model: ${agentConfig.azure.deploymentName}`);
console.log(`  - Embedding Model: ${agentConfig.azure.embeddingDeploymentName}`);
console.log(`  - Endpoint: ${agentConfig.azure.endpoint}`);
console.log(`  - Chroma Tenant: ${agentConfig.chroma.tenant}`);
console.log(`  - Chroma Database: ${agentConfig.chroma.database}`);
console.log(`  - Chroma Collection: ${agentConfig.chroma.collectionName}`);

