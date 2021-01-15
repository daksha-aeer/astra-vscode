import * as vscode from 'vscode';
import * as path from 'path';
import { Database, DocumentsResponse, TableDocuments, TableSchema } from './types';

export class Provider implements vscode.TreeDataProvider<AstraTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<AstraTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    data?: AstraTreeItem[];

    refresh(databases: Database[]) {
        this.data = databases.map((database) => {
            // Database item with group headers
            const databaseItem = new AstraTreeItem(database.info.name, undefined, undefined, 'database');
            console.log('Adding database to db item', database);
            databaseItem.database = database;

            // Database region and status
            const status = database.status;
            databaseItem.description = `${database.info.region} / ${status.toLowerCase()}`;
            // Database status icon
            let iconColor = 'terminal.ansiBrightYellow';
            if (status === 'ACTIVE') {
                iconColor = 'terminal.ansiBrightGreen';
            } else if (status === 'TERMINATING') {
                iconColor = 'terminal.ansiBrightRed';
            }
            databaseItem.iconPath = new vscode.ThemeIcon(
                'circle-filled', new vscode.ThemeColor(iconColor)
            );
            databaseItem.contextValue = `${status.toLowerCase()}-database`;
            // Do not add children if database is not active
            if (status !== 'ACTIVE') {
                return databaseItem;
            }

            // If database is active
            databaseItem.contextValue = 'active-database';
            databaseItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

            // API group items
            const apiChildren = [
                new AstraTreeItem('GraphQL schema', {
                    title: 'GraphQL schema',
                    command: 'astra-vscode.openGraphQLInWebview',
                    arguments: [`${database.graphqlUrl}-schema`],
                }),
                new AstraTreeItem('Swagger UI for REST', {
                    title: 'Swagger UI for REST',
                    command: 'astra-vscode.openSwaggerInWebview',
                    arguments: [`https://${database.id}-${database.info.region}.apps.astra.datastax.com/api/rest/swagger.json`],
                }),
                new AstraTreeItem('Download Secure Bundle', {
                    title: 'Download Secure Bundle',
                    command: 'astra-vscode.downloadSecureConnectBundle',
                    arguments: [database.id],
                }),
            ]
            const apiGroupItem = new AstraTreeItem('API', undefined, apiChildren);

            // Database management items
            const manageDatabaseChildren = [
                new AstraTreeItem('DataStax Studio', {
                    title: 'Launch DataStax Studio',
                    command: 'astra-vscode.openUrlInBrowser',
                    arguments: [database.studioUrl],
                }),
                new AstraTreeItem('Grafana', {
                    title: 'Monitor database health on Grafana',
                    command: 'astra-vscode.openUrlInBrowser',
                    arguments: [database.grafanaUrl],
                }),
            ]
            const manageGroupItem = new AstraTreeItem('Manage', undefined, manageDatabaseChildren);

            databaseItem.children = [apiGroupItem, manageGroupItem];

            // Keyspace items
            const keyspaceItems = database.info.keyspaces.map((keyspace) => {
                const keyspaceItem = new AstraTreeItem(keyspace);
                keyspaceItem.database = database;
                keyspaceItem.keyspace = keyspace;
                keyspaceItem.contextValue = 'keyspace';
                return keyspaceItem;
            })

            const keyspaceParentItem = new AstraTreeItem('Keyspaces', undefined, keyspaceItems);
            keyspaceParentItem.contextValue = 'keyspace-parent';
            databaseItem.children!.push(keyspaceParentItem);

            return databaseItem;
        });
        this._onDidChangeTreeData.fire();
    }

    displayConnectedDatabaseOptions(dbItem: AstraTreeItem) {
        const database = dbItem.database!;
        for (const databaseChildItem of dbItem?.children ?? []) {
            let newChild: AstraTreeItem | undefined = undefined;
            switch (databaseChildItem.label) {
                case 'API': {
                    newChild = new AstraTreeItem('Copy auth token', {
                        title: 'Copy auth token',
                        command: 'astra-vscode.copyDatabaseAuthToken',
                        arguments: [database.id],
                    });
                } break;
                case 'Manage': {
                    newChild = new AstraTreeItem('Launch CQL Shell', {
                        title: 'Launch CQL Shell',
                        command: 'astra-vscode.openCqlsh',
                        arguments: [database],
                    })
                } break;
                case 'Keyspaces': {
                    for (const keyspaceItem of databaseChildItem.children!) {
                        keyspaceItem.contextValue = 'connectable-keyspace'
                    }
                }
            }
            if (newChild) {
                databaseChildItem.children!.push(newChild)
            }
        }

        dbItem.contextValue = 'connected-database';
        this._onDidChangeTreeData.fire();
    }

    displayTablesAndDocsForKeyspace(
        keyspaceItem: AstraTreeItem, documentsPerTable: TableDocuments,
        tables?: TableSchema[], pageState?: string
    ) {
        if (tables && tables.length > 0) {
            keyspaceItem.children = tables.map((table, index) => {
                // Table schema
                const tableColumnItems = table.columns.map((column) => {
                    const columnItem = new AstraTreeItem(column.name);
                    columnItem.description = column.type.basic;
                    // TODO Add icon
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
                    }
                    return columnItem;
                });
                const schemaItem = new AstraTreeItem('Schema', undefined, tableColumnItems);

                schemaItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                schemaItem.iconPath = {
                    light: path.join(__filename, '..', '..', 'resources', 'light', 'schema.svg'),
                    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'schema.svg'),
                }
                const tableChildren = [schemaItem];

                // Table item
                const tableName = table.name;
                const tableItem = new AstraTreeItem(tableName, undefined, tableChildren);
                tableItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                const tableDocuments = documentsPerTable[tableName];

                // Table documents
                if (tableDocuments) {
                    tableItem.iconPath = {
                        light: path.join(__filename, '..', '..', 'resources', 'light', 'folder-closed.svg'),
                        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder-closed.svg'),
                    }

                    let documentChildren: AstraTreeItem[] = [];
                    for (const documentId in tableDocuments) {
                        const documentBody = tableDocuments[documentId].data;
                        documentChildren.push(
                            new AstraTreeItem(documentId, {
                                title: 'View document',
                                command: 'astra-vscode.viewDocument',
                                arguments: [documentId, documentBody],
                            })
                        )
                    }
                    const documentsGroupItem = new AstraTreeItem('Documents');
                    documentsGroupItem.contextValue = 'documents';
                    documentsGroupItem.iconPath = {
                        light: path.join(__filename, '..', '..', 'resources', 'light', 'documents.svg'),
                        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'documents.svg'),
                    }

                    // Paginate documents
                    documentsGroupItem.database = keyspaceItem.database;
                    documentsGroupItem.keyspace = keyspaceItem.keyspace;
                    documentsGroupItem.tableName = tableName;
                    if (pageState) {
                        documentChildren.push(
                            new AstraTreeItem('Load more...', {
                                title: 'Load more',
                                command: 'astra-vscode.paginateDocuments',
                                arguments: [documentsGroupItem, pageState],
                            })
                        )
                    }
                    documentsGroupItem.children = documentChildren;
                    documentsGroupItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                    console.log('Table documents group item', documentsGroupItem);
                    tableChildren.push(documentsGroupItem);
                }

                return tableItem;
            })
            keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

        } else {
            keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        console.log('keyspace connected', keyspaceItem.label);
        keyspaceItem.contextValue = 'connected-keyspace';

        this._onDidChangeTreeData.fire();
    }

    displayPaginatedDocuments(
        documentsGroupItem: AstraTreeItem,
        documentsResponse: DocumentsResponse
    ) {
        const paginateItem = documentsGroupItem.children!.pop()!; // remove
        const documents = documentsResponse.data;
        const pageState = documentsResponse.pageState;

        for (const documentId in documents) {
            documentsGroupItem.children?.push(
                new AstraTreeItem(documentId, {
                    title: 'View document',
                    command: 'astra-vscode.viewDocument',
                    arguments: [documentId, documents[documentId].data],
                })
            )
        }
        if (pageState) { // add again if documents remain
            const loadMoreCommand = paginateItem!.command!;
            loadMoreCommand.arguments![3] = pageState;
            documentsGroupItem.children?.push(paginateItem);
        }
        this._onDidChangeTreeData.fire();
    }

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

export class AstraTreeItem extends vscode.TreeItem {
    children?: AstraTreeItem[];
    database?: Database;
    keyspace?: string;
    tableName?: string;

    constructor(label: string, command?: vscode.Command, children?: AstraTreeItem[], contextValue?: string) {
        super(label,
            children === undefined ?
                vscode.TreeItemCollapsibleState.None :
                vscode.TreeItemCollapsibleState.Expanded
        );
        this.children = children;
        this.command = command;
        this.contextValue = contextValue; // to show connect button only for databases
    }
}
