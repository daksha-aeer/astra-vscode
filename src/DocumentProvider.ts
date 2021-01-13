import * as vscode from 'vscode';

export default class DocumentProvider implements vscode.TextDocumentContentProvider {
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(uri: vscode.Uri): string {
        const uriParams = new URLSearchParams(uri.query);
        const body = uriParams.get('body')!;
        const formattedBody = JSON.stringify(JSON.parse(body), null, 2);
        return formattedBody;
    }
};