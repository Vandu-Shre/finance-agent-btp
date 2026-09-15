import { AzureChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { agentConfig } from '../config/index.js';
import {
  createSearchTool,
  calculateTool,
  compareTool,
  extractFinancialDataTool,
} from '../tools/finance-tools.js';
import { logger } from '../../lib/logger.js';

const SYSTEM_PROMPT = `You are a helpful finance assistant with expertise in financial analysis and general knowledge.

You have access to the following tools:
- **search_documents**: Search the user's uploaded financial documents for relevant data. Always try this first when the user asks about document content or specific figures.
- **calculate**: Evaluate mathematical expressions for financial calculations (interest, growth rates, ratios, etc.).
- **compare_values**: Compare two or more financial figures and summarise their relationship.
- **extract_financial_data**: Extract structured financial figures (revenues, percentages, periods) from raw text passages.

GUIDELINES:
- Use tools proactively — if the user asks a data-driven question, search documents first.
- Chain tools when needed: search → extract → calculate → compare.
- When citing document content, mention the source filename.
- Break down complex financial concepts into clear, simple terms.
- If you genuinely do not know the answer and have no relevant documents, say so honestly.`;

/**
 * Finance Agent — tool-calling agent backed by Azure OpenAI
 */
export class FinanceAgent {
  private agent: ReturnType<typeof createAgent> | null = null;
  private chatHistory: Array<HumanMessage | AIMessage> = [];
  private userIdRef: { value: string } = { value: 'default' };

  async initialize(userId?: string): Promise<void> {
    if (userId) this.userIdRef.value = userId;

    const llm = new AzureChatOpenAI({
      azureOpenAIApiKey: agentConfig.azure.apiKey,
      azureOpenAIApiVersion: agentConfig.azure.apiVersion,
      azureOpenAIApiInstanceName: agentConfig.azure.instanceName,
      azureOpenAIApiDeploymentName: agentConfig.azure.deploymentName,
    });

    const tools = [
      createSearchTool(this.userIdRef),
      calculateTool,
      compareTool,
      extractFinancialDataTool,
    ];

    this.agent = createAgent({
      model: llm,
      tools: tools as any[],
      systemPrompt: SYSTEM_PROMPT,
    });
  }

  async chat(input: string, _context?: string): Promise<string> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const result = await this.agent.invoke({
        messages: [
          ...this.chatHistory,
          new HumanMessage(input),
        ],
      });

      const lastMessage = result.messages.at(-1);
      const output: string = typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? '');

      this.chatHistory.push(new HumanMessage(input));
      this.chatHistory.push(new AIMessage(output));

      // Keep last 20 exchanges (40 messages)
      if (this.chatHistory.length > 40) {
        this.chatHistory = this.chatHistory.slice(-40);
      }

      return output;
    } catch (error) {
      logger.error('Error in agent chat', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  setUserId(userId: string): void {
    this.userIdRef.value = userId;
    if (!this.agent) {
      this.initialize(userId).catch(err =>
        logger.error('Failed to initialize agent', { userId, error: (err as Error).message })
      );
    }
  }

  resetHistory(): void {
    this.chatHistory = [];
  }

  getHistory(): Array<HumanMessage | AIMessage> {
    return [...this.chatHistory];
  }
}
