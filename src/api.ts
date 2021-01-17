import fetch from 'cross-fetch';
import { Client as AstraClient } from 'cassandra-driver';
import {
  BundleResponse, Database, DevOpsTokenResponse, DocumentsResponse, TableSchemasResponse,
} from './types';

/**
 * Token generation
 */

/**
 * Get DevOps token for Astra account using service credentials
 * @param serviceCredentials generated from Astra dashboard
 */
async function getDevOpsToken(serviceCredentials: string): Promise<DevOpsTokenResponse> {
  return await fetch('https://api.astra.datastax.com/v2/authenticateServiceAccount', {
    method: 'POST',
    body: serviceCredentials,
  }).then((res) => res.json());
}

/**
 * Generate auth token for a datbase, required to use its GraphQL, REST and document APIs
 * @param database
 * @param password
 */
async function getDatabaseAuthToken(database: Database, password: string) {
  return await fetch(`https://${database.id}-${database.info.region}.apps.astra.datastax.com/api/rest/v1/auth`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: database.info.user,
      password,
    }),
  }).then((res) => res.json());
}

/**
 * DevOps API
 */

/**
 * Get secure connect bundle URL
 * @param databaseId UID of database
 * @param devOpsToken
 */
async function getSecureBundleUrl(databaseId: string, devOpsToken: string): Promise<BundleResponse> {
  return await fetch(`https://api.astra.datastax.com/v2/databases/${databaseId}/secureBundleURL`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${devOpsToken}` },
  }).then((res) => res.json());
}

/**
 * Get list of non-terminated databases
 * @param devOpsToken
 */
async function getDatabases(devOpsToken: string): Promise<Database[] | Object> {
  return await fetch('https://api.astra.datastax.com/v2/databases?include=nonterminated', {
    headers: {
      Authorization: `Bearer ${devOpsToken}`,
    },
  }).then((res) => res.json());
}

/**
 * Park an active database
 * @param databaseId UID of database to be parked
 * @param devOpsToken
 */
async function parkDatabase(databaseId: string, devOpsToken: string) {
  return await fetch(`https://api.astra.datastax.com/v2/databases/${databaseId}/park`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${devOpsToken}`,
    },
  });
}

/**
 * Terminate database
 * @param databaseId UID of database to be terminated
 * @param devOpsToken
 */
async function terminateDatabase(databaseId: string, devOpsToken: string) {
  return await fetch(`https://api.astra.datastax.com/v2/databases/${databaseId}/terminate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${devOpsToken}`,
    },
  });
}

/**
 * Unpark database
 * @param databaseId UID of database to be unparked
 * @param devOpsToken
 */
async function unparkDatabase(databaseId: string, devOpsToken: string) {
  return await fetch(`https://api.astra.datastax.com/v2/databases/${databaseId}/unpark`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${devOpsToken}`,
    },
  });
}

/**
 * Document API
 */

/**
 * Fetch documents from a table
 * Returns upto 5 documents. If more documents are present, page state is returned.
 * @param endpoint Unique document API endpoint for the database
 * @param keyspace Keyspace / Namespace of the table
 * @param table Name of the table / collection
 * @param authToken Database auth token
 * @param pageState Optional state for pagination
 * @param searchQuery Optional search query
 */
async function getDocumentsInTable(
  endpoint: string, keyspace: string, table: string, authToken: string,
  pageState?: string, searchQuery?: string,
): Promise<DocumentsResponse> {
  const url = new URL(`${endpoint}/v2/namespaces/${keyspace}/collections/${table}`);

  if (pageState !== undefined) {
    url.searchParams.append('page-state', pageState); // performs URL encoding
  }
  if (searchQuery !== undefined) {
    url.searchParams.append('where', searchQuery);
    url.searchParams.append('page-size', '20');
  } else {
    // Only fetch 5 documents, if not searching
    url.searchParams.append('page-size', '5');
  }
  return await fetch(url.toString(), {
    headers: { 'X-Cassandra-Token': authToken },
  }).then((res) => res.json());
}

/**
 * Create a new document collection in the given database keyspace
 * @param endpoint Unique document API endpoint for the database
 * @param keyspace Keyspace / Namespace of the table
 * @param collection Name of the collection which will be created
 * @param authToken Database auth token
 */
async function createCollection(
  endpoint: string, keyspace: string, collection: string, authToken: string,
) {
  return await fetch(`${endpoint}/v2/namespaces/${keyspace}/collections`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Cassandra-Token': authToken },
    body: JSON.stringify({
      name: collection,
    }),
  });
}

/**
 * Add a new document in the given keyspace collection
 * @param endpoint Unique document API endpoint for the database
 * @param keyspace Keyspace / Namespace of the table
 * @param collection Name of the collection which will be created
 * @param authToken Database auth token
 * @param documentBody JSON body of the document, in string format
 */
async function createDocument(
  endpoint: string, keyspace: string, collection: string, authToken: string, documentBody: string,
) {
  return await fetch(`${endpoint}/v2/namespaces/${keyspace}/collections/${collection}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Cassandra-Token': authToken },
    body: documentBody,
  });
}

/**
 * Document API
 */

/**
 * Get list of tables in a keyspace and their schemas
 * @param endpoint Unique document API endpoint for the database
 * @param keyspace Keyspace / Namespace of the table
 * @param authToken Database auth token
 */
async function getTableSchemas(
  endpoint: string, keyspace: string, authToken: string,
): Promise<TableSchemasResponse> {
  const query = `query getTableSchema($keyspace: String!) {
        keyspace(name: $keyspace) {
            tables {
                name
                columns {
                    kind
                    name
                    type {
                        basic
                    }
                }
            }
        }
    }`;

  return await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cassandra-token': authToken },
    body: JSON.stringify({
      query,
      variables: { keyspace },
    }),
  }).then((res) => res.json());
}

/**
 * Node.js driver
 */

/**
 * Execute CQL query using driver and secure bundle
 * @param username Username for the database
 * @param password Password for the database
 * @param bundlePath Secure bundle path on computer
 * @param query CQL query in string format
 */
async function runCql(username: string, password: string, bundlePath: string, query: string) {
  console.log('Connecting to Astra');
  const client = new AstraClient({
    cloud: {
      secureConnectBundle: bundlePath,
    },
    credentials: { username, password },
  });

  await client.connect();
  console.log('Executing query');
  const response = await client.execute(query);
  await client.shutdown();
  console.log('Query response', response);
  return response;
}

export {
  getDevOpsToken,
  getSecureBundleUrl,
  parkDatabase,
  terminateDatabase,
  unparkDatabase,
  getDatabases,
  getDatabaseAuthToken,
  getTableSchemas,
  getDocumentsInTable,
  createCollection,
  createDocument,
  runCql,
};
