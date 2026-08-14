import { VerdictSnapshot } from '../value-objects/verdict-snapshot';
import { CorrectionSource } from '../value-objects/correction-evidence';

export class UserCorrectionObserved {
  constructor(
    public readonly tenantId: string,
    public readonly messageId: string,
    public readonly source: CorrectionSource,
    public readonly verdictSnapshot: VerdictSnapshot,
    public readonly observedAt: Date,
  ) {}
}
