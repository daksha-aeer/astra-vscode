import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import fetch from 'cross-fetch';
import Provider from './Provider';
import { Database } from './types';
const readFile = util.promisify(fs.readFile);

export async function activate(context: vscode.ExtensionContext) {
	let devOpsToken: string | null = null;
	const sampleCredentials = { clientId: "your-id", clientName: "user@domain.com", clientSecret: "secret" }
	console.log('Starting Astra extension');

	const provider = new Provider();
	vscode.window.registerTreeDataProvider(
		'databases-view',
		provider
	);

	vscode.commands.registerCommand('astra-vscode.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Astra VSCode!');
	});

	vscode.commands.registerCommand('astra-vscode.setServiceCredentials', async () => {
		console.log('Setting service credentials')

		const userInput = await vscode.window.showInputBox({
			prompt: 'Paste the credentials in the above format.',
			placeHolder: JSON.stringify(sampleCredentials),
		})
		await context.globalState.update('serviceCredentials', userInput);

		await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
	});

	vscode.commands.registerCommand('astra-vscode.refreshDevOpsToken', async () => {
		console.log('Refreshing token');
		const serviceCredentials = context.globalState.get<string>('serviceCredentials');
		console.log('Retrieved credentials', serviceCredentials);

		try {
			const result = await fetch('https://api.astra.datastax.com/v2/authenticateServiceAccount', {
				method: 'POST',
				body: serviceCredentials,
			}).then(res => res.json());

			if (result.token === null) {
				throw 'Failed to get token';
			} else {
				vscode.window.showInformationMessage('Token refreshed');
				devOpsToken = result.token;
				console.log('Got devOps token', devOpsToken);
			}
		} catch (error) {
			console.error(error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.refreshUserDatabases', async () => {
		console.log('Token for fetching databases', devOpsToken);

		const databases: [Database] = await fetch('https://api.astra.datastax.com/v2/databases?include=nonterminated', {
			headers: {
				Authorization: "Bearer " + devOpsToken,
			}
		}).then(res => res.json());
		console.log('Fetched databases', JSON.stringify(databases));

		provider.refresh(databases);
		vscode.window.showInformationMessage('Token refreshed');
	})

	vscode.commands.registerCommand('astra-vscode.openUrlInBrowser', (url: string) => {
		console.log('Got URL', url);
		vscode.env.openExternal(vscode.Uri.parse(url));
	});

	vscode.commands.registerCommand('astra-vscode.openFileInWebview', async (url: string) => {
		const panel = vscode.window.createWebviewPanel(
			'catCoding',
			'Cat Coding',
			vscode.ViewColumn.One,
			{}
		);

		const filePath = path.join(context.extensionPath, 'src', 'webviews', 'main.html');
		const html = await readFile(filePath);
		console.log('Read HTML', html.toString());
		panel.webview.html = html.toString();
	});

	await vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
	await vscode.commands.executeCommand('astra-vscode.refreshUserDatabases');
}

export function deactivate() { }
