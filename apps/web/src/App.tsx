import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client/core";
import {
  FolderGit2,
  FileText,
  CheckSquare,
  Lightbulb,
  Hash,
  Plus,
  Settings,
  Edit3,
} from "lucide-react";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const GET_NODES = gql`
  query GetNodes {
    nodes {
      _id
      title
      type
      content
    }
  }
`;

const CREATE_NODE = gql`
  mutation CreateNode($title: String!, $type: String!, $content: String) {
    createNode(
      createNodeInput: { title: $title, type: $type, content: $content }
    ) {
      _id
      title
      type
      content
    }
  }
`;

// 🌟 NEW: The Update Mutation
const UPDATE_NODE = gql`
  mutation UpdateNode(
    $id: ID!
    $title: String!
    $type: String!
    $content: String
  ) {
    updateNode(
      updateNodeInput: {
        _id: $id
        title: $title
        type: $type
        content: $content
      }
    ) {
      _id
      title
      type
      content
    }
  }
`;

interface Node {
  _id: string;
  title: string;
  type: string;
  content?: string;
}

const getNodeIcon = (type: string) => {
  switch (type) {
    case "PROJECT":
      return <FolderGit2 size={16} />;
    case "TASK":
      return <CheckSquare size={16} />;
    case "IDEA":
      return <Lightbulb size={16} />;
    case "NOTE":
      return <FileText size={16} />;
    default:
      return <Hash size={16} />;
  }
};

export default function App() {
  const { data } = useQuery<{ nodes: Node[] }>(GET_NODES);

  // 🌟 NEW: Track if we are editing an existing node
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("NOTE");

  const editor = useCreateBlockNote();

  const [createNode, { loading: creating }] = useMutation(CREATE_NODE, {
    refetchQueries: [{ query: GET_NODES }],
  });

  const [updateNode, { loading: updating }] = useMutation(UPDATE_NODE);

  // 🌟 NEW: Handle switching to "Create Mode"
  const handleNewNote = () => {
    setSelectedNodeId(null);
    setTitle("");
    setType("NOTE");
    // Clear the editor by replacing its content with an empty paragraph
    editor.replaceBlocks(editor.document, [
      { type: "paragraph", content: "" },
    ] as any);
  };

  // 🌟 NEW: Handle switching to "Edit Mode"
  const handleSelectNode = (node: Node) => {
    setSelectedNodeId(node._id);
    setTitle(node.title);
    setType(node.type);

    let initialBlocks = [{ type: "paragraph", content: "" }];
    if (node.content) {
      try {
        const parsed = JSON.parse(node.content);
        initialBlocks = Array.isArray(parsed) ? parsed : initialBlocks;
      } catch (e) {
        console.error("Failed to parse node content", e);
      }
    }
    // Swap the editor content to the selected node's content
    editor.replaceBlocks(editor.document, initialBlocks as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const contentJSON = JSON.stringify(editor.document);

    if (selectedNodeId) {
      // 🌟 EDIT MODE: Update existing node
      await updateNode({
        variables: { id: selectedNodeId, title, type, content: contentJSON },
      });
    } else {
      // 🌟 CREATE MODE: Save new node
      await createNode({ variables: { title, type, content: contentJSON } });
      handleNewNote(); // Clear form after creating
    }
  };

  const isSaving = creating || updating;

  return (
    <div className="flex h-screen w-full bg-obsidian-bg text-obsidian-text font-sans">
      {/* --- LEFT SIDEBAR --- */}
      <div className="w-64 bg-obsidian-sidebar border-r border-obsidian-border flex flex-col">
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
          <span className="font-semibold text-sm tracking-wider uppercase text-obsidian-muted">
            Project XP Vault
          </span>
          <Settings
            size={16}
            className="text-obsidian-muted cursor-pointer hover:text-white"
          />
        </div>

        {/* 🌟 NEW: New Note Button */}
        <div className="p-2 border-b border-obsidian-border">
          <button
            onClick={handleNewNote}
            className="w-full flex items-center justify-center gap-2 bg-obsidian-hover hover:bg-obsidian-border text-white px-4 py-2 rounded-md font-medium transition-colors text-sm"
          >
            <Edit3 size={16} /> Create New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {data?.nodes.map((node) => (
            <div
              key={node._id}
              onClick={() => handleSelectNode(node)}
              // Highlight the currently selected node
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                selectedNodeId === node._id
                  ? "bg-obsidian-accent text-white"
                  : "text-obsidian-text hover:bg-obsidian-hover hover:text-white"
              }`}
            >
              <span
                className={
                  selectedNodeId === node._id
                    ? "text-white"
                    : "text-obsidian-muted"
                }
              >
                {getNodeIcon(node.type)}
              </span>
              <span className="truncate">{node.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN CANVAS --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="h-12 border-b border-obsidian-border flex items-center px-6 shrink-0 justify-between">
          <span className="text-sm text-obsidian-muted flex items-center gap-2">
            <FileText size={16} />{" "}
            {selectedNodeId ? "Editing Document" : "New Document"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8 lg:p-12">
            <form onSubmit={handleSubmit} className="flex flex-col mb-16">
              <input
                type="text"
                placeholder="Untitled Document"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent text-4xl font-bold text-white placeholder-obsidian-border border-none outline-none mb-6 ml-12"
                required
              />

              <div className="flex gap-4 mb-8 border-b border-obsidian-border pb-4 ml-12">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-obsidian-muted font-mono uppercase">
                    Type
                  </span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="bg-obsidian-hover text-sm text-obsidian-text border border-obsidian-border rounded px-2 py-1 outline-none"
                  >
                    <option value="NOTE">Note</option>
                    <option value="IDEA">Idea</option>
                    <option value="TASK">Task</option>
                    <option value="PROJECT">Project</option>
                  </select>
                </div>
              </div>

              <div className="min-h-[300px]">
                <BlockNoteView editor={editor} theme="dark" />
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-obsidian-accent hover:bg-purple-600 text-white px-5 py-2.5 rounded-md font-medium transition-colors"
                >
                  <Plus size={18} />{" "}
                  {isSaving
                    ? "Saving..."
                    : selectedNodeId
                      ? "Update Vault"
                      : "Save to Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
