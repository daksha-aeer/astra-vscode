import fetch from 'cross-fetch';
import { BundleResponse, DocumentsResponse } from "./types";

async function getTablesInKeyspace(endpoint: string, keyspace: string, authToken: string) {
    const query = `query getTablesInKeyspace ($keyspace: String!) {
                    keyspace(name: $keyspace) {
                        tables {
                        name
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

async function getSecureBundle(id: string, devOpsToken: string): Promise<BundleResponse> {
    return await fetch(`https://api.astra.datastax.com/v2/databases/${id}/secureBundleURL`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${devOpsToken}` },
    }).then(res => res.json());
}

async function getDocuments(
    endpoint: string, keyspace: string, table: string, authToken: string, pageState?: string, searchQuery?: string
): Promise<DocumentsResponse> {
    let url = new URL(`${endpoint}/v2/namespaces/${keyspace}/collections/${table}`);

    if (pageState !== undefined) {
        url.searchParams.append('page-state', encodeURIComponent(pageState));
    }
    if (searchQuery !== undefined) {
        url.searchParams.append('where', searchQuery);
        url.searchParams.append('page-size', '20');
    } else {
        // Only fetch 5 documents, if not searching
        url.searchParams.append('page-size', '5');
    }
    console.log('Get documents url', url);
    console.log('auth token', authToken);
    return await fetch(url.toString(), {
        headers: { 'X-Cassandra-Token': authToken },
    }).then(res => res.json());
}
export { getTablesInKeyspace, getSecureBundle, getDocuments }
