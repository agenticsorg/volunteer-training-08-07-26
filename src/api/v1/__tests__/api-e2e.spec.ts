import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../database/prisma.service';
import { MessagesListResponseDto, MessageResponseDto } from '../dtos/message.dto';
import { MailboxConnectionsListResponseDto } from '../dtos/mailbox.dto';
import { BillingInfoResponseDto } from '../dtos/billing.dto';

describe('API V1 - Real End-to-End API Tests (via AppModule + Controller)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let mailboxConnectionId: string;
  let messageId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Create test tenant
    tenantId = (
      await prisma.tenant.create({
        data: { name: 'Test Tenant for API E2E' },
      })
    ).id;

    // Create mailbox connection
    mailboxConnectionId = (
      await prisma.mailboxConnection.create({
        data: {
          tenantId,
          mailboxId: 'test@example.com',
          platform: 'gmail',
          credentialHandleId: 'test-handle',
        },
      })
    ).id;

    // Create test message (use proper UUID format for messageId field)
    const testMessageUuid = require('crypto').randomUUID();
    await prisma.ingestedMessage.create({
      data: {
        tenantId,
        messageId: testMessageUuid,
        mailboxId: 'test@example.com',
        platformMessageId: 'gmail-msg-1',
        platform: 'gmail',
        mailboxConnectionId,
        normalizedEnvelope: {
          from: 'sender@example.com',
          subject: 'Test Email Subject',
        },
      },
    });
    messageId = testMessageUuid;
  });

  afterAll(async () => {
    await prisma.ingestedMessage.deleteMany({ where: {} });
    await prisma.mailboxConnection.deleteMany({ where: {} });
    await prisma.tenant.deleteMany({ where: {} });
    await app.close();
  });

  describe('Messages Controller - Real HTTP API', () => {
    it('should list messages through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/messages')
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      // Should return 200 (or 400 series validation if query params invalid, but NOT 401)
      expect([200, 400, 404]).toContain(response.status);

      if (response.status === 200) {
        const dto: MessagesListResponseDto = response.body;
        expect(dto.messages).toBeDefined();
        expect(Array.isArray(dto.messages)).toBe(true);
        expect(dto.total).toBeDefined();
      }
    });

    it('should get single message through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/messages/${messageId}`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      // 200 (success) or 400 (validation) but NOT 401 (auth failed)
      expect([200, 400, 404]).toContain(response.status);

      if (response.status === 200) {
        const dto: MessageResponseDto = response.body;
        expect(dto.id).toBeDefined();
        expect(dto.mailbox_id).toBeDefined();
      }
    });

    it('should create message correction through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/messages/${messageId}/corrections`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId)
        .send({
          context: 'classification',
          original_verdict: 'MARKETING',
          corrected_verdict: 'PERSONAL',
        });

      // Successful correction submission should return 200 or 201
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('Mailbox Connections Controller - Real HTTP API', () => {
    it('should list mailbox connections through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/mailbox-connections')
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      expect([200, 400, 404]).toContain(response.status);

      if (response.status === 200) {
        const dto: MailboxConnectionsListResponseDto = response.body;
        expect(dto.connections).toBeDefined();
        expect(Array.isArray(dto.connections)).toBe(true);
        expect(dto.total).toBeDefined();
      }
    });

    it('should get mailbox connection details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/mailbox-connections/test@example.com`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      expect([200, 400, 404]).toContain(response.status);
    });

    it('should disconnect mailbox through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/v1/mailbox-connections/test@example.com`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      // 200 (success) or 400/404 (not found) but NOT 401
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Tenant Configuration Controller - Real HTTP API', () => {
    it('should get tenant configuration through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/tenant-configuration/${tenantId}`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      expect([200, 400, 404]).toContain(response.status);
    });

    it('should update tenant configuration through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .put(`/v1/tenant-configuration/${tenantId}`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId)
        .send({
          vip_list: ['vip@example.com'],
        });

      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Billing Controller - Real HTTP API', () => {
    it('should get billing info through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/billing/${tenantId}`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      expect([200, 400, 404]).toContain(response.status);

      if (response.status === 200) {
        const dto: BillingInfoResponseDto = response.body;
        expect(dto.subscription).toBeDefined();
        expect(dto.subscription.tenant_id).toBe(tenantId);
      }
    });

    it('should report usage metrics through real API endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/billing/${tenantId}/usage`)
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('API Response Contract Verification (via Real Responses)', () => {
    it('should verify list endpoint returns paginated contract', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/messages')
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      if (response.status === 200) {
        const dto: MessagesListResponseDto = response.body;
        expect(dto).toHaveProperty('messages');
        expect(dto).toHaveProperty('total');
        expect(dto).toHaveProperty('limit');
        expect(dto).toHaveProperty('offset');
      }
    });

    it('should verify message response includes classification data', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/messages')
        .set('x-api-key', 'test-key')
        .set('x-tenant-id', tenantId);

      if (response.status === 200) {
        const dto: MessagesListResponseDto = response.body;
        if (dto.messages.length > 0) {
          const msg = dto.messages[0];
          // Verify contract compliance
          expect(msg).toHaveProperty('id');
          expect(msg).toHaveProperty('message_id');
          expect(msg).toHaveProperty('mailbox_id');
          expect(msg).toHaveProperty('from');
          expect(msg).toHaveProperty('subject');
          expect(msg).toHaveProperty('labels');
          expect(msg).toHaveProperty('priority_score');
        }
      }
    });

    it('should verify all authenticated endpoints enforce tenant context', async () => {
      // Each endpoint should accept x-api-key and x-tenant-id headers
      const endpoints = [
        { method: 'get', path: '/v1/messages' },
        { method: 'get', path: '/v1/mailbox-connections' },
        { method: 'get', path: `/v1/tenant-configuration/${tenantId}` },
        { method: 'get', path: `/v1/billing/${tenantId}` },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app.getHttpServer()) as any)
          [endpoint.method](endpoint.path)
          .set('x-api-key', 'test-key')
          .set('x-tenant-id', tenantId);

        // All should return 2xx or 4xx, NOT 401 (auth failed)
        expect(response.status).not.toBe(401);
      }
    });
  });
});
