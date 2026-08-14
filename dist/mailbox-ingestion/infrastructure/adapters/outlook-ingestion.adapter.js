"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutlookIngestionAdapter = void 0;
const common_1 = require("@nestjs/common");
const value_objects_1 = require("../../domain/value-objects");
let OutlookIngestionAdapter = class OutlookIngestionAdapter {
    async establishWatch(mailboxId, accessToken) {
        return {
            subscriptionId: `outlook-sub-${Date.now()}`,
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        };
    }
    async renewWatch(mailboxId, subscriptionId, accessToken) {
        return {
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        };
    }
    async pullDelta(mailboxId, accessToken, cursorValue) {
        return {
            messages: [],
            newCursor: `deltaLink-${Date.now()}`,
        };
    }
    async fetchMessage(mailboxId, messageId, accessToken) {
        return value_objects_1.MessageEnvelopeFactory.create({
            messageId,
            from: 'sender@example.com',
            to: [mailboxId],
            subject: 'Test Message',
            platform: 'outlook',
            sentAt: new Date().toISOString(),
        });
    }
};
exports.OutlookIngestionAdapter = OutlookIngestionAdapter;
exports.OutlookIngestionAdapter = OutlookIngestionAdapter = __decorate([
    (0, common_1.Injectable)()
], OutlookIngestionAdapter);
//# sourceMappingURL=outlook-ingestion.adapter.js.map