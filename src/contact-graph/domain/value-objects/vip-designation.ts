export class VipDesignation {
  readonly isVip: boolean;
  readonly source: 'manual' | 'autoPromoted';
  readonly promotedAt?: Date;

  constructor(isVip: boolean, source: 'manual' | 'autoPromoted', promotedAt?: Date) {
    this.isVip = isVip;
    this.source = source;
    this.promotedAt = promotedAt;
  }
}
