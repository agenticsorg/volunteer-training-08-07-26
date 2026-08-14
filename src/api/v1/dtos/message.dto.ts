// Classification facet (Stage 4)
export interface MessageClassificationDto {
  category: string;
  confidence: number;
  reasoning?: string;
}

// Priority facet (Stage 7)
export interface MessagePriorityDto {
  tier: 'Critical' | 'High' | 'Normal' | 'Low';
  score: number;
  components: Array<{
    signal: string;
    contribution: number;
    evidence?: string;
  }>;
}

// Threat facet (Stage 6)
export interface MessageThreatDto {
  phishing: boolean;
  quarantined: boolean;
  reason?: string;
}

// Contact facet (Stage 5)
export interface MessageContactDto {
  personal: boolean;
  vip: boolean;
  confidence: number;
}

// Full message resource with all facets
export interface MessageResourceDto {
  id: string;
  messageId: string;
  tenantId: string;
  mailboxId: string;
  subject?: string;
  from: string;
  to: string[];
  receivedAt: Date;

  // All four independent facets
  classification: MessageClassificationDto;
  priority: MessagePriorityDto;
  threat: MessageThreatDto;
  contact: MessageContactDto;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Query filter for messages
export class MessageQueryDto {
  skip?: number;
  take?: number;
  category?: string;
  priorityTierMin?: string;
  quarantined?: boolean;
  personalOnly?: boolean;
}

// Response wrapper
export interface PaginatedMessageResponseDto {
  data: MessageResourceDto[];
  total: number;
  skip: number;
  take: number;
}
