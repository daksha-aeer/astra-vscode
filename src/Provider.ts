import * as vscode from 'vscode';
import * as path from 'path';
import { Database } from './types';

export default class Provider implements vscode.TreeDataProvider<TreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    data: TreeItem[];

    constructor(databases: Database[]) {
        this.data = databases.map((database) => new TreeItem(database))
    }

    refresh(databases: Database[]) {
        this.data = databases.map((database) => new TreeItem(database));
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
        if (element === undefined) {
            return this.data;
        }
        // return element.children;
    }
}

class TreeItem extends vscode.TreeItem {
    // children: TreeItem[] | undefined;
    database: Database;
    constructor(database: Database) {
        super(database.info.name);
        this.database = database;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'refresh.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'refresh.svg')
    };
}
