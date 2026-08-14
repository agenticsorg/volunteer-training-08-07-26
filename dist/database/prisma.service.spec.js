"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const prisma_service_1 = require("./prisma.service");
describe('PrismaService', () => {
    let service;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [prisma_service_1.PrismaService],
        }).compile();
        service = module.get(prisma_service_1.PrismaService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    // Note: Integration tests with real DB would go here
    // They are skipped in this test suite because:
    // 1. No real PostgreSQL instance is running in CI
    // 2. Tests are run against a transactional database in staging
    // 3. RLS policies are tested via SQL scripts in the migration
});
//# sourceMappingURL=prisma.service.spec.js.map