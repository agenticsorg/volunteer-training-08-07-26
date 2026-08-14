import {
  ThreatAssessment,
  AuthenticationSignal,
  LookalikeScore,
  IntentClassification,
  QuarantineDecision,
} from '../domain';

describe('ThreatAssessment Aggregate', () => {
  let assessment: ThreatAssessment;

  beforeEach(() => {
    assessment = ThreatAssessment.create('tenant-1', 'msg-123');
  });

  describe('Creation', () => {
    it('should create a new threat assessment', () => {
      expect(assessment.tenantId).toBe('tenant-1');
      expect(assessment.messageId).toBe('msg-123');
      expect(assessment.authenticationSignal).toBeNull();
      expect(assessment.lookalikeScore).toBeNull();
      expect(assessment.intentClassification).toBeNull();
    });
  });

  describe('Authentication Signal Assessment', () => {
    it('should accept authentication signal', () => {
      const authSignal = new AuthenticationSignal({
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        alignmentResult: 'aligned',
        displayNameBrandMatch: false,
      });

      assessment.assessAuthentication(authSignal);
      expect(assessment.authenticationSignal).toBe(authSignal);
      expect(assessment.highestTierReached).toBe('AuthCheck');
    });

    it('should trigger quarantine on DMARC failure', () => {
      const failedAuth = new AuthenticationSignal({
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'fail',
        alignmentResult: 'failed',
        displayNameBrandMatch: true,
      });

      assessment.assessAuthentication(failedAuth);
      expect(assessment.quarantineDecision.action).toBe('Quarantine');
      expect(assessment.quarantineDecision.isLocked()).toBe(true);
    });
  });

  describe('Lookalike Score Assessment', () => {
    it('should accept lookalike score', () => {
      const lookalike = new LookalikeScore({
        candidateDomain: 'gmail-phish.com',
        matchedBrand: 'gmail.com',
        editDistance: 1,
        homoglyphMatch: false,
        priorCorrespondenceWithDomain: false,
      });

      assessment.assessLookalike(lookalike);
      expect(assessment.lookalikeScore).toBe(lookalike);
      expect(assessment.highestTierReached).toBe('LookalikeCheck');
    });

    it('should flag on high lookalike risk', () => {
      const lookalike = new LookalikeScore({
        candidateDomain: 'gmail-phish.com',
        matchedBrand: 'gmail.com',
        editDistance: 1,
        homoglyphMatch: true,
        priorCorrespondenceWithDomain: false,
      });

      assessment.assessLookalike(lookalike);
      expect(assessment.quarantineDecision.action).toBe('Flag');
    });
  });

  describe('Intent Classification Assessment', () => {
    it('should accept intent classification', () => {
      const intent = new IntentClassification({
        intent: 'CredentialHarvesting',
        confidence: 0.85,
        justification: 'Fake login form detected',
      });

      assessment.assessIntentClassification(intent);
      expect(assessment.intentClassification).toBe(intent);
      expect(assessment.highestTierReached).toBe('IntentLlm');
    });

    it('should quarantine on high-confidence BEC intent', () => {
      const intent = new IntentClassification({
        intent: 'BEC',
        confidence: 0.9,
        justification: 'Urgency tactics and financial request detected',
      });

      assessment.assessIntentClassification(intent);
      expect(assessment.quarantineDecision.action).toBe('Quarantine');
    });

    it('should not change decision if assessment is locked', () => {
      const authSignal = new AuthenticationSignal({
        spf: 'fail',
        dkim: 'fail',
        dmarc: 'fail',
        alignmentResult: 'failed',
        displayNameBrandMatch: true,
      });

      assessment.assessAuthentication(authSignal);
      expect(assessment.quarantineDecision.isLocked()).toBe(true);

      const intent = new IntentClassification({
        intent: 'None',
        confidence: 0,
        justification: '',
      });

      expect(() => assessment.assessIntentClassification(intent)).toThrow();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize and deserialize', () => {
      const auth = new AuthenticationSignal({
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        alignmentResult: 'aligned',
        displayNameBrandMatch: false,
      });

      assessment.assessAuthentication(auth);
      const json = assessment.toJSON();
      const restored = ThreatAssessment.fromJSON(json);

      expect(restored.tenantId).toBe(assessment.tenantId);
      expect(restored.messageId).toBe(assessment.messageId);
    });
  });
});
