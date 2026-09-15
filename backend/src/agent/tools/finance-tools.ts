import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchDocuments } from '../services/vector-store.service.js';

type CompareValue = { label: string; amount: number };

/**
 * Tool: Search uploaded documents for relevant context.
 * Accepts a userId ref object so the tool always uses the agent's current userId
 * without needing to be reconstructed on every user change.
 */
export function createSearchTool(userIdRef: { value: string }) {
  return new DynamicStructuredTool({
    name: 'search_documents',
    description:
      'Search uploaded financial documents for relevant information. ' +
      'Use this when the user asks about data, figures, or content that might be in their documents.',
    schema: z.object({
      query: z.string().describe('The search query to find relevant document content'),
      k: z.number().optional().default(4).describe('Number of document chunks to retrieve (default 4)'),
    }),
    func: async ({ query, k }) => {
      try {
        const docs = await searchDocuments(query, k ?? 4, userIdRef.value);
        if (!docs || docs.length === 0) {
          return 'No relevant documents found for this query.';
        }
        return docs
          .map(
            (doc, i) =>
              `[Chunk ${i + 1}] Source: ${doc.metadata?.source ?? 'Unknown'}\n${doc.pageContent}`
          )
          .join('\n\n---\n\n');
      } catch (err) {
        return `Document search failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}

/**
 * Tool: Evaluate a mathematical expression (finance calculations)
 */
export const calculateTool = new DynamicStructuredTool({
  name: 'calculate',
  description:
    'Evaluate a mathematical expression for financial calculations. ' +
    'Supports arithmetic, percentages, and standard math functions. ' +
    'Examples: "1200 * 0.07", "(50000 - 35000) / 35000 * 100", "Math.sqrt(144)".',
  schema: z.object({
    expression: z
      .string()
      .describe('A safe mathematical expression to evaluate (no code, only math)'),
  }),
  func: async ({ expression }) => {
    const sanitized = (expression as string).trim();
    if (!/^[\d\s+\-*/().,%eMath]+$/.test(sanitized.replace(/Math\.\w+/g, 'Math.fn'))) {
      return 'Error: Expression contains disallowed characters. Only arithmetic and Math.* functions are permitted.';
    }

    try {
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result !== 'number' || !isFinite(result)) {
        return 'Error: Expression did not return a finite number.';
      }
      return `Result: ${result}`;
    } catch (err) {
      return `Calculation error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});

/**
 * Tool: Compare two or more financial values
 */
export const compareTool = new DynamicStructuredTool({
  name: 'compare_values',
  description:
    'Compare two or more financial figures and describe their relationship. ' +
    'Use this to highlight differences, growth rates, or which value is larger.',
  schema: z.object({
    values: z
      .array(
        z.object({
          label: z.string().describe('Human-readable label for this value (e.g. "Q1 Revenue")'),
          amount: z.number().describe('The numeric value'),
        })
      )
      .min(2)
      .describe('List of labelled values to compare (at least 2)'),
  }),
  func: async ({ values }) => {
    const typedValues = values as CompareValue[];
    const sorted = [...typedValues].sort((a, b) => b.amount - a.amount);
    const highest = sorted[0] as CompareValue;
    const lowest = sorted[sorted.length - 1] as CompareValue;

    const lines: string[] = ['Comparison:'];
    typedValues.forEach(v => {
      lines.push(`  ${v.label}: ${v.amount.toLocaleString()}`);
    });

    if (typedValues.length === 2) {
      const first = typedValues[0] as CompareValue;
      const second = typedValues[1] as CompareValue;
      const diff = first.amount - second.amount;
      const pct =
        second.amount !== 0
          ? ((diff / Math.abs(second.amount)) * 100).toFixed(2)
          : 'N/A';
      lines.push(`\nDifference (${first.label} vs ${second.label}): ${diff.toLocaleString()} (${pct}%)`);
    }

    lines.push(`\nHighest: ${highest.label} (${highest.amount.toLocaleString()})`);
    lines.push(`Lowest: ${lowest.label} (${lowest.amount.toLocaleString()})`);

    return lines.join('\n');
  },
});

/**
 * Tool: Extract structured financial data from a text passage
 */
export const extractFinancialDataTool = new DynamicStructuredTool({
  name: 'extract_financial_data',
  description:
    'Extract key financial figures (revenue, profit, expenses, percentages, dates) ' +
    'from a passage of text. Use this to parse raw document content into structured data.',
  schema: z.object({
    text: z.string().describe('The text passage to extract financial data from'),
  }),
  func: async ({ text }) => {
    const textStr = text as string;
    const results: string[] = ['Extracted financial data:'];

    // Currency amounts: $1,234.56 or USD 1,234 etc.
    const currencyMatches = textStr.match(
      /(?:USD|EUR|GBP|JPY|CHF|\$|€|£|¥)?\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|trillion|M|B|K))?/gi
    );
    if (currencyMatches && currencyMatches.length > 0) {
      results.push(`\nMonetary figures found (${currencyMatches.length}):`);
      const unique = [...new Set(currencyMatches.map((m: string) => m.trim()).filter((m: string) => m.length > 1))];
      unique.slice(0, 10).forEach((m: string) => results.push(`  - ${m}`));
    }

    // Percentages
    const pctMatches = textStr.match(/[\d.]+\s*%/g);
    if (pctMatches && pctMatches.length > 0) {
      results.push(`\nPercentages: ${[...new Set(pctMatches)].join(', ')}`);
    }

    // Dates / fiscal periods
    const dateMatches = textStr.match(
      /(?:Q[1-4]\s+\d{4}|FY\s*\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}|\d{4})/gi
    );
    if (dateMatches && dateMatches.length > 0) {
      results.push(`\nTime periods: ${[...new Set(dateMatches)].join(', ')}`);
    }

    if (results.length === 1) {
      return 'No recognizable financial figures found in the provided text.';
    }

    return results.join('\n');
  },
});
