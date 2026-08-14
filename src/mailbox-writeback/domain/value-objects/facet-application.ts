import { v7 as uuid } from 'uuid';

export type FacetType = 'category' | 'threat' | 'contact' | 'priority';
export type ApplicationStatus = 'pending' | 'applied' | 'failed';

export class FacetApplication {
  private constructor(
    public readonly facetType: FacetType,
    public readonly desiredValue: any,
    public readonly lastKnownPlatformState: any,
    public readonly status: ApplicationStatus,
    public readonly lastAttemptAt: Date | null,
    public readonly retryCount: number,
  ) {}

  static create(
    facetType: FacetType,
    desiredValue: any,
    lastKnownPlatformState: any = null,
  ): FacetApplication {
    return new FacetApplication(
      facetType,
      desiredValue,
      lastKnownPlatformState,
      'pending',
      null,
      0,
    );
  }

  static fromDb(data: any): FacetApplication {
    return new FacetApplication(
      data.facetType,
      data.desiredValue,
      data.lastKnownPlatformState,
      data.status,
      data.lastAttemptAt,
      data.retryCount,
    );
  }

  withStatus(status: ApplicationStatus, attemptAt: Date): FacetApplication {
    return new FacetApplication(
      this.facetType,
      this.desiredValue,
      this.lastKnownPlatformState,
      status,
      attemptAt,
      status === 'failed' ? this.retryCount + 1 : this.retryCount,
    );
  }

  withPlatformState(platformState: any): FacetApplication {
    return new FacetApplication(
      this.facetType,
      this.desiredValue,
      platformState,
      this.status,
      this.lastAttemptAt,
      this.retryCount,
    );
  }

  isIdempotent(): boolean {
    return (
      this.status === 'applied' &&
      JSON.stringify(this.desiredValue) ===
        JSON.stringify(this.lastKnownPlatformState)
    );
  }

  toDb(): Record<string, any> {
    return {
      facetType: this.facetType,
      desiredValue: this.desiredValue,
      lastKnownPlatformState: this.lastKnownPlatformState,
      status: this.status,
      lastAttemptAt: this.lastAttemptAt,
      retryCount: this.retryCount,
    };
  }
}
