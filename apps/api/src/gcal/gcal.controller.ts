import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { GCalService } from './gcal.service';

@Controller('gcal')
export class GCalController {
  constructor(private readonly gcalService: GCalService) {}

  @Get('status')
  getStatus() {
    return this.gcalService.getStatus();
  }

  @Get('auth')
  getAuthUrl() {
    const url = this.gcalService.getAuthUrl();
    if (!url) {
      throw new HttpException(
        'Google Calendar not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { url };
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      throw new HttpException('Missing authorization code', HttpStatus.BAD_REQUEST);
    }
    try {
      await this.gcalService.handleCallback(code);
      // Redirect back to XP frontend settings
      res.redirect('http://localhost:5173?gcal=connected');
    } catch (err: any) {
      throw new HttpException(`OAuth failed: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
