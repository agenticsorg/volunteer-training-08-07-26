"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const health_controller_1 = require("./health.controller");
describe('HealthController', () => {
    let controller;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [health_controller_1.HealthController],
        }).compile();
        controller = module.get(health_controller_1.HealthController);
    });
    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
    it('should return health status', () => {
        const result = controller.check();
        expect(result).toHaveProperty('status', 'ok');
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('tenant_context', 'available');
        expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });
});
//# sourceMappingURL=health.controller.spec.js.map