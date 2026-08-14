"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSecretsVaultAdapter = void 0;
const common_1 = require("@nestjs/common");
let MockSecretsVaultAdapter = class MockSecretsVaultAdapter {
    constructor() {
        this.vault = new Map();
    }
    async store(secret) {
        const handle = `vault_${Date.now()}_${Math.random()}`;
        this.vault.set(handle, secret);
        return handle;
    }
    async retrieve(handle) {
        const secret = this.vault.get(handle);
        if (!secret) {
            throw new Error(`Secret not found: ${handle}`);
        }
        return secret;
    }
    async delete(handle) {
        this.vault.delete(handle);
    }
};
exports.MockSecretsVaultAdapter = MockSecretsVaultAdapter;
exports.MockSecretsVaultAdapter = MockSecretsVaultAdapter = __decorate([
    (0, common_1.Injectable)()
], MockSecretsVaultAdapter);
//# sourceMappingURL=mock-secrets-vault.adapter.js.map