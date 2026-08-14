"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantSubscriptionModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("@database/database.module");
const subscription_controller_1 = require("./presentation/subscription.controller");
const subscription_repository_1 = require("./infrastructure/repositories/subscription.repository");
const usage_meter_repository_1 = require("./infrastructure/repositories/usage-meter.repository");
const plan_catalog_repository_1 = require("./infrastructure/repositories/plan-catalog.repository");
const stripe_adapter_1 = require("./infrastructure/adapters/stripe.adapter");
const event_publisher_service_1 = require("./application/event-publisher.service");
let TenantSubscriptionModule = class TenantSubscriptionModule {
};
exports.TenantSubscriptionModule = TenantSubscriptionModule;
exports.TenantSubscriptionModule = TenantSubscriptionModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [subscription_controller_1.SubscriptionController],
        providers: [
            subscription_repository_1.SubscriptionRepository,
            usage_meter_repository_1.UsageMeterRepository,
            plan_catalog_repository_1.PlanCatalogRepository,
            stripe_adapter_1.StripeAdapter,
            event_publisher_service_1.EventPublisherService,
            {
                provide: 'BillingProviderAdapter',
                useClass: stripe_adapter_1.StripeAdapter,
            },
        ],
        exports: [subscription_repository_1.SubscriptionRepository, usage_meter_repository_1.UsageMeterRepository, plan_catalog_repository_1.PlanCatalogRepository, stripe_adapter_1.StripeAdapter, event_publisher_service_1.EventPublisherService],
    })
], TenantSubscriptionModule);
//# sourceMappingURL=tenant-subscription.module.js.map