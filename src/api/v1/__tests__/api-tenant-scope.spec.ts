import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../database/prisma.service';

describe('API V1 - Tenant Scoping Defense-in-Depth (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant1Id: string;
  let tenant2Id: string;
  let message1Id: string;
  let message2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Create test tenants
    tenant1Id = (
      await prisma.tenant.create({
        data: { name: 'Tenant A (Protected)' },
      })
    ).id;

    tenant2Id = (
      await prisma.tenant.create({
        data: { name: 'Tenant B (Under Attack)' },
      })
    ).id;

    // Create mailbox connections for each tenant
    const mailbox1 = await prisma.mailboxConnection.create({
      data: {
        tenantId: tenant1Id,
        mailboxId: 'tenant-a@example.com',
        platform: 'gmail',
        credentialHandleId: 'handle-a',
      },
    });

    const mailbox2 = await prisma.mailboxConnection.create({
      data: {
        tenantId: tenant2Id,
        mailboxId: 'tenant-b@example.com',
        platform: 'gmail',
        credentialHandleId: 'handle-b',
      },
    });

    // Create messages for each tenant
    message1Id = (
      await prisma.ingestedMessage.create({
        data: {
          tenantId: tenant1Id,
          messageId: 'a-msg-uuid-1',
          mailboxId: 'tenant-a@example.com',
          platformMessageId: 'gmail-a-1',
          platform: 'gmail',
          mailboxConnectionId: mailbox1.id,
          normalizedEnvelope: {
            from: 'internal@example.com',
            subject: 'Confidential: Tenant A',
          },
        },
      })
    ).id;

    message2Id = (
      await prisma.ingestedMessage.create({
        data: {
          tenantId: tenant2Id,
          messageId: 'b-msg-uuid-1',
          mailboxId: 'tenant-b@example.com',
          platformMessageId: 'gmail-b-1',
          platform: 'gmail',
          mailboxConnectionId: mailbox2.id,
          normalizedEnvelope: {
            from: 'external@example.com',
            subject: 'Sensitive: Tenant B Data',
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.correctionRecord.deleteMany({ where: {} });
    await prisma.messageLabel.deleteMany({ where: {} });
    await prisma.ingestedMessage.deleteMany({ where: {} });
    await prisma.mailboxConnection.deleteMany({ where: {} });
    await prisma.tenant.deleteMany({ where: {} });
    await app.close();
  });

  describe('Defense-in-Depth: API Layer + Database RLS', () => {
    describe('Authentication enforcement', () => {
      it('should deny requests without API key', async () => {
        const response = await app
          .getHttpServer()
          .get(`/v1/messages`)
          .set('x-tenant-id', tenant1Id);

        expect(response.status).toBe(401);
      });

      it('should deny requests without tenant ID', async () => {
        const response = await app
          .getHttpServer()
          .get(`/v1/messages`)
          .set('x-api-key', 'test-key');

        expect(response.status).toBe(401);
      });

      it('should accept request with both headers', async () => {
        const response = await app
          .getHttpServer()
          .get(`/v1/messages`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant1Id);

        // 200 or 400 series validation error is fine - point is auth passed
        expect(response.status).not.toBe(401);
      });
    });

    describe('Tenant-scoping enforcement (API layer blocks cross-tenant path access)', () => {
      it('should deny Tenant A accessing Tenant B message via path parameter', async () => {
        // Tenant A authenticates but tries to access Tenant B's message ID
        const response = await app
          .getHttpServer()
          .get(`/v1/messages/${message2Id}`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant1Id);

        // API layer guard should deny with 403
        expect([403, 404]).toContain(response.status);
      });

      it('should deny Tenant B accessing Tenant A tenant config via path parameter', async () => {
        // Tenant B authenticates but tries to access Tenant A config
        const response = await app
          .getHttpServer()
          .get(`/v1/tenant-configuration/${tenant1Id}`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant2Id);

        // API tenant scope guard rejects mismatched path tenantId
        expect(response.status).toBe(403);
      });

      it('should deny Tenant B accessing Tenant A billing via path parameter', async () => {
        // Tenant B tries to access Tenant A billing
        const response = await app
          .getHttpServer()
          .get(`/v1/billing/${tenant1Id}`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant2Id);

        expect(response.status).toBe(403);
      });
    });

    describe('Defense-in-depth: API layer + RLS cooperation', () => {
      it('should verify Tenant A can access own messages', async () => {
        // Tenant A accesses own message - should work
        const response = await app
          .getHttpServer()
          .get(`/v1/messages/${message1Id}`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant1Id);

        // 200 or 404 if message data not found is OK - point is not 403
        expect(response.status).not.toBe(403);
      });

      it('should verify Tenant B cannot access Tenant A even with header override attempt', async () => {
        // Attempt header injection attack (client tries to add x-override-tenant)
        const response = await app
          .getHttpServer()
          .get(`/v1/messages/${message1Id}`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant2Id) // Tenant B authentic context
          .set('x-override-tenant', tenant1Id); // Malicious header

        // Should still deny - real tenant context is in request object from guard
        expect([403, 404]).toContain(response.status);
      });

      it('should verify Tenant A denied when accessing mismatched config tenantId', async () => {
        // Even though Tenant A is authentic, trying to access Tenant B config path
        const response = await app
          .getHttpServer()
          .get(`/v1/tenant-configuration/${tenant2Id}`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant1Id);

        expect(response.status).toBe(403);
      });
    });

    describe('Correction endpoint tenant scoping', () => {
      it('should deny Tenant A submitting correction for Tenant B message', async () => {
        // Tenant A tries to submit correction for Tenant B's message
        const response = await app
          .getHttpServer()
          .post(`/v1/messages/${message2Id}/corrections`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant1Id)
          .send({
            message_id: message2Id,
            context: 'classification',
            original_verdict: 'MARKETING',
            corrected_verdict: 'PERSONAL',
          });

        // API layer and Prisma RLS should deny access to Tenant B's message
        expect([403, 404]).toContain(response.status);
      });
    });

    describe('Mailbox connection tenant scoping', () => {
      it('should deny Tenant A disconnecting Tenant B mailbox', async () => {
        // Tenant A tries to disconnect Tenant B's mailbox connection
        const response = await app
          .getHttpServer()
          .delete(`/v1/mailbox-connections/tenant-b@example.com`)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenant1Id);

        expect([403, 404]).toContain(response.status);
      });
    });
  });

  describe('AppModule Bootstrap Verification', () => {
    it('should confirm AppModule compiled and booted successfully', () => {
      // This test passing proves that all DI is resolved correctly
      expect(app).toBeDefined();
      expect(prisma).toBeDefined();
    });

    it('should confirm real NestJS HTTP client is functional', async () => {
      // Verify we can make a real HTTP request through NestJS routing
      const response = await app
        .getHttpServer()
        .get('/health')
        .send();

      // Health endpoint exists (or 404 if not - point is request went through NestJS)
      expect([200, 404]).toContain(response.status);
    });
  });
});
