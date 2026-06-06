import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { google, calendar_v3 } from 'googleapis';
import { Node, NodeDocument } from '../nodes/node.entity';
import { localDateStr } from '@xp/shared';

interface GCalTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

@Injectable()
export class GCalService {
  private readonly logger = new Logger(GCalService.name);
  private oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;
  private calendarId: string | null = null;
  private tokens: GCalTokens | null = null;

  constructor(
    @InjectModel(Node.name) private nodeModel: Model<NodeDocument>,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/gcal/callback';

    if (clientId && clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      this.logger.log('Google Calendar OAuth2 client initialized');
    } else {
      this.logger.warn('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — GCal sync disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.oauth2Client;
  }

  isConnected(): boolean {
    return !!this.tokens?.refresh_token;
  }

  getAuthUrl(): string | null {
    if (!this.oauth2Client) return null;
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  async handleCallback(code: string): Promise<void> {
    if (!this.oauth2Client) throw new Error('OAuth2 not configured');
    const { tokens } = await this.oauth2Client.getToken(code);
    this.tokens = tokens as GCalTokens;
    this.oauth2Client.setCredentials(tokens);
    this.logger.log('Google Calendar connected successfully');

    // Ensure XP calendar exists
    await this.ensureXPCalendar();
  }

  private async ensureXPCalendar(): Promise<void> {
    if (!this.oauth2Client || this.calendarId) return;
    const cal = google.calendar({ version: 'v3', auth: this.oauth2Client });

    // Look for existing XP calendar
    const list = await cal.calendarList.list();
    const existing = list.data.items?.find(c => c.summary === 'XP Tasks');
    if (existing?.id) {
      this.calendarId = existing.id;
      this.logger.log(`Found existing XP Tasks calendar: ${this.calendarId}`);
      return;
    }

    // Create new calendar
    const created = await cal.calendars.insert({
      requestBody: { summary: 'XP Tasks', description: 'Tasks and routines from Project XP', timeZone: 'Asia/Bangkok' },
    });
    this.calendarId = created.data.id ?? null;
    this.logger.log(`Created XP Tasks calendar: ${this.calendarId}`);
  }

  private getCalendar(): calendar_v3.Calendar | null {
    if (!this.oauth2Client || !this.tokens) return null;
    this.oauth2Client.setCredentials(this.tokens);
    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async upsertEvent(node: NodeDocument): Promise<void> {
    const cal = this.getCalendar();
    if (!cal || !this.calendarId) return;

    const m = (node.metadata as any) ?? {};

    // Only sync nodes with dates
    const dueDate = m.due || m.dueDate;
    if (!dueDate && node.type !== 'ROUTINE') return;

    const statusColor = node.status === 'DONE' ? '2' // green
      : (dueDate && new Date(dueDate) < new Date()) ? '11' // red
      : node.status === 'IN_PROGRESS' ? '9' // blue
      : '8'; // gray

    const description = [
      `[${node.type}]`,
      node.description || '',
      '',
      `XP: http://localhost:5173 (node ${node._id})`,
      node.status === 'DONE' ? '✅ Completed' : '',
    ].filter(Boolean).join('\n');

    const eventBody: calendar_v3.Schema$Event = {
      summary: node.title,
      description,
      colorId: statusColor,
      start: { date: dueDate },
      end: { date: dueDate },
    };

    // Handle routines — daily recurring
    if (node.type === 'ROUTINE' && m.cadence === 'daily') {
      eventBody.recurrence = ['RRULE:FREQ=DAILY'];
      eventBody.start = { date: localDateStr() };
      eventBody.end = { date: localDateStr() };
    }

    try {
      if (m.gcalEventId) {
        // Update existing event
        await cal.events.update({
          calendarId: this.calendarId,
          eventId: m.gcalEventId,
          requestBody: eventBody,
        });
        this.logger.debug(`Updated GCal event for "${node.title}"`);
      } else {
        // Create new event
        const created = await cal.events.insert({
          calendarId: this.calendarId,
          requestBody: eventBody,
        });
        // Store gcalEventId back to node
        if (created.data.id) {
          const meta = { ...m, gcalEventId: created.data.id };
          await this.nodeModel.findByIdAndUpdate(node._id, { metadata: meta });
          this.logger.debug(`Created GCal event for "${node.title}": ${created.data.id}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`GCal sync failed for "${node.title}": ${err.message}`);
    }
  }

  async deleteEvent(node: NodeDocument): Promise<void> {
    const cal = this.getCalendar();
    if (!cal || !this.calendarId) return;

    const gcalEventId = (node.metadata as any)?.gcalEventId;
    if (!gcalEventId) return;

    try {
      await cal.events.delete({ calendarId: this.calendarId, eventId: gcalEventId });
      this.logger.debug(`Deleted GCal event for "${node.title}"`);
    } catch (err: any) {
      this.logger.error(`GCal delete failed for "${node.title}": ${err.message}`);
    }
  }

  getStatus(): { configured: boolean; connected: boolean; calendarId: string | null } {
    return {
      configured: this.isConfigured(),
      connected: this.isConnected(),
      calendarId: this.calendarId,
    };
  }
}
