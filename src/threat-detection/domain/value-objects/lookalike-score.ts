export class LookalikeScore {
  readonly candidateDomain: string;
  readonly matchedBrand: string | null;
  readonly editDistance: number;
  readonly homoglyphMatch: boolean;
  readonly priorCorrespondenceWithDomain: boolean;
  readonly score: number; // 0.0 - 1.0, derived from above

  constructor(props: {
    candidateDomain: string;
    matchedBrand: string | null;
    editDistance: number;
    homoglyphMatch: boolean;
    priorCorrespondenceWithDomain: boolean;
  }) {
    this.candidateDomain = props.candidateDomain;
    this.matchedBrand = props.matchedBrand;
    this.editDistance = props.editDistance;
    this.homoglyphMatch = props.homoglyphMatch;
    this.priorCorrespondenceWithDomain = props.priorCorrespondenceWithDomain;
    this.score = this.computeScore();
  }

  private computeScore(): number {
    let score = 0;

    // Brand watchlist match is highest risk
    if (this.matchedBrand) {
      score += 0.6;
    }

    // Edit distance: lower distance = higher risk
    // Assume domain labels are max ~15 chars; edit distance <= 2 is suspicious
    if (this.editDistance <= 2 && this.editDistance >= 0) {
      score += Math.max(0.3 - this.editDistance * 0.1, 0);
    }

    // Homoglyph match (e.g., 0 vs O)
    if (this.homoglyphMatch) {
      score += 0.2;
    }

    // REDUCE risk if there's prior correspondence (legitimate domain)
    if (this.priorCorrespondenceWithDomain) {
      score = Math.max(0, score - 0.5);
    }

    return Math.min(1.0, score);
  }

  isHighRisk(): boolean {
    return this.score > 0.7;
  }

  static empty(): LookalikeScore {
    return new LookalikeScore({
      candidateDomain: '',
      matchedBrand: null,
      editDistance: 999,
      homoglyphMatch: false,
      priorCorrespondenceWithDomain: false,
    });
  }

  toJSON() {
    return {
      candidateDomain: this.candidateDomain,
      matchedBrand: this.matchedBrand,
      editDistance: this.editDistance,
      homoglyphMatch: this.homoglyphMatch,
      priorCorrespondenceWithDomain: this.priorCorrespondenceWithDomain,
      score: this.score,
    };
  }

  static fromJSON(json: any): LookalikeScore {
    return new LookalikeScore({
      candidateDomain: json.candidateDomain ?? '',
      matchedBrand: json.matchedBrand ?? null,
      editDistance: json.editDistance ?? 999,
      homoglyphMatch: json.homoglyphMatch ?? false,
      priorCorrespondenceWithDomain: json.priorCorrespondenceWithDomain ?? false,
    });
  }
}
