import * as vscode from 'vscode';
import * as path from 'path';
import { Database } from './types';

export default class Provider implements vscode.TreeDataProvider<TreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    data?: TreeItem[];

    refresh(databases: Database[]) {
        this.data = databases.map((database) => new TreeItem(database.info.name, undefined, [
            new TreeItem('DataStax Studio', {
                title: 'Launch DataStax Studio',
                command: 'astra-vscode.openUrlInBrowser',
                arguments: [database.studioUrl],
            }),
            new TreeItem('GraphQL schema', {
                title: 'GraphQL schema',
                command: 'astra-vscode.openGraphQLInWebview',
                arguments: [`${database.graphqlUrl}-schema`],
            }),
            new TreeItem('Swagger UI for REST', {
                title: 'Swagger UI for REST',
                command: 'astra-vscode.openSwaggerInWebview',
                arguments: [`https://${database.id}-${database.info.region}.apps.astra.datastax.com/api/rest/swagger.json`],
            }),
        ]));
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return this.data;
        }
        console.log('Returning children', element.children);
        return element.children;
    }
}

class TreeItem extends vscode.TreeItem {
    children?: TreeItem[];
    command?: vscode.Command;

    constructor(label: string, command?: vscode.Command, children?: TreeItem[]) {
        super(label,
            children === undefined ?
                vscode.TreeItemCollapsibleState.None :
                vscode.TreeItemCollapsibleState.Expanded
        );
        this.children = children;
        this.command = command;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'theme-agnostic', 'Database.svg'),
    };
}
