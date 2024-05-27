import fastifyCors, { FastifyCorsOptions } from '@fastify/cors';
import fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { keygenRoute } from '../api/keygen';
import { p2pRoutes } from '../api/p2p';
import Configs from '../configs/Configs';
import WinstonLogger from '@rosen-bridge/winston-logger';
import rateLimit from '@fastify/rate-limit';

const logger = WinstonLogger.getInstance().getLogger(import.meta.url);

/**
 * initialize api server
 * setup swagger on it
 * register all routers
 * then start it
 */
let apiServer: FastifyInstance;
const initApiServer = async () => {
  apiServer = fastify({
    bodyLimit: Configs.apiBodyLimit,
  }).withTypeProvider<TypeBoxTypeProvider>();

  if (Configs.apiAllowedOrigins.includes('*')) {
    await apiServer.register(fastifyCors, {});
  } else {
    await apiServer.register(fastifyCors, () => {
      return (
        req: FastifyRequest,
        callback: (
          error: Error | null,
          corsOptions?: FastifyCorsOptions
        ) => void
      ) => {
        if (
          req.headers.origin &&
          Configs.apiAllowedOrigins.filter((item) =>
            req.headers.origin?.includes(item)
          ).length > 0
        ) {
          callback(null, { origin: true });
        }
        callback(null, { origin: false });
      };
    });
  }

  await apiServer.register(swagger, {
    openapi: {
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'Api-Key',
            in: 'header',
          },
        },
      },
    },
  });

  await apiServer.register(swaggerUi, {
    routePrefix: '/swagger',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  await apiServer.register(rateLimit, {
    max: Configs.apiMaxRequestsPerMinute,
    timeWindow: '1 minute',
  });

  await apiServer.register(p2pRoutes);
  await apiServer.register(keygenRoute);
  apiServer.get('/', (request, reply) => {
    reply.redirect('/swagger');
  });
  const port = Configs.apiPort;
  const host = Configs.apiHost;

  await apiServer.listen({ host, port });
  logger.info(`api service started at http://${host}:${port}`);
};

export { initApiServer, apiServer };
