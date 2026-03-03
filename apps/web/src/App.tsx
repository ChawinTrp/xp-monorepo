import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';
import './App.css';

// 1. The Query (Now fetching 'content' too!)
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

// 2. The Mutation
const CREATE_NODE = gql`
  mutation CreateNode($title: String!, $type: String!, $content: String) {
    createNode(createNodeInput: { title: $title, type: $type, content: $content }) {
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

function App() {
  const { loading, error, data } = useQuery<{ nodes: Node[] }>(GET_NODES);
  
  const [title, setTitle] = useState('');
  const [type, setType] = useState('IDEA');
  const [content, setContent] = useState<string | undefined>('');

  const [createNode, { loading: creating }] = useMutation(CREATE_NODE, {
    refetchQueries: [{ query: GET_NODES }],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!title) return;
    
    await createNode({ variables: { title, type, content } });
    
    setTitle('');
    setContent('');
  };

  if (loading) return <p>Loading your Life OS...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Project XP: The Vault</h1>
      
      {/* --- THE CREATION FORM --- */}
      <div style={{ background: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '3rem', color: '#333', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>Add New Entry</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="What's on your mind?" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1, padding: '10px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
              required
            />
            
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              style={{ width: '150px', padding: '10px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
            >
              <option value="IDEA">Idea</option>
              <option value="TASK">Task</option>
              <option value="NOTE">Note</option>
              <option value="PROJECT">Project</option>
            </select>
          </div>

          {/* THE NEW MARKDOWN EDITOR */}
          <div data-color-mode="light">
            <MDEditor
              value={content}
              onChange={setContent}
              previewOptions={{
                rehypePlugins: [[rehypeSanitize]],
              }}
              height={250}
            />
          </div>

          <button 
            type="submit" 
            disabled={creating}
            style={{ padding: '12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}
          >
            {creating ? 'Saving...' : 'Save to Vault'}
          </button>
        </form>
      </div>

      {/* --- THE LIST DISPLAY --- */}
      <h2>My Vault</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {data?.nodes.map((node) => (
          <div key={node._id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #eaeaea', color: '#333' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>{node.title}</h3>
              <span style={{ marginLeft: '15px', fontSize: '0.75rem', fontWeight: 'bold', background: '#e2e8f0', padding: '4px 10px', borderRadius: '20px', color: '#475569' }}>
                {node.type}
              </span>
            </div>
            
            {/* RENDER THE MARKDOWN CONTENT */}
            {node.content && (
              <div data-color-mode="light" style={{ marginTop: '15px', padding: '15px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <MDEditor.Markdown source={node.content} style={{ whiteSpace: 'pre-wrap', background: 'transparent', color: '#333' }} />
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

export default App;
