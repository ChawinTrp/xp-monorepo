import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';
import { PingResolver } from './ping.resolver';
import { NodesModule } from './nodes/nodes.module';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://root:XAN5BywVi36K4to0@xpcluster.kdcrw6m.mongodb.net/xp-database?appName=XPCluster';

@Module({
  imports: [
    MongooseModule.forRoot(MONGO_URI),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
    }),
    NodesModule,
  ],
  controllers: [AppController],
  providers: [AppService, PingResolver],
})
export class AppModule {}
