"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const logger_1 = require("./observability/logger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.useGlobalInterceptors();
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger_1.logger.info({ port }, 'Application started');
}
bootstrap().catch(err => {
    logger_1.logger.error(err, 'Bootstrap error');
    process.exit(1);
});
//# sourceMappingURL=main.js.map