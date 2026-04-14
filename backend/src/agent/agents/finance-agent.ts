import { AzureChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { agentConfig } from '../config/index.js';

/**
 * System prompt for the finance agent
 */
const SYSTEM_PROMPT = `You are a helpful assistant with expertise in finance and general knowledge.

Your role is to:
1. Answer questions using the provided document context when relevant documents are available
2. Answer general questions using your own knowledge when no relevant documents are provided
3. Provide clear, accurate, and helpful responses on financial topics as well as everyday questions
4. Be friendly and professional

GUIDELINES:
- When relevant documents are provided in the context, prefer using that information and cite the source if available
- When no relevant documents are available, use your general knowledge to answer the question
- For financial topics, break down complex concepts into simple terms and be encouraging about financial goals
- If a question is genuinely outside your knowledge or you are unsure, acknowledge that honestly
- You may answer questions on any topic — finance, general knowledge, advice, explanations, and more`;

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
      azureOpenAIApiInstanceName: agentConfig.azure.instanceName,
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
        context: context || 'No relevant documents found. Use your general knowledge to answer the question.',
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
