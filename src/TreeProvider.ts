import * as vscode from 'vscode';
import * as path from 'path';
import {
  Database, DocumentsResponse, TableDocuments, TableSchema,
} from './types';

/**
 * Provider class to populate tree view
 */
export class TreeProvider implements vscode.TreeDataProvider<AstraTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AstraTreeItem | undefined | null | void>();

  // Event listener to update tree data
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Holds tree items which get displayed in the tree
  data?: AstraTreeItem[];

  /**
   * Redraw entire tree using the database list
   * @param databases
   */
  refresh(databases: Database[]) {
    this.data = databases.map((database) => {
      // Database item with group headers
      const databaseItem = new AstraTreeItem(database.info.name, undefined, undefined, 'database');
      console.log('Adding database to db item', database);
      databaseItem.database = database;

      // Database region and status
      const { status } = database;
      databaseItem.contextValue = `${status.toLowerCase()}-database`;
      databaseItem.description = `${database.info.region} / ${status.toLowerCase()}`;
      // Database status icon

      let iconColor = 'terminal.ansiBrightYellow';
      if (status === 'ACTIVE') {
        iconColor = 'terminal.ansiBrightGreen';
      } else if (status === 'TERMINATING') {
        iconColor = 'terminal.ansiBrightRed';
      }
      databaseItem.iconPath = new vscode.ThemeIcon(
        'circle-filled', new vscode.ThemeColor(iconColor),
      );

      // Do not add children if database is not active
      if (status !== 'ACTIVE') {
        return databaseItem;
      }

      // If database is active, display additional options

      databaseItem.contextValue = 'active-database';
      databaseItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

      // 1. API section

      // GraphQL API button item
      const graphQlItem = new AstraTreeItem('GraphQL', {
        title: 'GraphQL schema',
        command: 'astra-vscode.openGraphQLInWebview',
        arguments: [`${database.graphqlUrl}-schema`],
      });
      graphQlItem.iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'graphql.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'graphql.svg'),
      };

      // REST API button item
      const restItem = new AstraTreeItem('REST', {
        title: 'Swagger UI for REST',
        command: 'astra-vscode.openSwaggerInWebview',
        arguments: [`https://${database.id}-${database.info.region}.apps.astra.datastax.com/api/rest/swagger.json`],
      });
      restItem.iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'swagger.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'swagger.svg'),
      };

      // Download secure bundle button item
      const bundleItem = new AstraTreeItem('Download Secure Bundle', {
        title: 'Download Secure Bundle',
        command: 'astra-vscode.downloadSecureConnectBundle',
        arguments: [database.id],
      });
      bundleItem.iconPath = new vscode.ThemeIcon('cloud-download');

      // Group above items into an 'API' section
      const apiChildren = [graphQlItem, restItem, bundleItem];
      const apiGroupItem = new AstraTreeItem('API', undefined, apiChildren);

      // 2. Database management section

      // Datastax Studio button item
      const studioItem = new AstraTreeItem('DataStax Studio', {
        title: 'Launch DataStax Studio',
        command: 'astra-vscode.openUrlInBrowser',
        arguments: [database.studioUrl],
      });
      studioItem.iconPath = new vscode.ThemeIcon('notebook');

      // Grafana button item
      const grafanaItem = new AstraTreeItem('Grafana', {
        title: 'Monitor database health on Grafana',
        command: 'astra-vscode.openUrlInBrowser',
        arguments: [database.grafanaUrl],
      });
      grafanaItem.iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'grafana.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'grafana.svg'),
      };

      // Group above items into a 'Manage' section
      const manageDatabaseChildren = [studioItem, grafanaItem];
      const manageGroupItem = new AstraTreeItem('Manage', undefined, manageDatabaseChildren);

      databaseItem.children = [apiGroupItem, manageGroupItem];

      // 3. Keyspace section

      // Get item for each keyspace
      const keyspaceItems = database.info.keyspaces.map((keyspace) => {
        const keyspaceItem = new AstraTreeItem(keyspace);
        keyspaceItem.database = database;
        keyspaceItem.keyspace = keyspace;
        keyspaceItem.contextValue = 'keyspace';
        keyspaceItem.iconPath = {
          light: path.join(__filename, '..', '..', 'resources', 'light', 'keyspace.svg'),
          dark: path.join(__filename, '..', '..', 'resources', 'dark', 'keyspace.svg'),
        };
        return keyspaceItem;
      });

      // Group keyspace items into a 'Keyspaces' section
      const keyspaceParentItem = new AstraTreeItem('Keyspaces', undefined, keyspaceItems);
      keyspaceParentItem.contextValue = 'keyspace-parent';
      databaseItem.children!.push(keyspaceParentItem);

      return databaseItem;
    });

    this._onDidChangeTreeData.fire(); // Create event to update the tree
  }

  /**
   * Display additional options for the connected database
   * @param dbItem Tree item of the connected database
   */
  displayConnectedDatabaseOptions(dbItem: AstraTreeItem) {
    const database = dbItem.database!;
    for (const databaseChildItem of dbItem?.children ?? []) {
      let newChild: AstraTreeItem | undefined;
      switch (databaseChildItem.label) {
        case 'API': {
          // Copy auth token button item
          newChild = new AstraTreeItem('Copy auth token', {
            title: 'Copy auth token',
            command: 'astra-vscode.copyDatabaseAuthToken',
            arguments: [database.id],
          });
          newChild.iconPath = new vscode.ThemeIcon('files');
        } break;
        case 'Manage': {
          // Launch CQL shell button item
          newChild = new AstraTreeItem('CQL Shell', {
            title: 'Launch CQL Shell',
            command: 'astra-vscode.openCqlsh',
            arguments: [database],
          });
          newChild.iconPath = new vscode.ThemeIcon('terminal');
        } break;
        case 'Keyspaces': {
          // Change context values for keyspaces, so connect keyspace button is displayed
          for (const keyspaceItem of databaseChildItem.children!) {
            keyspaceItem.contextValue = 'connectable-keyspace';
          }
        }
      }
      if (newChild) {
        databaseChildItem.children!.push(newChild);
      }
    }

    dbItem.contextValue = 'connected-database';
    this._onDidChangeTreeData.fire();
  }

  /**
   * Display tables, schemas and documents for a connected keyspace
   * @param keyspaceItem Tree item of the keyspace
   * @param documentsPerTable Document list
   * @param tables Tables in the keyspace
   * @param pageState To paginate documents
   */
  displayTablesAndDocsForKeyspace(
    keyspaceItem: AstraTreeItem, documentsPerTable: TableDocuments,
    pageStatePerTable: { [tableName: string]: string | undefined }, tables?: TableSchema[],
  ) {
    if (tables && tables.length > 0) {
      keyspaceItem.children = tables.map((table) => {
        // Display table schema
        const tableColumnItems = table.columns.map((column) => {
          const columnItem = new AstraTreeItem(column.name);
          columnItem.description = column.type.basic;
          let columnIconName = 'column.svg';
          console.log('Got column type', column.kind);
          switch (column.kind) {
            case 'PARTITION': {
              columnIconName = 'partitioning-key.svg';
            } break;
            case 'CLUSTERING': {
              columnIconName = 'clustering-key.svg';
            } break;
          }
          columnItem.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', columnIconName),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', columnIconName),
          };
          return columnItem;
        });
        const schemaItem = new AstraTreeItem('Schema', undefined, tableColumnItems);

        schemaItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        schemaItem.iconPath = {
          light: path.join(__filename, '..', '..', 'resources', 'light', 'schema.svg'),
          dark: path.join(__filename, '..', '..', 'resources', 'dark', 'schema.svg'),
        };
        const tableChildren = [schemaItem];

        const tableName = table.name;
        const tableItem = new AstraTreeItem(tableName, undefined, tableChildren);
        tableItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        const tableDocuments = documentsPerTable[tableName];

        tableItem.iconPath = {
          light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
          dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
        };

        // Display table documents
        if (tableDocuments) {
          tableItem.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'folder-closed.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder-closed.svg'),
          };

          const documentChildren: AstraTreeItem[] = [];
          for (const documentId in tableDocuments) {
            const documentBody = tableDocuments[documentId];
            documentChildren.push(
              new AstraTreeItem(documentId, {
                title: 'View document',
                command: 'astra-vscode.viewDocument',
                arguments: [documentId, documentBody],
              }),
            );
          }
          const documentsGroupItem = new AstraTreeItem('Documents');
          documentsGroupItem.contextValue = 'documents';
          documentsGroupItem.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', 'documents.svg'),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'documents.svg'),
          };

          // Paginate documents
          documentsGroupItem.database = keyspaceItem.database;
          documentsGroupItem.keyspace = keyspaceItem.keyspace;
          documentsGroupItem.tableName = tableName;
          const pageState = pageStatePerTable[tableName];
          if (pageState) {
            documentChildren.push(
              new AstraTreeItem('Load more...', {
                title: 'Load more',
                command: 'astra-vscode.paginateDocuments',
                arguments: [documentsGroupItem, pageState],
              }),
            );
          }
          documentsGroupItem.children = documentChildren;
          documentsGroupItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
          console.log('Table documents group item', documentsGroupItem);
          tableChildren.push(documentsGroupItem);
        }

        return tableItem;
      });
      keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else {
      keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    console.log('keyspace connected', keyspaceItem.label);
    keyspaceItem.contextValue = 'connected-keyspace';

    this._onDidChangeTreeData.fire();
  }

  /**
   * Display additional documents fetched through pagination
   * @param documentsGroupItem Parent item for documents
   * @param documentsResponse New document list
   */
  displayPaginatedDocuments(
    documentsGroupItem: AstraTreeItem,
    documentsResponse: DocumentsResponse,
  ) {
    // Pop pagination button
    const paginateItem = documentsGroupItem.children!.pop()!;

    // Push item for each new document
    const documents = documentsResponse.data;
    const { pageState } = documentsResponse;
    for (const documentId in documents) {
      documentsGroupItem.children?.push(
        new AstraTreeItem(documentId, {
          title: 'View document',
          command: 'astra-vscode.viewDocument',
          arguments: [documentId, documents[documentId]],
        }),
      );
    }
    // If more documents remain, add the pagination button again
    if (pageState) {
      const loadMoreCommand = paginateItem!.command!;
      loadMoreCommand.arguments![3] = pageState;
      documentsGroupItem.children?.push(paginateItem);
    }
    this._onDidChangeTreeData.fire();
  }

  /**
   * TreeDataProvider callback functions
   */

  getTreeItem(element: AstraTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: AstraTreeItem): vscode.ProviderResult<AstraTreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
}

/**
 * TreeItem objects are used to populate tree view
 */
export class AstraTreeItem extends vscode.TreeItem {
  children?: AstraTreeItem[];

  database?: Database;

  keyspace?: string;

  tableName?: string;

  constructor(label: string, command?: vscode.Command, children?: AstraTreeItem[], contextValue?: string) {
    super(label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded);
    this.children = children;
    this.command = command;
    this.contextValue = contextValue; // to show connect button only for databases
  }
}
