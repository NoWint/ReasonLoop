import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requestIdMiddleware(request: FastifyRequest, reply: FastifyReply) {
  reply.header('x-reasonloop-request-id', request.id);
}

export async function errorHandler(error: Error, _request: FastifyRequest, reply: FastifyReply) {
  reply.status(500).send({
    error: { message: error.message, type: 'reasonloop_error' },
  });
}
