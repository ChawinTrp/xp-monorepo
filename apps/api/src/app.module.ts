import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';
import { PingResolver } from './ping.resolver';
import { NodesModule } from './nodes/nodes.module';
import { GCalModule } from './gcal/gcal.module';
import { DayPlanModule } from './dayplan/dayplan.module';
import { ApiKeyGuard } from './auth/api-key.guard';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/xp-database',
    ),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    NodesModule,
    GCalModule,
    DayPlanModule,
  ],
  controllers: [AppController],
  providers: [AppService, PingResolver, { provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
