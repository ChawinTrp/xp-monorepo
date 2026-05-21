import { gql } from '@apollo/client/core';

export const NODE_FIELDS = gql`
  fragment NodeFields on Node {
    _id
    title
    type
    mainParent
    parents
    children
    status
    progress
    description
    metadata
    createdAt
    updatedAt
  }
`;

export const GET_NODES = gql`
  ${NODE_FIELDS}
  query GetNodes {
    nodes {
      ...NodeFields
    }
  }
`;

export const SEARCH_NODES = gql`
  query SearchNodes($term: String, $allowedTypes: [String]) {
    searchNodes(term: $term, allowedTypes: $allowedTypes) {
      _id
      title
      type
    }
  }
`;

export const CREATE_NODE = gql`
  ${NODE_FIELDS}
  mutation CreateNode($input: CreateNodeInput!) {
    createNode(createNodeInput: $input) {
      ...NodeFields
    }
  }
`;

export const UPDATE_NODE = gql`
  ${NODE_FIELDS}
  mutation UpdateNode($input: UpdateNodeInput!) {
    updateNode(updateNodeInput: $input) {
      ...NodeFields
    }
  }
`;

export const DELETE_NODE = gql`
  mutation DeleteNode($id: ID!) {
    deleteNode(id: $id) {
      _id
    }
  }
`;

export const COMPLETE_TASK = gql`
  ${NODE_FIELDS}
  mutation CompleteTask($id: ID!) {
    completeTask(id: $id) {
      ...NodeFields
    }
  }
`;

export const START_TIMER = gql`
  ${NODE_FIELDS}
  mutation StartTaskTimer($id: ID!) {
    startTaskTimer(id: $id) {
      ...NodeFields
    }
  }
`;

export const STOP_TIMER = gql`
  ${NODE_FIELDS}
  mutation StopTaskTimer($id: ID!) {
    stopTaskTimer(id: $id) {
      ...NodeFields
    }
  }
`;

export const CHECK_IN_ROUTINE = gql`
  ${NODE_FIELDS}
  mutation CheckInRoutine($id: ID!) {
    checkInRoutine(id: $id) {
      ...NodeFields
    }
  }
`;
