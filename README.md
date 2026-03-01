Project XP 🚀

Project XP is a comprehensive, graph-based web application designed to serve as a personal "Life OS." It combines a Markdown-based knowledge management system with advanced Todo-list, progress tracking, and collaborative project management features.

🌟 Core Modules

The Vault (Knowledge Management): An Obsidian-like markdown editor and renderer with bi-directional linking and interactive graph visualization.

The Game (Progress Tracking): A graph-based hierarchy (Life -> Skills -> Projects -> Tasks) where completing child nodes propagates XP/progress upwards.

The Orchestra (Project Management): Collaborative views including Kanban boards, Agile Sprints, and Gantt charts.

🏗️ Architecture & Tech Stack

This project is structured as a Monorepo using NPM Workspaces, ensuring seamless TypeScript interface sharing between the frontend and backend.

Frontend: React + TypeScript (Vite), Tailwind CSS, Apollo Client, react-force-graph

Backend: NestJS + TypeScript, Apollo GraphQL (Code-First)

Database: MongoDB (Atlas) via Mongoose

API Paradigm: GraphQL

📂 Folder Structure

xp-monorepo/
├── package.json           # Root workspace configuration
├── apps/
│   ├── api/               # NestJS Backend (Port 3000)
│   └── web/               # React Vite Frontend (Port 5173)
└── packages/
    └── shared/            # Shared TypeScript interfaces (The glue!)


🚀 Getting Started

Prerequisites

Node.js: v20+ (LTS recommended)

NPM: v7+ (for Workspace support)

MongoDB: A MongoDB Atlas cluster (M0 Free Tier is sufficient)

1. Installation

Clone the repository and install dependencies from the root directory:

git clone <your-repo-url>
cd xp-monorepo
npm install


2. Environment Setup

(Note: Detailed .env setup will be added as the project progresses)
Ensure your MongoDB connection string is properly configured in apps/api/src/app.module.ts or via a .env file in the apps/api directory.

3. Running the Application

You can run individual apps from the root directory using the -w (workspace) flag.

Start the Backend (NestJS / GraphQL API):

npm run start:dev -w api


API runs at: http://localhost:3000/graphql

Start the Frontend (React):

npm run dev -w web


Web runs at: http://localhost:5173

📜 License

Private / Proprietary (Update as needed)