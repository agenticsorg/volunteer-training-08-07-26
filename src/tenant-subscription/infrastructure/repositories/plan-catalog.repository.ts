import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';

@Injectable()
export class PlanCatalogRepository {
  constructor(private prisma: PrismaService) {}

  async listActivePlans() {
    return this.prisma.plan.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(planId: string) {
    return this.prisma.plan.findUnique({
      where: { id: planId },
    });
  }

  async findByStripePriceId(stripePriceId: string) {
    return this.prisma.plan.findUnique({
      where: { stripePriceId },
    });
  }
}
