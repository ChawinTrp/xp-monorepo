import { UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ApiKeyGuard } from './api-key.guard';

function httpContext(authHeader?: string) {
  return {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
      }),
    }),
  } as any;
}

describe('ApiKeyGuard', () => {
  const reflector = (isPublic: boolean) =>
    ({ getAllAndOverride: () => isPublic }) as any;

  afterEach(() => {
    delete process.env.XP_API_KEY;
    jest.restoreAllMocks();
  });

  it('allows everything when XP_API_KEY is unset', () => {
    const guard = new ApiKeyGuard(reflector(false));
    expect(guard.canActivate(httpContext())).toBe(true);
  });

  it('allows a request with the correct bearer key', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(false));
    expect(guard.canActivate(httpContext('Bearer secret123'))).toBe(true);
  });

  it('rejects a missing header', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(false));
    expect(() => guard.canActivate(httpContext())).toThrow(UnauthorizedException);
  });

  it('rejects a wrong key', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(false));
    expect(() => guard.canActivate(httpContext('Bearer nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows @Public routes without a key', () => {
    process.env.XP_API_KEY = 'secret123';
    const guard = new ApiKeyGuard(reflector(true));
    expect(guard.canActivate(httpContext())).toBe(true);
  });

  it('reads the request from GraphQL context for graphql requests', () => {
    process.env.XP_API_KEY = 'secret123';
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req: { headers: { authorization: 'Bearer secret123' } } }),
    } as any);
    const ctx = { ...httpContext(), getType: () => 'graphql' };
    const guard = new ApiKeyGuard(reflector(false));
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
