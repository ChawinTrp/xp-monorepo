import { ObjectType, Field, ID, Float, GraphQLISODateTime } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import GraphQLJSON from 'graphql-type-json';

export const NODE_TYPES = [
  'DOMAIN',
  'SKILL',
  'PROJECT',
  'TASK',
  'PERSON',
  'TAG',
  'ROUTINE',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type NodeDocument = Node & Document;

@Schema({ timestamps: true })
@ObjectType()
export class Node {
  @Field(() => ID)
  _id!: string;

  @Prop({ required: true })
  @Field(() => String)
  title!: string;

  @Prop({ required: true, enum: NODE_TYPES })
  @Field(() => String)
  type!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Node', required: false })
  @Field(() => ID, { nullable: true })
  mainParent?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Node' }] })
  @Field(() => [ID], { nullable: 'itemsAndList' })
  parents?: string[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Node' }] })
  @Field(() => [ID], { nullable: 'itemsAndList' })
  children?: string[];

  @Prop({ enum: ['TODO', 'IN_PROGRESS', 'DONE'], required: false })
  @Field(() => String, { nullable: true })
  status?: string;

  @Prop({ required: false, default: 0 })
  @Field(() => Float, { nullable: true })
  progress?: number;

  @Prop({ required: false })
  @Field(() => String, { nullable: true })
  description?: string;

  @Prop({ type: Object, required: false })
  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;

  @Prop({ required: false })
  obsidianPath?: string;

  @Prop({ required: false, default: false })
  @Field(() => Boolean, { nullable: true })
  archived?: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt?: Date;
}

export const NodeSchema = SchemaFactory.createForClass(Node);
