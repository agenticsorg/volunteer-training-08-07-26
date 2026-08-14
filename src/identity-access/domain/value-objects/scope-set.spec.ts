import { ScopeSet } from './scope-set';

describe('ScopeSet', () => {
  describe('Gmail scopes', () => {
    it('should create with minimal Gmail scopes', () => {
      const scopes = new ScopeSet(['gmail.modify', 'gmail.labels'], 'gmail');
      expect(scopes.toArray()).toEqual(['gmail.modify', 'gmail.labels']);
    });

    it('should reject Gmail with too few scopes', () => {
      expect(() => new ScopeSet(['gmail.modify'], 'gmail')).toThrow();
    });

    it('should reject Gmail with extra scopes', () => {
      expect(() =>
        new ScopeSet(['gmail.modify', 'gmail.labels', 'gmail.send'], 'gmail'),
      ).toThrow();
    });

    it('should use minimal Gmail factory', () => {
      const scopes = ScopeSet.minimalGmail();
      expect(scopes.toArray()).toEqual(['gmail.modify', 'gmail.labels']);
    });
  });

  describe('Outlook scopes', () => {
    it('should create with minimal Outlook scopes', () => {
      const scopes = new ScopeSet(
        ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'],
        'outlook',
      );
      expect(scopes.toArray()).toContain('Mail.ReadWrite');
      expect(scopes.toArray()).toContain('MailboxSettings.ReadWrite');
    });

    it('should reject Outlook with too few scopes', () => {
      expect(() => new ScopeSet(['Mail.ReadWrite'], 'outlook')).toThrow();
    });

    it('should reject Outlook with extra scopes', () => {
      expect(
        () =>
          new ScopeSet(
            ['Mail.ReadWrite', 'MailboxSettings.ReadWrite', 'Calendars.Read'],
            'outlook',
          ),
      ).toThrow();
    });

    it('should use minimal Outlook factory', () => {
      const scopes = ScopeSet.minimalOutlook();
      expect(scopes.toArray()).toContain('Mail.ReadWrite');
      expect(scopes.toArray()).toContain('MailboxSettings.ReadWrite');
    });
  });

  describe('Equality', () => {
    it('should compare equal scope sets', () => {
      const s1 = ScopeSet.minimalGmail();
      const s2 = ScopeSet.minimalGmail();
      expect(s1.equals(s2)).toBe(true);
    });

    it('should compare unequal scope sets', () => {
      const s1 = ScopeSet.minimalGmail();
      const s2 = ScopeSet.minimalOutlook();
      expect(s1.equals(s2)).toBe(false);
    });
  });
});
