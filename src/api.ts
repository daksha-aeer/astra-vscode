import fetch from 'cross-fetch';
import { BundleResponse, Database, DevOpsTokenResponse, DocumentsResponse, TableSchemasResponse } from "./types";

async function getDevOpsToken(serviceCredentials: string): Promise<DevOpsTokenResponse> {
    return await fetch('https://api.astra.datastax.com/v2/authenticateServiceAccount', {
        method: 'POST',
        body: serviceCredentials,
    }).then(res => res.json());
}

async function getSecureBundleUrl(id: string, devOpsToken: string): Promise<BundleResponse> {
    return await fetch(`https://api.astra.datastax.com/v2/databases/${id}/secureBundleURL`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${devOpsToken}` },
    }).then(res => res.json());
}

async function getDatabases(devOpsToken: string): Promise<Database[]> {
    return await fetch('https://api.astra.datastax.com/v2/databases?include=nonterminated', {
        headers: {
            Authorization: "Bearer " + devOpsToken,
        }
    }).then(res => res.json());
}

async function parkDatabase(databaseId: string, devOpsToken: string) {
    return await fetch(`https://api.astra.datastax.com/v2/databases/${databaseId}/park`, {
        method: 'POST',
        headers: {
            Authorization: "Bearer " + devOpsToken,
        }
    })
}

async function getDatabaseAuthToken(database: Database, password: string) {
    return await fetch(`https://${database.id}-${database.info.region}.apps.astra.datastax.com/api/rest/v1/auth`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: database.info.user,
            password
        }),
    }).then(res => res.json());
}

async function getTableSchemas(
    endpoint: string, keyspace: string, authToken: string
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
            variables: { keyspace }
        })
    }).then(res => res.json());
}

async function getDocumentsInTable(
    endpoint: string, keyspace: string, table: string, authToken: string, pageState?: string, searchQuery?: string
): Promise<DocumentsResponse> {
    let url = new URL(`${endpoint}/v2/namespaces/${keyspace}/collections/${table}`);

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
    }).then(res => res.json());
}
export {
    getDevOpsToken,
    getSecureBundleUrl,
    parkDatabase,
    getDatabases,
    getDatabaseAuthToken,
    getTableSchemas,
    getDocumentsInTable
}
