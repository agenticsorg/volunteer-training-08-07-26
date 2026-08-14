"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageEnvelopeSchema = exports.MessageEnvelopeFactory = void 0;
class MessageEnvelopeFactory {
    static create(data) {
        if (!data.messageId || !data.from || !data.to || !data.platform || !data.sentAt) {
            throw new Error('MessageEnvelope missing required fields');
        }
        return {
            messageId: data.messageId,
            threadRef: data.threadRef,
            platform: data.platform,
            from: data.from,
            to: data.to,
            cc: data.cc || [],
            bcc: data.bcc || [],
            subject: data.subject || '',
            sentAt: data.sentAt,
            hasCalendarPart: data.hasCalendarPart || false,
            calendarMethodType: data.calendarMethodType,
            listUnsubscribe: data.listUnsubscribe,
            listId: data.listId,
            precedence: data.precedence,
            autoSubmitted: data.autoSubmitted,
            spfPass: data.spfPass,
            dkimPass: data.dkimPass,
            dmarcPass: data.dmarcPass,
            attachmentSummaries: data.attachmentSummaries || [],
        };
    }
    static validate(envelope) {
        return MessageEnvelopeFactory.create(envelope);
    }
}
exports.MessageEnvelopeFactory = MessageEnvelopeFactory;
exports.MessageEnvelopeSchema = {};
//# sourceMappingURL=message-envelope.js.map