import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useLazyQuery } from "@apollo/client/react";
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
  X,
  Trash2,
} from "lucide-react";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

// --- GRAPHQL QUERIES ---

const GET_NODES = gql`
  query GetNodes {
    nodes {
      _id
      title
      type
      content
      mainParent
      parents
      status
      progress
    }
  }
`;

const SEARCH_NODES = gql`
  query SearchNodes($term: String, $allowedTypes: [String]) {
    searchNodes(term: $term, allowedTypes: $allowedTypes) {
      _id
      title
      type
    }
  }
`;

const CREATE_NODE = gql`
  mutation CreateNode(
    $title: String!
    $type: String!
    $content: String
    $mainParent: ID
    $parents: [ID!]
    $status: String
    $progress: Float
  ) {
    createNode(
      createNodeInput: {
        title: $title
        type: $type
        content: $content
        mainParent: $mainParent
        parents: $parents
        status: $status
        progress: $progress
      }
    ) {
      _id
      title
      type
      content
      mainParent
      parents
      status
      progress
    }
  }
`;

const UPDATE_NODE = gql`
  mutation UpdateNode(
    $id: ID!
    $title: String!
    $type: String!
    $content: String
    $mainParent: ID
    $parents: [ID!]
    $status: String
    $progress: Float
  ) {
    updateNode(
      updateNodeInput: {
        _id: $id
        title: $title
        type: $type
        content: $content
        mainParent: $mainParent
        parents: $parents
        status: $status
        progress: $progress
      }
    ) {
      _id
      title
      type
      content
      mainParent
      parents
      status
      progress
    }
  }
`;

// 🌟 NEW: Delete Mutation
const DELETE_NODE = gql`
  mutation DeleteNode($id: ID!) {
    deleteNode(id: $id) {
      _id
    }
  }
`;

interface Node {
  _id: string;
  title: string;
  type: string;
  content?: string;
  mainParent?: string;
  parents?: string[];
  status?: string;
  progress?: number;
}

// --- HELPER FUNCTIONS ---

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

const getAllowedParents = (nodeType: string): string[] => {
  switch (nodeType) {
    case "DOMAIN":
      return ["DOMAIN"];
    case "SKILL":
      return ["DOMAIN"];
    case "PROJECT":
      return ["DOMAIN"];
    case "TASK":
      return ["PROJECT", "DOMAIN", "TASK"];
    case "NOTE":
      return ["PROJECT", "DOMAIN", "IDEA", "PERSON"];
    case "IDEA":
      return ["DOMAIN"];
    case "PERSON":
      return ["DOMAIN"];
    case "TAG":
      return [];
    default:
      return [];
  }
};

// --- CUSTOM COMPONENTS ---

