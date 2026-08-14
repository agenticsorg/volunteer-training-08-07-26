"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestedMessageRepository = void 0;
const common_1 = require("@nestjs/common");
let IngestedMessageRepository = class IngestedMessageRepository {
    constructor() {
        this.storage = new Map();
    }
    async findByPlatformMessageId(tenantId, platformMessageId, platform, mailboxId) {
        const key = `${tenantId}:${platformMessageId}:${platform}:${mailboxId}`;
        return this.storage.get(key);
    }
    async save(data) {
        const key = `${data.tenantId}:${data.platformMessageId}:${data.platform}:${data.mailboxId}`;
        if (this.storage.has(key)) {
            return this.storage.get(key);
        }
        this.storage.set(key, data);
        return data;
    }
    async findById(id) {
        for (const msg of this.storage.values()) {
            if (msg.id === id)
                return msg;
        }
        return null;
    }
};
exports.IngestedMessageRepository = IngestedMessageRepository;
exports.IngestedMessageRepository = IngestedMessageRepository = __decorate([
    (0, common_1.Injectable)()
], IngestedMessageRepository);
//# sourceMappingURL=ingested-message.repository.js.map