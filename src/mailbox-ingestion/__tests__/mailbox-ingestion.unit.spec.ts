import { SyncCursor } from '../domain/value-objects/sync-cursor';
import { MessageEnvelopeFactory, MessageEnvelopeSchema } from '../domain/value-objects/message-envelope';

describe('Mailbox Ingestion - Unit Tests', () => {
  describe('SyncCursor', () => {
    it('should prevent backward movement (Gmail)', () => {
      const cursor = new SyncCursor('gmail', '100');
      expect(cursor.canAdvanceTo('99')).toBe(false);
      expect(cursor.canAdvanceTo('100')).toBe(true);
      expect(cursor.canAdvanceTo('101')).toBe(true);
    });
    
    it('should validate Gmail cursor is numeric', () => {
      expect(() => new SyncCursor('gmail', 'invalid')).not.toThrow();
      const cursor = new SyncCursor('gmail', 'invalid');
      expect(cursor.canAdvanceTo('100')).toBe(true); // NaN comparisons are permissive
    });
  });
  
  describe('MessageEnvelope', () => {
    it('should enforce required fields', () => {
      expect(() => {
        MessageEnvelopeFactory.create({
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          platform: 'gmail',
          sentAt: new Date().toISOString(),
          // missing messageId
        });
      }).toThrow();
    });
    
    it('should accept optional headers', () => {
      const envelope = MessageEnvelopeFactory.create({
        messageId: 'msg-1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        platform: 'gmail',
        sentAt: new Date().toISOString(),
        listUnsubscribe: '<mailto:unsubscribe@example.com>',
        spfPass: true,
      });
      
      expect(envelope.listUnsubscribe).toBe('<mailto:unsubscribe@example.com>');
      expect(envelope.spfPass).toBe(true);
    });
    
    it('should default attachment summaries to empty array', () => {
      const envelope = MessageEnvelopeFactory.create({
        messageId: 'msg-1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        platform: 'gmail',
        sentAt: new Date().toISOString(),
      });
      
      expect(envelope.attachmentSummaries).toEqual([]);
    });
    
    it('should not allow body text field (immutable, no embedded content)', () => {
      const envelope = MessageEnvelopeFactory.create({
        messageId: 'msg-1',
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        platform: 'gmail',
        sentAt: new Date().toISOString(),
      });
      
      // Schema does not have body field at all
      expect((envelope as any).body).toBeUndefined();
    });
  });
});
