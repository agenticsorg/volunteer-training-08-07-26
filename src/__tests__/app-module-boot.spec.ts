import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';

describe('AppModule boot check', () => {
  it('should compile and boot', async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(m).toBeDefined();
  });
});
