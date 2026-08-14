import { ReputationEntry } from '../value-objects/reputation-entry';

export class SenderReputationCache {
  readonly tenantId: string;
  readonly senderDomain: string;
  categoryHistory: Map<string, ReputationEntry> = new Map();

  constructor(
    tenantId: string,
    senderDomain: string,
    history?: Record<string, any>,
  ) {
    this.tenantId = tenantId;
    this.senderDomain = senderDomain;

    if (history) {
      Object.entries(history).forEach(([category, data]) => {
        this.categoryHistory.set(category, ReputationEntry.fromDb(data));
      });
    }
  }

  static create(tenantId: string, senderDomain: string): SenderReputationCache {
    return new SenderReputationCache(tenantId, senderDomain);
  }

  static fromDb(data: any): SenderReputationCache {
    return new SenderReputationCache(
      data.tenant_id,
      data.sender_domain,
      data.category_confidence,
    );
  }

  recordCategory(
    category: string,
    confidenceWeight: number = 0.8,
  ): void {
    const existing = this.categoryHistory.get(category);

    if (existing) {
      this.categoryHistory.set(
        category,
        existing.withAdditionalObservation(0.05),
      );
    } else {
      this.categoryHistory.set(
        category,
        new ReputationEntry(category, 1, confidenceWeight, new Date()),
      );
    }
  }

  getMostLikelyCategory(): string | null {
    let best: [string, ReputationEntry] | null = null;

    this.categoryHistory.forEach((entry, category) => {
      if (!best || entry.confidenceWeight > best[1].confidenceWeight) {
        best = [category, entry];
      }
    });

    return best ? best[0] : null;
  }

  getCategoryConfidence(category: string): number | null {
    const entry = this.categoryHistory.get(category);
    return entry ? entry.confidenceWeight : null;
  }

  getHighConfidenceCategories(threshold: number = 0.7): string[] {
    const results: string[] = [];
    this.categoryHistory.forEach((entry, category) => {
      if (entry.isHighConfidence(threshold)) {
        results.push(category);
      }
    });
    return results;
  }

  toDb(): Record<string, any> {
    const categoryConfidence: Record<string, any> = {};
    this.categoryHistory.forEach((entry, category) => {
      categoryConfidence[category] = entry.toDb();
    });

    return {
      tenant_id: this.tenantId,
      sender_domain: this.senderDomain,
      category_confidence: categoryConfidence,
      last_updated: new Date(),
    };
  }
}