function SmartSearchInput({
  placeholder,
  allowedTypes,
  onSelect,
  excludeId,
}: {
  placeholder: string;
  allowedTypes?: string[];
  onSelect: (node: { _id: string; title: string; type: string }) => void;
  excludeId?: string | null;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [executeSearch, { data, loading }] = useLazyQuery<{
    searchNodes: Node[];
  }>(SEARCH_NODES);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTerm.length > 0) {
      const timer = setTimeout(() => {
        executeSearch({ variables: { term: searchTerm, allowedTypes } });
        setIsOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
    }
  }, [searchTerm, allowedTypes, executeSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as globalThis.Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => searchTerm.length > 0 && setIsOpen(true)}
        className="bg-obsidian-hover text-sm text-obsidian-text border border-obsidian-border rounded px-3 py-1.5 outline-none focus:border-obsidian-accent w-48"
      />

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-obsidian-sidebar border border-obsidian-border rounded shadow-xl z-50 max-h-48 overflow-y-auto">
          {loading && (
            <div className="p-2 text-xs text-obsidian-muted">Searching...</div>
          )}
          {!loading && data?.searchNodes.length === 0 && (
            <div className="p-2 text-xs text-obsidian-muted">
              No results found.
            </div>
          )}
          {!loading &&
            data?.searchNodes
              .filter((n: any) => n._id !== excludeId)
              .map((node: any) => (
                <div
                  key={node._id}
                  onClick={() => {
                    onSelect(node);
                    setSearchTerm("");
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 text-sm hover:bg-obsidian-hover cursor-pointer flex items-center justify-between"
                >
                  <span className="text-obsidian-text truncate pr-2">
                    {node.title}
                  </span>
                  <span className="text-[10px] text-obsidian-muted uppercase tracking-wider">
                    {node.type}
                  </span>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const { data: allNodesData } = useQuery<{ nodes: Node[] }>(GET_NODES);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("NOTE");

  const [mainParent, setMainParent] = useState<string>("");
  const [status, setStatus] = useState<string>("TODO");
  const [progress, setProgress] = useState<number>(0);

  const [parents, setParents] = useState<string[]>([]);

  const editor = useCreateBlockNote();

  const [createNode, { loading: creating }] = useMutation(CREATE_NODE, {
    refetchQueries: [{ query: GET_NODES }],
  });

  const [updateNode, { loading: updating }] = useMutation(UPDATE_NODE, {
    refetchQueries: [{ query: GET_NODES }],
  });

  // 🌟 NEW: Delete Node Hook
  const [deleteNode, { loading: deleting }] = useMutation(DELETE_NODE, {
    refetchQueries: [{ query: GET_NODES }],
  });

  const handleNewNote = () => {
    setSelectedNodeId(null);
    setTitle("");
    setType("NOTE");
    setMainParent("");
    setStatus("TODO");
    setProgress(0);
    setParents([]);
    editor.replaceBlocks(editor.document, [
      { type: "paragraph", content: "" },
    ] as any);
  };

  const handleSelectNode = (node: Node) => {
    setSelectedNodeId(node._id);
    setTitle(node.title);
    setType(node.type);

    setMainParent(node.mainParent || "");
    setStatus(node.status || "TODO");
    setProgress(node.progress || 0);
    setParents(node.parents || []);

    let initialBlocks = [{ type: "paragraph", content: "" }];
    if (node.content) {
      try {
        const parsed = JSON.parse(node.content);
        initialBlocks = Array.isArray(parsed) ? parsed : initialBlocks;
      } catch (e) {
        console.error("Failed to parse", e);
      }
    }
    editor.replaceBlocks(editor.document, initialBlocks as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      const contentJSON = JSON.stringify(editor.document);

      const variables = {
        title,
        type,
        content: contentJSON,
        mainParent: mainParent === "" ? null : mainParent,
        parents: parents,
        status: type === "TASK" || type === "PROJECT" ? status : null,
        progress: Number(progress),
      };

      if (selectedNodeId) {
        await updateNode({ variables: { id: selectedNodeId, ...variables } });
      } else {
        await createNode({ variables });
        handleNewNote();
      }
    } catch (err: any) {
      console.error("Database Save Error:", err);
      alert("Failed to save to database: " + err.message);
    }
  };

  // 🌟 NEW: Delete Handler
  const handleDelete = async () => {
    if (!selectedNodeId) return;

    // Safety check so you don't accidentally click it!
    if (
      window.confirm(
        `Are you sure you want to delete "${title}"? This cannot be undone.`,
      )
    ) {
      try {
        await deleteNode({ variables: { id: selectedNodeId } });
        handleNewNote(); // Reset the UI to a blank form
      } catch (err: any) {
        console.error("Database Delete Error:", err);
        alert("Failed to delete node: " + err.message);
      }
    }
  };

  const isSaving = creating || updating;

  const getNodeTitle = (id: string) =>
    allNodesData?.nodes.find((n) => n._id === id)?.title || "Unknown Node";

  return (
    <div className="flex h-screen w-full bg-obsidian-bg text-obsidian-text font-sans">
      {/* LEFT SIDEBAR */}
      <div className="w-64 bg-obsidian-sidebar border-r border-obsidian-border flex flex-col shrink-0">
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
          <span className="font-semibold text-sm tracking-wider uppercase text-obsidian-muted">
            Project XP Vault
          </span>
          <Settings
            size={16}
            className="text-obsidian-muted cursor-pointer hover:text-white"
          />
        </div>
        <div className="p-2 border-b border-obsidian-border">
          <button
            onClick={handleNewNote}
            className="w-full flex items-center justify-center gap-2 bg-obsidian-hover hover:bg-obsidian-border text-white px-4 py-2 rounded-md font-medium transition-colors text-sm"
          >
            <Edit3 size={16} /> Create New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allNodesData?.nodes.map((node) => (
            <div
              key={node._id}
              onClick={() => handleSelectNode(node)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${selectedNodeId === node._id ? "bg-obsidian-accent text-white" : "text-obsidian-text hover:bg-obsidian-hover hover:text-white"}`}
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

      {/* MAIN CANVAS */}
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

              {/* PROPERTIES PANEL */}
              <div className="flex flex-col gap-4 mb-8 border-b border-obsidian-border pb-6 ml-12">
                {/* Row 1: Core Type & Canonical Parent */}
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-obsidian-muted font-mono uppercase w-16">
                      Type
                    </span>
                    <select
                      value={type}
                      onChange={(e) => {
                        setType(e.target.value);
                        setMainParent("");
                      }}
                      className="bg-obsidian-hover text-sm text-obsidian-text border border-obsidian-border rounded px-2 py-1.5 outline-none focus:border-obsidian-accent w-48"
                    >
                      <option value="DOMAIN">Domain</option>
                      <option value="SKILL">Skill</option>
                      <option value="PROJECT">Project</option>
                      <option value="TASK">Task</option>
                      <option value="NOTE">Note</option>
                      <option value="PERSON">Person</option>
                      <option value="IDEA">Idea</option>
                      <option value="TAG">Tag</option>
                    </select>
                  </div>

                  {/* Contextual Smart Parent Picker */}
                  {type !== "TAG" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-obsidian-muted font-mono uppercase w-16 text-right mr-2">
                        Parent
                      </span>

                      {/* Show current parent as a removable pill, or show the search input */}
                      {mainParent ? (
                        <div className="flex items-center bg-obsidian-hover border border-obsidian-border rounded px-3 py-1.5 text-sm gap-2">
                          <span className="truncate max-w-[150px]">
                            {getNodeTitle(mainParent)}
                          </span>
                          <X
                            size={14}
                            className="cursor-pointer text-obsidian-muted hover:text-red-400"
                            onClick={() => setMainParent("")}
                          />
                        </div>
                      ) : (
                        <SmartSearchInput
                          placeholder="Search allowed parents..."
                          allowedTypes={getAllowedParents(type)}
                          excludeId={selectedNodeId}
                          onSelect={(node) => setMainParent(node._id)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Row 2: Graph Connections (Tags) */}
                <div className="flex items-start gap-2 mt-2">
                  <span className="text-xs text-obsidian-muted font-mono uppercase w-16 pt-2">
                    Links
                  </span>
                  <div className="flex flex-wrap gap-2 items-center flex-1">
                    {/* Render selected connection pills */}
                    {parents.map((parentId) => (
                      <div
                        key={parentId}
                        className="flex items-center bg-obsidian-accent/20 border border-obsidian-accent/50 text-obsidian-accent rounded px-2 py-1 text-xs gap-1"
                      >
                        <span>{getNodeTitle(parentId)}</span>
                        <X
                          size={12}
                          className="cursor-pointer hover:text-white"
                          onClick={() =>
                            setParents(parents.filter((id) => id !== parentId))
                          }
                        />
                      </div>
                    ))}

                    {/* Infinite Multi-Search Input */}
                    <SmartSearchInput
                      placeholder="+ Add Connection"
                      excludeId={selectedNodeId}
                      onSelect={(node) => {
                        if (!parents.includes(node._id))
                          setParents([...parents, node._id]);
                      }}
                    />
                  </div>
                </div>

                {/* Row 3: Status Tracking (Conditional) */}
                {(type === "TASK" || type === "PROJECT") && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-obsidian-muted font-mono uppercase w-16">
                      Status
                    </span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="bg-obsidian-hover text-sm text-obsidian-text border border-obsidian-border rounded px-2 py-1 outline-none focus:border-obsidian-accent w-32"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="min-h-[300px]">
                <BlockNoteView editor={editor} theme="dark" />
              </div>

              {/* 🌟 NEW: Save and Delete Buttons */}
              <div className="mt-8 flex justify-end gap-3">
                {selectedNodeId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors text-sm border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  >
                    <Trash2 size={16} />{" "}
                    {deleting ? "Deleting..." : "Delete Note"}
                  </button>
                )}

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
