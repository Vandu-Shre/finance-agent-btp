import { AzureChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { agentConfig } from '../config/index.js';

/**
 * System prompt for the finance agent
 */
const SYSTEM_PROMPT = `You are a helpful financial assistant designed to help users with their financial questions and needs.

Your role is to:
1. Answer questions ONLY based on the provided document context
2. Provide clear, helpful responses about financial topics using the information from the documents
3. Be friendly and professional

IMPORTANT RULES:
- You MUST ONLY use information from the provided context/documents to answer questions
- If the answer is not found in the provided context, you MUST respond with: "I do not know the answer to that"
- DO NOT use any external knowledge or make assumptions beyond what is in the documents
- DO NOT search the web or use information from outside the provided context
- If you are unsure or the documents don't contain enough information, say: "I do not know the answer to that"

Remember to:
- Break down complex financial concepts into simple terms
- Be encouraging and supportive about financial goals
- Cite the source document when providing information if available`;

/**
 * Finance Agent class for managing conversations
 */
export class FinanceAgent {
  private chain: any = null;
  private chatHistory: Array<{ role: string; content: string }> = [];

  async initialize() {
    // Initialize the Azure OpenAI LLM
    const llm = new AzureChatOpenAI({
      azureOpenAIApiKey: agentConfig.azure.apiKey,
      azureOpenAIApiVersion: agentConfig.azure.apiVersion,
      azureOpenAIApiInstanceName: this.extractInstanceName(agentConfig.azure.endpoint),
      azureOpenAIApiDeploymentName: agentConfig.azure.deploymentName,
      temperature: agentConfig.azure.temperature,
    });

    // Create the prompt template with context for document grounding
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      ['human', '{chat_history}\n\nContext from documents:\n{context}\n\nUser: {input}'],
    ]);

    // Create the chain
    this.chain = prompt.pipe(llm).pipe(new StringOutputParser());
  }

  /**
   * Extract instance name from Azure OpenAI endpoint
   * Example: https://your-instance.openai.azure.com/ -> your-instance
   */
  private extractInstanceName(endpoint: string): string {
    const url = new URL(endpoint);
    return url.hostname.split('.')[0] || '';
  }

  async chat(input: string, context: string = ''): Promise<string> {
    if (!this.chain) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      // Format chat history
      const chatHistoryStr = this.chatHistory.length > 0
        ? this.chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n')
        : '';

      // Get response from the agent with document context
      const response = await this.chain.invoke({
        input,
        chat_history: chatHistoryStr,
        context: context || 'No relevant documents found. You must respond with: "I do not know the answer to that"',
      });

      // Update chat history
      this.chatHistory.push(
        { role: 'User', content: input },
        { role: 'Assistant', content: response }
      );

      return response;
    } catch (error) {
      console.error('Error in agent chat:', error);
      throw error;
    }
  }

  resetHistory() {
    this.chatHistory = [];
  }

  getHistory() {
    return [...this.chatHistory];
  }
}
