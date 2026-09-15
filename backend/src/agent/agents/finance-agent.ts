import { AzureChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from '@langchain/core/agents';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { agentConfig } from '../config/index.js';
import {
  createSearchTool,
  calculateTool,
  compareTool,
  extractFinancialDataTool,
} from '../tools/finance-tools.js';

/**
 * System prompt for the finance agent
 */
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
 * Finance Agent — a real tool-calling agent backed by Azure OpenAI
 */
export class FinanceAgent {
  private executor: AgentExecutor | null = null;
  private chatHistory: Array<HumanMessage | AIMessage> = [];
  private userIdRef: { value: string } = { value: 'default' };

  async initialize(userId?: string): Promise<void> {
    if (userId) this.userIdRef.value = userId;

    const llm = new AzureChatOpenAI({
      azureOpenAIApiKey: agentConfig.azure.apiKey,
      azureOpenAIApiVersion: agentConfig.azure.apiVersion,
      azureOpenAIApiInstanceName: agentConfig.azure.instanceName,
      azureOpenAIApiDeploymentName: agentConfig.azure.deploymentName,
      temperature: agentConfig.azure.temperature,
    });

    // Pass userIdRef so the search tool reads the current userId on every invocation
    const tools = [
      createSearchTool(this.userIdRef),
      calculateTool,
      compareTool,
      extractFinancialDataTool,
    ];

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SYSTEM_PROMPT],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = createToolCallingAgent({ llm, tools, prompt });

    this.executor = new AgentExecutor({
      agent,
      tools,
      maxIterations: 6,
      returnIntermediateSteps: false,
    });
  }

  async chat(input: string, _context?: string): Promise<string> {
    if (!this.executor) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const result = await this.executor.invoke({
        input,
        chat_history: this.chatHistory,
      });

      const output: string = result.output ?? '';

      // Maintain rolling history (last 20 exchanges to stay within context limits)
      this.chatHistory.push(new HumanMessage(input));
      this.chatHistory.push(new AIMessage(output));
      if (this.chatHistory.length > 40) {
        this.chatHistory = this.chatHistory.slice(-40);
      }

      return output;
    } catch (error) {
      console.error('Error in agent chat:', error);
      throw error;
    }
  }

  setUserId(userId: string): void {
    // Mutating the ref is enough — createSearchTool reads it on every call
    this.userIdRef.value = userId;
    if (!this.executor) {
      this.initialize(userId).catch(err =>
        console.error('Failed to initialize agent:', err)
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
