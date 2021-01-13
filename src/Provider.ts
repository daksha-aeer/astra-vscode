import * as vscode from 'vscode';
import * as path from 'path';
import { Database, Documents, DocumentsResponse, TableDocuments } from './types';

export class Provider implements vscode.TreeDataProvider<AstraTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<AstraTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    data?: AstraTreeItem[];

    refresh(databases: Database[]) {
        this.data = databases.map((database) => {
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

            const keyspaceItems = database.info.keyspaces.map((keyspace) => {
                const keyspaceItem = new AstraTreeItem(keyspace, {
                    title: 'Show tables',
                    command: 'astra-vscode.getTablesInKeyspace',
                    arguments: [database, keyspace],
                });
                keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                return keyspaceItem;
            })

            return new AstraTreeItem(database.info.name, undefined, [
                new AstraTreeItem('API', undefined, apiChildren),
                new AstraTreeItem('Manage', undefined, manageDatabaseChildren),
                new AstraTreeItem('Keyspaces', undefined, keyspaceItems),

            ], 'database', database)
        });
        this._onDidChangeTreeData.fire();
    }

    displayConnectedDatabaseOptions(dbItem: AstraTreeItem) {
        const database = dbItem.database!;
        for (const databaseChildItem of dbItem.children!) {
            let newChild: AstraTreeItem | undefined = undefined;
            switch (databaseChildItem.label) {
                case 'API': {
                    newChild = new AstraTreeItem('Copy auth token', {
                        title: 'Copy auth token',
                        command: 'astra-vscode.copyDatabaseAuthToken',
                        arguments: [database.id],
                    });
                }
                    break;
                case 'Manage': {
                    newChild = new AstraTreeItem('Launch CQL Shell', {
                        title: 'Launch CQL Shell',
                        command: 'astra-vscode.openCqlsh',
                        arguments: [database],
                    })
                }
            }
            if (newChild) {
                databaseChildItem.children!.push(newChild)
            }
        }

        dbItem.contextValue = 'database-connected';
        dbItem.iconPath = undefined;
        this._onDidChangeTreeData.fire();
    }

    displayTablesInKeyspace(
        databaseId: string, keyspace: string, tables: { name: string }[],
        documents: TableDocuments, pageState?: string
    ) {
        const dbIndex = this.findDbItemIndex(databaseId);
        const keyspacesGroupIndex = this.findGroupIndex(dbIndex, 'Keyspaces');

        this.data![dbIndex].children![keyspacesGroupIndex].children?.map((keyspaceItem) => {
            if (keyspaceItem.label === keyspace) {
                if (tables.length > 0) {
                    keyspaceItem.children = tables.map((table, index) => {
                        const tableChildren = [
                            new AstraTreeItem('Schema'),
                        ]
                        if (documents[table.name] !== undefined) {
                            // TODO special icon for collection table

                            let documentChildren: AstraTreeItem[] = [];
                            for (const documentId in documents[table.name]) {
                                const documentBody = documents[table.name]![documentId].data;
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
                            documentsGroupItem.database = this.data![dbIndex].database;
                            documentsGroupItem.keyspace = keyspace;
                            documentsGroupItem.tableName = table.name;
                            if (pageState !== undefined) {
                                documentChildren.push(
                                    new AstraTreeItem('Load more...', {
                                        title: 'Load more',
                                        command: 'astra-vscode.paginateDocuments',
                                        arguments: [this.data![dbIndex].database, keyspace, table.name, pageState, documentsGroupItem],
                                    })
                                )
                            }
                            documentsGroupItem.children = documentChildren;
                            documentsGroupItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                            console.log('Table documents group item', documentsGroupItem);
                            tableChildren.push(documentsGroupItem);
                        }
                        const tableItem = new AstraTreeItem(table.name, undefined, tableChildren);
                        if (index !== 0) {
                            tableItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                        }

                        return tableItem;
                    })
                } else {
                    keyspaceItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
                }
            }
            return keyspaceItem;
        })

        this._onDidChangeTreeData.fire();
    }

    displayPaginatedDocuments(
        documentsGroupItem: AstraTreeItem,
        documentsResponse: DocumentsResponse
    ) {
        const loadMoreItem = documentsGroupItem.children!.pop()!;
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
        if (pageState !== undefined) {
            const loadMoreCommand = loadMoreItem!.command!;
            loadMoreCommand.arguments![3] = pageState;
            documentsGroupItem.children?.push(
                loadMoreItem
            )
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

    // Utils
    findDbItemIndex(databaseId: string) {
        return this.data!.findIndex((dbItem) => {
            return dbItem.database?.id === databaseId;
        })
    }

    findGroupIndex(databaseIndex: number, groupName: string) {
        return this.data![databaseIndex].children!.findIndex((dbActionItem) => {
            return dbActionItem.label === groupName;
        });
    }
}

export class AstraTreeItem extends vscode.TreeItem {
    children?: AstraTreeItem[];
    database?: Database;
    keyspace?: string;
    tableName?: string;

    constructor(label: string, command?: vscode.Command, children?: AstraTreeItem[], contextValue?: string, database?: Database) {
        super(label,
            children === undefined ?
                vscode.TreeItemCollapsibleState.None :
                vscode.TreeItemCollapsibleState.Expanded
        );
        this.children = children;
        this.command = command;
        this.contextValue = contextValue; // to show connect button only for databases
        this.database = database;
    }

    iconPath?= {
        light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
    };
}
