# Project XP: Master Architecture & System Design Document

**Version:** 5.1 (Current Implementation)
**Status:** Active Development
**Lead Architect:** CT
**Consultant:** Gemini (System Engineer & Solution Architect)

## 1. Executive Summary

**Project Name:** XP
**Description:** A comprehensive web application combining Markdown-based knowledge management ("Vault"), advanced Graph-based Todo-list/Progress tracking ("Game"), and collaborative project/life management ("Orchestra"). Designed to serve as a personal life-organization system and a practical learning vehicle for system design.

## 2. Functional Requirements (Features)

_What the system must do._

### 2.1 The Vault: Knowledge Management (Notion/Obsidian Hybrid)

- **Block-Based Editing:** Create, read, update, delete (CRUD) notes using a rich-text, Notion-style block editor (via `@blocknote/react`).
- **Bi-directional Linking:** Note categorization and linking to connect knowledge to the Game graph.
- **Interactive Graph Visualization:** An Obsidian-style visual graph representing connections between notes and tasks.
- **Obsidian-Compatible Export (Future-Proofing):** A dedicated engine to export the entire MongoDB knowledge graph into a `.zip` file containing standard `.md` files, preserving folder hierarchy and converting internal links.
- **Search:** Full-text search and tag filtering.

### 2.2 The Game: Task, Progress & Skill Tracking

- **Graph-Based Hierarchy:** Nodes represent different entities (Life Areas, Skills, Projects, Tasks) with arbitrary depth.
- **Multi-Parent Architecture:** A node can belong to multiple parents (e.g., Project "XP" belongs to "SWE", "DATA", and "PM").
- **Primary Path Visualization:** While nodes can have multiple parents, a designated "Main Parent" provides a canonical path for simplified tree-view navigation and breadcrumbs when the full graph view is too dense.
- **Tagging as Graph Relationships:** Tags are treated as first-class Nodes. Assigning a tag to an item simply means adding the Tag Node's ID to the item's `parents` array.
- **Task & Commitment Tracking:** Actionable nodes (tasks) with statuses, priorities, and due dates.
- **Upward Progress Propagation:** Completing a child node (Task) propagates XP/Progress upwards to its parent nodes (Project -> Skill -> Life Area).

### 2.3 The Orchestra: Collaborative & Life Management (v1.x+)

- **Relationship & Social Management:** Tools to schedule periodic catch-ups (e.g., monthly board games), input overlapping availability times, and track social health.
- **Group Utilities:** Integrated group management tools for voting/polling and splitting bills/money among linked `PERSON` nodes.
- **Kanban Boards:** Visualizing `TASK` nodes as draggable cards grouped by their `status` (TODO, IN_PROGRESS, DONE) within a specific `PROJECT` scope.
- **Agile Sprints:** Grouping `TASK` nodes into time-boxed iterations (Sprint planning).
- **Gantt Chart Visualization:** Timeline-based visualization of `PROJECT` and `TASK` dependencies utilizing `startDate` and `dueDate` metadata.
- **Collaborative Working:** Multi-user access control, allowing assignment of nodes to different users and real-time multiplayer updates.

## 3. Non-Functional Requirements

_How the system should behave._

- **Performance:** Fast retrieval of deep nested graph data.
- **Availability:** Accessible across multiple devices (Desktop, Mobile).
- **Data Portability:** 100% data ownership guarantee via the Obsidian-Compatible Export feature.
- **Security:** Authentication to keep personal data private.

## 4. Technology Stack & Architecture

_The tools and frameworks we are actively using to build XP._

### 4.1 Backend (API)
- **Framework:** NestJS v11 (TypeScript).
- **API Paradigm:** GraphQL (Code-First approach with `@nestjs/graphql` and Apollo Server v5.4.0).
- **Database:** MongoDB via Mongoose.
- **Database Connection (`app.module.ts`):**
  ```typescript
  MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb+srv://...');
  ```

### 4.2 Frontend (Web)
- **Framework:** React 19 with TypeScript (Vite).
- **Data Fetching:** Apollo Client v4.
- **Rich Text Editor:** BlockNote v0.47 (`@blocknote/react`).
- **Styling:** Tailwind CSS v3 (Custom Obsidian Dark Theme).
- **Icons:** Lucide React.

## 5. Data Model (The Universal `Nodes` Collection)

We use a single collection in MongoDB to represent the entire Graph. All entities (Notes, Tasks, Projects) are "Nodes".

### 5.1 Node Schema (`node.entity.ts`)

```typescript
@Schema({ timestamps: true })
@ObjectType()
export class Node {
  @Field(() => ID)
  _id!: string;

  @Prop({ required: true })
  @Field(() => String)
  title!: string;

  @Prop({
    required: true,
    enum: ['DOMAIN', 'SKILL', 'PROJECT', 'TASK', 'NOTE', 'PERSON', 'IDEA', 'TAG'],
  })
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
  content?: string; // Stringified JSON of BlockNote blocks
}
```

## 6. Backend Logic & Services

### 6.1 `NodesService` (Core Logic)
Handles CRUD operations and contextual search for graph connections.

- `create(createNodeInput)`: Saves a new node.
- `searchNodes(term, allowedTypes)`: Performs a regex-based search for UI comboboxes (e.g., finding allowed parents for a specific node type).
- `update(id, updateNodeInput)`: Updates node properties and content.
- `remove(id)`: Deletes a node.

### 6.2 `NodesResolver` (GraphQL API)
Exposes queries and mutations to the frontend.

- **Queries:** `nodes`, `node(id)`, `searchNodes(term, allowedTypes)`.
- **Mutations:** `createNode`, `updateNode`, `deleteNode`.

## 7. Frontend Implementation

### 7.1 Apollo Client Setup
Initialized in `main.tsx` to connect to `http://localhost:3000/graphql`.

### 7.2 BlockNote Integration
The editor content is managed as a state of structured JSON blocks and saved to the `content` field in MongoDB.

```typescript
const editor = useCreateBlockNote();
// ...
const contentJSON = JSON.stringify(editor.document);
```

### 7.3 Smart Search (Graph Connectivity)
The `SmartSearchInput` component allows users to search for existing nodes and link them as `mainParent` or additional `parents` (bi-directional graph links).

## 8. Local Development & Testing Instructions

**Step 1: Start the Backend**
1. Run: `npm run start:dev -w api`
2. GraphQL Sandbox: `http://localhost:3000/graphql`

**Step 2: Start the Frontend**
1. Run: `npm run dev -w web`
2. UI: `http://localhost:5173`

## 9. Implementation Roadmap & Status

- ✅ **Phase 1-4: Foundation & Editor:** NestJS/React setup, MongoDB Atlas, GraphQL, and BlockNote integration.
- ✅ **Phase 5: CRUD Operations:** Full ability to create, edit, and delete nodes.
- ✅ **Phase 6: Graph Connectivity (CURRENT):** `parents`/`children` architecture implemented in schema and UI (SmartSearch).
- 🔜 **Phase 7: The Game:** Progress propagation logic and multi-level hierarchy visualization.

## 10. Audit Log (Known Issues)
- **Desync:** `children` array is currently not automatically updated when a `parent` is added.
- **Propagation:** XP/Progress calculation logic is pending backend implementation.
- **Workspace Resolution:** Brittle TypeScript resolution between `apps/web` and `packages/shared`.
