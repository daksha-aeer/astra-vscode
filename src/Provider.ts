import * as vscode from 'vscode';
import * as path from 'path';
import { Database } from './types';

export class Provider implements vscode.TreeDataProvider<AstraTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<AstraTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    data?: AstraTreeItem[];

    refresh(databases: Database[]) {
        this.data = databases.map((database) => new AstraTreeItem(database.info.name, undefined, [
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
        ], 'database', database));
        this._onDidChangeTreeData.fire();
    }

    displayConnectedDatabaseOptions(id: string) {
        this.data = this.data?.map((treeItem) => {
            const currentDbId = treeItem.database?.id;
            if (currentDbId === id) {
                console.log('Replacing context value');
                treeItem.contextValue = 'database-connected';
                treeItem.iconPath = {
                    light: path.join(__filename, '..', '..', 'resources', 'light', 'ConnectPlugged.svg'),
                    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'ConnectPlugged.svg'),
                };
                treeItem.children?.push(
                    new AstraTreeItem('Copy auth token', {
                        title: 'Copy auth token',
                        command: 'astra-vscode.copyDatabaseAuthToken',
                        arguments: [id],
                    }),
                    new AstraTreeItem('Launch CQL Shell', {
                        title: 'Launch CQL Shell',
                        command: 'astra-vscode.openCqlsh',
                        arguments: [treeItem.database],
                    })
                )
                return treeItem;
            }
            return treeItem;
        })
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AstraTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: AstraTreeItem): vscode.ProviderResult<AstraTreeItem[]> {
        if (element === undefined) {
            return this.data;
        }
        console.log('Returning children', element.children);
        return element.children;
    }
}

export class AstraTreeItem extends vscode.TreeItem {
    children?: AstraTreeItem[];
    database?: Database;

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

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
    };
}
