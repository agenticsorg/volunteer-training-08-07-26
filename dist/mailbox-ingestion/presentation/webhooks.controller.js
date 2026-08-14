"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhooksController = void 0;
const common_1 = require("@nestjs/common");
const webhook_worker_1 = require("../infrastructure/queue/webhook.worker");
let WebhooksController = class WebhooksController {
    constructor(webhookWorker) {
        this.webhookWorker = webhookWorker;
    }
    async handleGmailWebhook(payload) {
        const { email } = payload;
        if (email) {
            await this.webhookWorker.handleWebhook('tenant-id', email, 'gmail');
        }
        return { status: 'received' };
    }
    async handleOutlookWebhook(payload) {
        const { mailboxId } = payload;
        if (mailboxId) {
            await this.webhookWorker.handleWebhook('tenant-id', mailboxId, 'outlook');
        }
        return { status: 'received' };
    }
};
exports.WebhooksController = WebhooksController;
__decorate([
    (0, common_1.Post)('gmail'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "handleGmailWebhook", null);
__decorate([
    (0, common_1.Post)('outlook'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WebhooksController.prototype, "handleOutlookWebhook", null);
exports.WebhooksController = WebhooksController = __decorate([
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [webhook_worker_1.WebhookWorker])
], WebhooksController);
//# sourceMappingURL=webhooks.controller.js.map