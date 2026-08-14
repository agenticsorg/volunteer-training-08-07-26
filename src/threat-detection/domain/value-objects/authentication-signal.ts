export type AuthCheckResult = 'pass' | 'fail' | 'none';

export class AuthenticationSignal {
  readonly spf: AuthCheckResult;
  readonly dkim: AuthCheckResult;
  readonly dmarc: AuthCheckResult;
  readonly alignmentResult: 'aligned' | 'partial' | 'failed' | 'none';
  readonly displayNameBrandMatch: boolean;

  constructor(props: {
    spf: AuthCheckResult;
    dkim: AuthCheckResult;
    dmarc: AuthCheckResult;
    alignmentResult: 'aligned' | 'partial' | 'failed' | 'none';
    displayNameBrandMatch: boolean;
  }) {
    this.spf = props.spf;
    this.dkim = props.dkim;
    this.dmarc = props.dmarc;
    this.alignmentResult = props.alignmentResult;
    this.displayNameBrandMatch = props.displayNameBrandMatch;
  }

  isHighRisk(): boolean {
    return this.dmarc === 'fail' || (this.displayNameBrandMatch && this.dmarc !== 'pass');
  }

  static empty(): AuthenticationSignal {
    return new AuthenticationSignal({
      spf: 'none',
      dkim: 'none',
      dmarc: 'none',
      alignmentResult: 'none',
      displayNameBrandMatch: false,
    });
  }

  toJSON() {
    return {
      spf: this.spf,
      dkim: this.dkim,
      dmarc: this.dmarc,
      alignmentResult: this.alignmentResult,
      displayNameBrandMatch: this.displayNameBrandMatch,
    };
  }

  static fromJSON(json: any): AuthenticationSignal {
    return new AuthenticationSignal({
      spf: json.spf ?? 'none',
      dkim: json.dkim ?? 'none',
      dmarc: json.dmarc ?? 'none',
      alignmentResult: json.alignmentResult ?? 'none',
      displayNameBrandMatch: json.displayNameBrandMatch ?? false,
    });
  }
}
