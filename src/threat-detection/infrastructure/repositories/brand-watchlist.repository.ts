import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface BrandEntry {
  domain: string;
  brandName: string;
  impersonationRiskLevel: 'low' | 'medium' | 'high';
}

@Injectable()
export class BrandWatchlistRepository {
  constructor(private prisma: PrismaService) {}

  async findByDomain(domain: string): Promise<BrandEntry | null> {
    const record = await this.prisma.brandWatchlist.findFirst({
      where: { domain: domain.toLowerCase() },
    });

    if (!record) return null;

    return {
      domain: record.domain,
      brandName: record.brand_name,
      impersonationRiskLevel: record.impersonation_risk_level as any,
    };
  }

  async findSimilarDomains(domain: string): Promise<BrandEntry[]> {
    // Find all brands and return them for client-side fuzzy matching
    const records = await this.prisma.brandWatchlist.findMany({
      take: 1000, // Reasonable limit for in-memory matching
    });

    return records.map((r) => ({
      domain: r.domain,
      brandName: r.brand_name,
      impersonationRiskLevel: r.impersonation_risk_level as any,
    }));
  }

  async addBrand(domain: string, brandName: string, riskLevel: 'low' | 'medium' | 'high'): Promise<void> {
    await this.prisma.brandWatchlist.upsert({
      where: { domain: domain.toLowerCase() },
      update: {
        brand_name: brandName,
        impersonation_risk_level: riskLevel,
        last_updated: new Date(),
      },
      create: {
        domain: domain.toLowerCase(),
        brand_name: brandName,
        impersonation_risk_level: riskLevel,
      },
    });
  }

  async removeBrand(domain: string): Promise<void> {
    await this.prisma.brandWatchlist.delete({
      where: { domain: domain.toLowerCase() },
    });
  }

  async getAllBrands(): Promise<BrandEntry[]> {
    const records = await this.prisma.brandWatchlist.findMany();
    return records.map((r) => ({
      domain: r.domain,
      brandName: r.brand_name,
      impersonationRiskLevel: r.impersonation_risk_level as any,
    }));
  }
}
