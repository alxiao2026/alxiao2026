import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import * as express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { HttpStatusInterceptor } from '@/interceptors/http-status.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';

function parsePort(): number {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1 && args[portIndex + 1]) {
    const port = parseInt(args[portIndex + 1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 3000;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 配置 Multer 用于文件上传
  app.useBodyParser('urlencoded', { limit: '50mb', extended: true });

  // 全局拦截器：统一将 POST 请求的 201 状态码改为 200
  app.useGlobalInterceptors(new HttpStatusInterceptor());
  // 1. 开启优雅关闭 Hooks (关键!)
  app.enableShutdownHooks();

  // 托管 PC 管理后台静态资源（admin 构建产物），访问路径 /admin
  // dev 环境 cwd=server；生产 deploy_run.sh 中 cwd=server/dist
  const adminCandidates = [
    join(process.cwd(), 'public', 'admin'),
    join(process.cwd(), '..', 'public', 'admin'),
    join(__dirname, '..', 'public', 'admin'),
  ];
  const adminDir = adminCandidates.find((d) => existsSync(join(d, 'index.html')));
  if (adminDir) {
    app.useStaticAssets(adminDir, { prefix: '/admin' });
    console.log(`[Admin] PC 管理后台已托管: /admin -> ${adminDir}`);
  } else {
    console.log('[Admin] 未找到管理后台构建产物，跳过静态托管');
  }

  // 2. 解析端口
  const port = parsePort();
  try {
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 \({port} 被占用! 请运行 'npx kill-port \){port}' 然后重试。`);
      process.exit(1);
    } else {
      throw err;
    }
  }
  console.log(`Application is running on: http://localhost:3000`);
}
bootstrap();
