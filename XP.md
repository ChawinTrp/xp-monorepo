# Project XP: Master Architecture & System Design Document

**Version:** 5.0 (The Comprehensive Vision)
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

### 2.4 External Integrations (v1.x+)

- **Google Calendar:** Two-way sync for `TASK` nodes with due dates, transforming them into calendar events.
- **Google Contacts:** Import and sync to automatically generate or update `PERSON` nodes within the "Relationships" domain.

## 3. Non-Functional Requirements

_How the system should behave._

- **Performance:** Fast retrieval of deep nested graph data.
- **Availability:** Accessible across multiple devices (Desktop, Mobile).
- **Data Portability:** 100% data ownership guarantee via the Obsidian-Compatible Export feature.
- **Security:** Authentication to keep personal data private.

## 4. Technology Stack & Architecture

_The tools and frameworks we are actively using to build XP._

- **Frontend Framework:** React 18 with TypeScript (Vite for bundling).
- **UI & Styling:** Tailwind CSS v3 (Custom Obsidian Dark Theme) + Lucide React Icons.
- **Rich Text Engine:** BlockNote (`@blocknote/react`) for Notion-style block-based editing.
- **Data Fetching (Frontend):** Apollo Client.
- **Graph Visualization (UI):** Target: `react-force-graph` or `reactflow` for interactive 2D/3D node mapping.
- **Backend Framework:** NestJS v11 (TypeScript) over Express 5. Chosen for enforcing enterprise architecture patterns.
- **API Paradigm:** GraphQL (using `@nestjs/graphql` with Apollo Server v5.4.0, implementing the Code-First approach).
- **Database:** MongoDB. Ideal for flexible JSON-like documents and native `$graphLookup` aggregation.
- **Database Hosting:** MongoDB Atlas (Cloud). Fully managed DBaaS.

## 5. Data Model (Schema Design)

_How our data is structured and related._

### Initial Top-Level Domain Structure (Flexible)

The graph starts from a `Root` node ("Life"), branching into distinct domains. Because this is a graph, this structure can be dynamically reorganized at any time by updating node IDs.

1. **Work:** Projects, Skills, Professional Knowledge.
2. **Personal:** Sports, Hobbies, Books, Routines.
3. **Relationships:** People, Network groupings (Uni, Club, Co-worker).
4. **Ideas:** Unprocessed thoughts, Business concepts (Ads-agency, Logistic, F&B).

### The Universal `Nodes` Collection (MongoDB / Mongoose Schema)

Instead of separate tables, we use a single collection to represent the Graph.

- `_id`: ObjectId
- `title`: String (Required)
- `type`: Enum (`DOMAIN`, `SKILL`, `PROJECT`, `TASK`, `NOTE`, `PERSON`, `IDEA`, `TAG`)
- `content`: String (Stores stringified JSON arrays of BlockNote blocks)
- `mainParent`: ObjectId (Optional. Defines the primary parent for clean breadcrumb/tree UI).
- `parents`: Array of ObjectIds (Allows multi-parent DAG structure and Tagging).
- `children`: Array of ObjectIds.
- `status`: Enum (`TODO`, `IN_PROGRESS`, `DONE`) (Mainly for tasks/projects).
- `progress`: Number (0-100) (Calculated based on children for higher-level nodes).
- `metadata`: Object (Type-specific data: `dueDate`, `startDate`, priority, contact info, etc.).

## 6. System Workflows & Integration

_How different parts of the system interact._

- **Graph Traversal Workflow:** Using MongoDB `$graphLookup` to fetch a user's entire "Life" tree or calculate propagated progress.
- **GraphQL Resolver Workflow:** The frontend queries exact data shapes (e.g., fetching a Node's title and its children's statuses without fetching the heavy block content).
- **BlockNote Parsing Workflow:** Structured JSON blocks are stored in MongoDB. The React frontend parses and safely renders them using the BlockNote API.
- **Data Portability Workflow:** A scheduled or on-demand background job that maps the MongoDB Adjacency List into a physical file directory structure, converting BlockNote JSON to standard Markdown, and returning a `.zip` artifact to the user.

## 7. Local Development & Testing Instructions

To run Project XP locally and test features, you need to spin up both the backend and frontend servers simultaneously in your terminal.

**Step 1: Start the Backend (The API & Database Connection)**

1. Open a terminal in the root `xp-monorepo` folder.
2. Run: `npm run start:dev -w api`
3. _Wait for the "Nest application successfully started" log._

**Step 2: Start the Frontend (The React UI)**

1. Open a **second** terminal tab in the root `xp-monorepo` folder.
2. Run: `npm run dev -w web`
3. _Open your browser to `http://localhost:5173`._

**Testing the GraphQL API directly:**

- Go to `http://localhost:3000/graphql` to open the Apollo Sandbox.

## 8. Implementation Roadmap & Status

_Phased approach to building XP._

- ✅ **Phase 1: Foundation:** Monorepo setup, initializing React (Vite) and NestJS projects, configuring TypeScript.
- ✅ **Phase 2: Core Data Engine:** Setting up MongoDB Atlas, defining Mongoose schemas, configuring NestJS GraphQL (Apollo).
- ✅ **Phase 3: The Vault Basics:** Integrating Apollo Client, React wiring, and basic CRUD operations.
- ✅ **Phase 4: UI/UX & Editor:** Tailwind CSS Obsidian theme applied, Notion-style BlockNote editor integrated.
- ✅ **Phase 5: Node Interactivity:** Adding the ability to select, view, and update existing nodes from the sidebar.
- ⏳ **Phase 6: The Graph (CURRENT):** Adding `parents`/`children` backend architecture and building the visual node graph visualization.
- 🔜 **Phase 7: The Game:** Multi-level UI rendering, status tracking, and automated progress calculation logic.
- 🔜 **Phase 8: Polish & Deploy:** Authentication, UI refactoring, Data Export Engine, and deploying version 1.0 to production.
- 🔜 **Phase 9: The Orchestra (v1.x+):** Collaborative features, Kanban UI, Group tools (voting/money split), and Social/Relationship tracking.
- 🔜 **Phase 10: Integrations (v1.x+):** Google Calendar and Google Contacts two-way syncing.
