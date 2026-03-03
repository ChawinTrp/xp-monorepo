import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type NodeDocument = Node & Document;

@Schema({ timestamps: true })
@ObjectType()
export class Node {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true })
  @Field(() => String)
  title: string;

  @Prop({ 
    required: true, 
    enum: ['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'NOTE', 'PERSON', 'IDEA', 'TAG'] 
  })
  @Field(() => String)
  type: string;

  // The primary parent for clean UI tree navigation
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Node', required: false })
  @Field(() => ID, { nullable: true })
  mainParent?: string;

  // Multi-parent support for the DAG (Directed Acyclic Graph)
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Node' }] })
  @Field(() => [ID], { nullable: 'itemsAndList' })
  parents?: string[];

  // Children references
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
  content?: string; // For markdown notes
}

export const NodeSchema = SchemaFactory.createForClass(Node);
