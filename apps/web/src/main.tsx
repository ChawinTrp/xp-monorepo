import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import App from './App';
import './index.css';
// HTML5 drag-and-drop (Kanban board, Plan Mode) doesn't fire on iOS/iPadOS
// touch. This polyfill bridges touch events to drag events; it self-activates
// only when 'ontouchstart' is present, so desktop native DnD is untouched.
import 'drag-drop-touch';

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const client = new ApolloClient({
  link: new HttpLink({ uri: `${API_BASE}/graphql` }),
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);
