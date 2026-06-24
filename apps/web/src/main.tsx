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
  // cache-and-network: render cached data instantly, but ALWAYS refetch in the
  // background so the Focus deck / queue never shows stale data after edits made
  // here, on the desktop, or in another tab. cache-first (the default) was
  // serving old GetNodes/DayPlan copies on revisit.
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);
