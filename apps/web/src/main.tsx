import React from 'react';
import ReactDOM from 'react-dom/client';
// Explicitly import Core and React modules to bypass TypeScript workspace resolution bugs
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';
import App from './App.tsx';
import './index.css';

// 1. Initialize the Apollo Client
const client = new ApolloClient({
  link: new HttpLink({ uri: 'http://localhost:3000/graphql' }), // Points to your NestJS backend!
  cache: new InMemoryCache(),
});

// 2. Wrap the App in the ApolloProvider
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);
