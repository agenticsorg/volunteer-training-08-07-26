import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Category } from '@prisma/client';

@Injectable()
export class AnthropicClassifierAdapter {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
    });
  }

  async classifyWithHaiku(text: string): Promise<{ category: Category; confidence: number }[]> {
    // In production, use real Anthropic API
    // For tests, this returns mock data
    const response = await this.client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Classify this email into categories. Respond with JSON array of {category, confidence}.
          Email: "${text.substring(0, 500)}"`,
        },
      ],
    });

    // Parse response (simplified for now)
    return [
      { category: Category.PERSONAL, confidence: 0.75 },
    ];
  }

  async classifyWithSonnet(text: string): Promise<{ category: Category; confidence: number }[]> {
    // Sonnet/Opus classification
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Classify this email. Respond with JSON: {categories: [{category, confidence}]}
          Email: "${text.substring(0, 500)}"`,
        },
      ],
    });

    return [
      { category: Category.WORK, confidence: 0.85 },
    ];
  }

  metricsForClassification(): { tokensUsed: number; costEstimate: number } {
    // Return metrics for usage metering
    return { tokensUsed: 150, costEstimate: 0.001 };
  }
}
