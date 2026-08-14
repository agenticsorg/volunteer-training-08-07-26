"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GmailIngestionAdapter = void 0;
const common_1 = require("@nestjs/common");
const value_objects_1 = require("../../domain/value-objects");
let GmailIngestionAdapter = class GmailIngestionAdapter {
    async establishWatch(mailboxId, accessToken) {
        // Mock: Real implementation would call gmail.users.watch
        return {
            subscriptionId: `gmail-watch-${Date.now()}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
    }
    async renewWatch(mailboxId, subscriptionId, accessToken) {
        return {
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
    }
    async pullDelta(mailboxId, accessToken, cursorValue) {
        // Mock: Real implementation would call gmail.users.messages.list with historyId
        const historyId = parseInt(cursorValue, 10) || 0;
        return {
            messages: [],
            newCursor: String(historyId + 1),
        };
    }
    async fetchMessage(mailboxId, messageId, accessToken) {
        // Mock: Real implementation parses MIME, extracts headers
        return value_objects_1.MessageEnvelopeFactory.create({
            messageId,
            from: 'sender@example.com',
            to: [mailboxId],
            subject: 'Test Message',
            platform: 'gmail',
            sentAt: new Date().toISOString(),
        });
    }
};
exports.GmailIngestionAdapter = GmailIngestionAdapter;
exports.GmailIngestionAdapter = GmailIngestionAdapter = __decorate([
    (0, common_1.Injectable)()
], GmailIngestionAdapter);
//# sourceMappingURL=gmail-ingestion.adapter.js.map