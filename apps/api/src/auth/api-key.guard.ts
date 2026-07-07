import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from './public.decorator';

// ponytail: shared-secret single-user auth; upgrade to JWT when Phase 11 multi-user lands
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = process.env.XP_API_KEY;
    if (!apiKey) return true; // auth disabled (local dev)

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req =
      context.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();

    const header: string | undefined = req?.headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !safeEqual(token, apiKey)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
