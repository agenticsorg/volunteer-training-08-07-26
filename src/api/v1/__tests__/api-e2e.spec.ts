import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../database/prisma.service';

describe('API V1 E2E - Full Workflow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  const apiKey = 'test-api-key';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant' },
    });
    tenantId = tenant.id;

    // Create subscription and plan
    const plan = await prisma.plan.create({
      data: {
        name: 'Pro Plan',
        stripePriceId: 'price_test_pro',
        mailboxLimit: 5,
        llmTierCeiling: 'tier-3-frontier',
        features: { webhooks: true, advancedReporting: true },
        active: true,
      },
    });

    await prisma.subscription.create({
      data: {
        tenant_id: tenantId,
        currentPlanId: plan.id,
        status: 'active',
        stripeCustomerId: 'cus_test123',
      },
    });

    // Create usage meters
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await prisma.usageMeter.create({
      data: {
        tenant_id: tenantId,
        meterType: 'llm_tokens',
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        usageCount: 5000n,
        overageThreshold: 10000n,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.correctionRecord.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.messageLabel.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.ingestedMessage.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.mailboxConnection.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.usageMeter.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.subscription.deleteMany({ where: { tenant_id: tenantId } });
    await prisma.plan.deleteMany({ where: {} });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  describe('Full first-party UI workflow', () => {
    let mailboxConnectionId: string;
    let messageId: string;

    it('should connect a mailbox', async () => {
      const response = await app
        .getHttpServer()
        .post('/v1/mailbox-connections')
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId)
        .send({
          platform: 'gmail',
          auth_code: 'test-oauth-code-123',
        });

      expect(response.status).toBeLessThan(400);
      expect(response.body.connection_id).toBeTruthy();
      mailboxConnectionId = response.body.connection_id;
    });

    it('should list mailbox connections', async () => {
      const response = await app
        .getHttpServer()
        .get('/v1/mailbox-connections')
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBeLessThan(400);
      expect(response.body.connections).toBeDefined();
      expect(response.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should list classified messages', async () => {
      // Create test messages with classifications
      const mailboxConn = await prisma.mailboxConnection.findFirst({
        where: { tenant_id: tenantId },
      });

      if (mailboxConn) {
        const message = await prisma.ingestedMessage.create({
          data: {
            tenant_id: tenantId,
            message_id: 'test-msg-uuid',
            mailbox_id: mailboxConn.mailbox_id,
            platform_message_id: 'gmail-msg-123',
            platform: 'gmail',
            mailbox_connection_id: mailboxConn.id,
            normalized_envelope: {
              from: 'newsletter@example.com',
              subject: 'Weekly Newsletter',
              threadRef: 'thread-123',
            },
          },
        });

        messageId = message.id;

        // Add labels
        await prisma.messageLabel.create({
          data: {
            tenant_id: tenantId,
            message_id: messageId,
            category: 'MARKETING',
            confidence_score: 0.92,
            source_tier: 'rule',
            classifier_version: 'v1.0',
          },
        });
      }

      const response = await app
        .getHttpServer()
        .get('/v1/messages')
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId)
        .query({ limit: 50, offset: 0 });

      expect(response.status).toBeLessThan(400);
      expect(response.body.messages).toBeDefined();
      expect(response.body.limit).toBe(50);
    });

    it('should get message details with full classification', async () => {
      if (!messageId) {
        // Skip if message wasn't created
        return;
      }

      const response = await app
        .getHttpServer()
        .get(`/v1/messages/${messageId}`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBeLessThan(400);
      expect(response.body.id).toBe(messageId);
      expect(response.body.labels).toBeDefined();
      expect(response.body.priority_score).toBeDefined();
      expect(response.body.phishing_status).toBeDefined();
    });

    it('should submit an explicit correction', async () => {
      if (!messageId) {
        return;
      }

      const response = await app
        .getHttpServer()
        .post(`/v1/messages/${messageId}/corrections`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId)
        .send({
          message_id: messageId,
          context: 'classification',
          original_verdict: 'MARKETING',
          corrected_verdict: 'PERSONAL',
          reason: 'This is from a personal contact',
        });

      expect(response.status).toBeLessThan(400);
      expect(response.body.correction_id).toBeTruthy();

      // Verify correction was stored
      const correction = await prisma.correctionRecord.findUnique({
        where: { id: response.body.correction_id },
      });

      expect(correction).toBeDefined();
      expect(correction?.source).toBe('explicit_user_action');
      expect(correction?.state).toBe('confirmed');
    });

    it('should retrieve billing and usage information', async () => {
      const response = await app
        .getHttpServer()
        .get(`/v1/billing/${tenantId}`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBeLessThan(400);
      expect(response.body.subscription).toBeDefined();
      expect(response.body.subscription.status).toBe('active');
      expect(response.body.usage_meters).toBeDefined();
      expect(response.body.usage_meters.length).toBeGreaterThan(0);

      const llmMeter = response.body.usage_meters.find((m: any) => m.meter_type === 'llm_tokens');
      expect(llmMeter).toBeDefined();
      expect(llmMeter.usage_count).toBe(5000);
      expect(llmMeter.overage_threshold).toBe(10000);
    });

    it('should retrieve tenant configuration', async () => {
      const response = await app
        .getHttpServer()
        .get(`/v1/tenant-configuration/${tenantId}`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId);

      expect(response.status).toBeLessThan(400);
      expect(response.body.tenant_id).toBe(tenantId);
      expect(response.body.plan_tier).toBe('tier-3-frontier');
      expect(response.body.vip_list).toBeDefined();
      expect(response.body.digest_frequency).toBeDefined();
    });

    it('should allow updating VIP list', async () => {
      const response = await app
        .getHttpServer()
        .put(`/v1/tenant-configuration/${tenantId}/vip-list`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId)
        .send({
          entries: [
            { sender_address: 'boss@company.com', display_name: 'My Boss' },
            { sender_address: 'ceo@company.com', display_name: 'CEO' },
          ],
        });

      expect(response.status).toBeLessThan(400);
      expect(response.body.success).toBe(true);
    });

    it('should allow updating digest frequency', async () => {
      const response = await app
        .getHttpServer()
        .put(`/v1/tenant-configuration/${tenantId}/digest-frequency`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId)
        .send({
          frequency: 'weekly',
        });

      expect(response.status).toBeLessThan(400);
      expect(response.body.success).toBe(true);
    });

    it('should reject invalid digest frequency', async () => {
      const response = await app
        .getHttpServer()
        .put(`/v1/tenant-configuration/${tenantId}/digest-frequency`)
        .set('x-api-key', apiKey)
        .set('x-tenant-id', tenantId)
        .send({
          frequency: 'invalid-frequency',
        });

      expect(response.status).toBe(400);
    });
  });
});
