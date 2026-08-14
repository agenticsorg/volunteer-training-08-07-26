"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailboxConnectionRepository = void 0;
const common_1 = require("@nestjs/common");
let MailboxConnectionRepository = class MailboxConnectionRepository {
    constructor() {
        this.storage = new Map();
    }
    async findByTenantIdAndMailboxId(tenantId, mailboxId, platform) {
        const key = `${tenantId}:${mailboxId}:${platform}`;
        return this.storage.get(key);
    }
    async updateSyncCursor(id, cursorValue) {
        return { id, syncCursorValue: cursorValue, lastSyncAt: new Date() };
    }
    async incrementFailureCount(id) {
        return { id, syncFailureCount: 1 };
    }
    async save(data) {
        const key = `${data.tenantId}:${data.mailboxId}:${data.platform}`;
        this.storage.set(key, data);
        return data;
    }
};
exports.MailboxConnectionRepository = MailboxConnectionRepository;
exports.MailboxConnectionRepository = MailboxConnectionRepository = __decorate([
    (0, common_1.Injectable)()
], MailboxConnectionRepository);
//# sourceMappingURL=mailbox-connection.repository.js.map