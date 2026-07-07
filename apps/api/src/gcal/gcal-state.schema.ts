import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GCalStateDocument = GCalState & Document;

// ponytail: single-document collection — one Google account, one XP instance
@Schema({ collection: 'gcalstate' })
export class GCalState {
  @Prop({ type: Object, required: false })
  tokens?: Record<string, unknown>;

  @Prop({ required: false })
  calendarId?: string;
}

export const GCalStateSchema = SchemaFactory.createForClass(GCalState);
