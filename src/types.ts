type DevOpsTokenResponse = {
  token: string
};
type Database = {
  id: string,
  info: {
    name: string,
    user: string,
    region: string,
    keyspaces: string[],
  },
  status: string,
  availableActions: [string],
  studioUrl: string,
  grafanaUrl: string,
  cqlshUrl: string,
  graphqlUrl: string,
  dataEndpointUrl: string,
};

type BundleResponse = {
  downloadURL: string
};

type Documents = {
  [key: string]: any
};

type TableDocuments = {
  [key: string]: Documents | undefined
};

type DocumentsResponse = {
  pageState?: string,
  data: {
    [key: string]: any
  }
};

type Column = {
  kind: String,
  name: string,
  type: {
    basic: string,
  }
};

type TableSchema = {
  name: string,
  columns: Column[]
};

type TableSchemasResponse = {
  data: {
    keyspace: {
      tables: TableSchema[]
    }
  } | undefined
};

export {
  DevOpsTokenResponse,
  Database,
  BundleResponse,
  Documents,
  TableSchema,
  TableDocuments,
  DocumentsResponse,
  TableSchemasResponse,
};
