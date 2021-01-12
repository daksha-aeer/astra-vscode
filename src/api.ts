// import { ApolloClient, createHttpLink, gql, InMemoryCache } from "@apollo/client";
import fetch from 'cross-fetch';
import { BundleResponse } from "./types";

// const client = new ApolloClient({
//     link: createHttpLink({
//         uri: 'https://lowly-statement.ap-south-1.aws.cloud.dgraph.io/graphql',
//         fetch
//     }),
//     cache: new InMemoryCache(),
// });

// const GET_TABLES_IN_KEYSPACE = gql`
//     query getTablesInKeyspace ($keyspace: String) {
//         keyspace(name: $keyspace) {
//             tables {
//             name
//             }
//         }
//     }`

// async function getTablesInKeyspace(keyspace: string) {
//     const response = await client.query({ query: GET_TABLES_IN_KEYSPACE, variables: { keyspace } });
//     console.log('Got tables', response);
// }

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

export { getTablesInKeyspace, getSecureBundle }