import * as vscode from 'vscode';
import fetch from 'cross-fetch';
import Provider from './Provider';
import { Database } from './types';

export function activate(context: vscode.ExtensionContext) {
	let devOpsToken: string | null = null;
	const sampleCredentials = { clientId: "your-id", clientName: "user@domain.com", clientSecret: "secret" }
	console.log('Starting Astra extension');
	vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');

	// const provider = new NodeDependenciesProvider(vscode.workspace.rootPath);
	const provider = new Provider([]);
	vscode.window.registerTreeDataProvider(
		'astra-explorer',
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

		vscode.commands.executeCommand('astra-vscode.refreshDevOpsToken');
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
	})

	vscode.commands.registerCommand('astra-vscode.refreshEntry', () => {
		// provider.refresh();
	});
}

export function deactivate() { }
