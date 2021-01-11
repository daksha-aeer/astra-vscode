type Database = {
    id: string,
    info: {
        name: string,
        user: string,
        region: string,
        keyspaces: string[],
        // keyspace: string,
        // additionalKeyspaces: [string],
    },
    status: string,
    availableActions: [string],
    studioUrl: string,
    grafanaUrl: string,
    cqlshUrl: string,
    graphqlUrl: string,
    dataEndpointUrl: string,
}

type BundleResponse = {
    downloadURL: string
}

export { Database, BundleResponse }