import * as vscode from 'vscode';
import fetch from 'cross-fetch';
import { NodeDependenciesProvider } from './Provider';

export function activate(context: vscode.ExtensionContext) {
	let devOpsToken: string | null = null;
	const sampleCredentials = { clientId: "your-id", clientName: "user@domain.com", clientSecret: "secret" }
	console.log('Starting Astra extension');

	const provider = new NodeDependenciesProvider(vscode.workspace.rootPath);
	vscode.window.registerTreeDataProvider(
		'astra-explorer',
		provider
	);

	vscode.commands.registerCommand('astra-vscode.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from Astra VSCode!');
	});

	vscode.commands.registerCommand('astra-vscode.readServiceCredentials', async () => {
		console.log('Reading service credentials')

		const userInput = await vscode.window.showInputBox({
			prompt: 'Paste the credentials in the above format.',
			placeHolder: JSON.stringify(sampleCredentials),
		})
		await context.globalState.update('serviceCredentials', userInput);
	});

	vscode.commands.registerCommand('astra-vscode.connectAstraDevOpsApi', async () => {
		const serviceCredentials = context.globalState.get<string>('serviceCredentials');
		console.log('Retrieved credentials', serviceCredentials);

		try {
			const result = await fetch('https://api.astra.datastax.com/v2/authenticateServiceAccount', {
				method: 'POST',
				headers: {
					Accept: "application/json",
					'Content-Type': 'application/json'
				},
				body: serviceCredentials,
			}).then(res => res.json());

			if (result.token === null) {
				throw 'Failed to get token';
			}
			devOpsToken = result.token;
			console.log('Got devOps token', devOpsToken);
		} catch (error) {
			console.error(error);
		}
	})

	vscode.commands.registerCommand('astra-vscode.refreshEntry', () => {
		provider.refresh();
	});
}

export function deactivate() { }
