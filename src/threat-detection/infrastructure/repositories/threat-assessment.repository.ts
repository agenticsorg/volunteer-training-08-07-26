import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ThreatAssessment } from '../../domain/aggregates/threat-assessment.aggregate';

@Injectable()
export class ThreatAssessmentRepository {
  constructor(private prisma: PrismaService) {}

  async save(assessment: ThreatAssessment): Promise<void> {
    const existing = await this.findByMessageId(assessment.tenantId, assessment.messageId);

    if (existing) {
      await this.prisma.threatAssessment.update({
        where: { id: existing['id'] as string },
        data: {
          auth_signal: assessment.authenticationSignal
            ? (assessment.authenticationSignal.toJSON() as any)
            : undefined,
          lookalike_score: assessment.lookalikeScore
            ? (assessment.lookalikeScore.toJSON() as any)
            : undefined,
          intent_classification: assessment.intentClassification
            ? (assessment.intentClassification.toJSON() as any)
            : undefined,
          quarantine_decision: assessment.quarantineDecision.action,
          quarantine_locked: assessment.quarantineDecision.isLocked(),
          updated_at: new Date(),
        },
      });
    } else {
      await this.prisma.threatAssessment.create({
        data: {
          tenant_id: assessment.tenantId,
          message_id: assessment.messageId,
          auth_signal: assessment.authenticationSignal
            ? (assessment.authenticationSignal.toJSON() as any)
            : undefined,
          lookalike_score: assessment.lookalikeScore
            ? (assessment.lookalikeScore.toJSON() as any)
            : undefined,
          intent_classification: assessment.intentClassification
            ? (assessment.intentClassification.toJSON() as any)
            : undefined,
          quarantine_decision: assessment.quarantineDecision.action,
          quarantine_locked: assessment.quarantineDecision.isLocked(),
        },
      });
    }
  }

  async findByMessageId(tenantId: string, messageId: string): Promise<(ThreatAssessment & { id: string }) | null> {
    const record = await this.prisma.threatAssessment.findFirst({
      where: {
        tenant_id: tenantId,
        message_id: messageId,
      },
    });

    if (!record) return null;

    const assessment = ThreatAssessment.fromJSON({
      tenantId: record.tenant_id,
      messageId: record.message_id,
      authenticationSignal: record.auth_signal,
      lookalikeScore: record.lookalike_score,
      intentClassification: record.intent_classification,
      quarantineDecision: record.quarantine_decision,
      highestTierReached: 'AuthCheck', // Derive from which fields are populated
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });

    return Object.assign(assessment, { id: record.id });
  }

  async findByTenantAndQuarantineStatus(
    tenantId: string,
    quarantined: boolean,
    limit: number = 100,
  ): Promise<ThreatAssessment[]> {
    const records = await this.prisma.threatAssessment.findMany({
      where: {
        tenant_id: tenantId,
        quarantine_locked: quarantined,
      },
      take: limit,
    });

    return records.map((r) =>
      ThreatAssessment.fromJSON({
        tenantId: r.tenant_id,
        messageId: r.message_id,
        authenticationSignal: r.auth_signal,
        lookalikeScore: r.lookalike_score,
        intentClassification: r.intent_classification,
        quarantineDecision: r.quarantine_decision,
        highestTierReached: 'AuthCheck',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }),
    );
  }
}
